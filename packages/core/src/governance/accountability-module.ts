/**
 * Accountability Module - Handles warnings, demotions, and dismissals
 *
 * Enforces consequences for failures through a progressive discipline system:
 * - Warnings for task failures
 * - Demotion for repeated poor performance
 * - Dismissal after 3 warnings or critical failures
 */

import type Database from 'better-sqlite3'
import type { Logger } from 'pino'
import type { MessageBus } from '../communication/message-bus.js'
import type { AuditRepository } from '../persistence/repositories/audit-repository.js'
import type { MessageType } from '../types/index.js'
import { randomUUID } from 'node:crypto'

/**
 * Accountability configuration
 */
export interface AccountabilityConfig {
  warningThreshold: number // Number of warnings before dismissal (default: 3)
  failureThreshold: number // Consecutive failures triggering warning (default: 1)
}

/**
 * Agent row structure for database queries
 */
interface AgentRow {
  id: string
  task_id: string
  name: string
  layer: string
  role: string
  status: string
  supervisor: string | null
  subordinates: string
  capabilities: string
  config: string
  created_at: number
}

/**
 * Agent config structure
 */
interface AgentConfigData {
  warningsReceived?: number
  [key: string]: unknown
}

/**
 * Accountability Module class
 */
export class AccountabilityModule {
  private db: Database.Database
  private auditRepo: AuditRepository
  private messageBus: MessageBus
  private logger: Logger
  private taskId: string
  private config: AccountabilityConfig

  constructor(
    database: Database.Database,
    auditRepo: AuditRepository,
    messageBus: MessageBus,
    logger: Logger,
    taskId: string,
    config: AccountabilityConfig = { warningThreshold: 3, failureThreshold: 1 }
  ) {
    this.db = database
    this.auditRepo = auditRepo
    this.messageBus = messageBus
    this.logger = logger
    this.taskId = taskId
    this.config = config
  }

  /**
   * Reports a task failure and issues warnings to responsible agents
   *
   * @param taskId - ID of the failed task
   * @param failureReason - Reason for the failure
   */
  reportFailure(taskId: string, failureReason: string): void {
    // Identify responsible agents
    const responsibleAgents = this.identifyResponsibleAgents(taskId)

    // Issue warnings to each responsible agent
    for (const agentId of responsibleAgents) {
      void this.issueWarning(agentId, `Task ${taskId} failed: ${failureReason}`)
    }

    this.logger.info(
      `Failure reported for task ${taskId}, ${responsibleAgents.length} agents warned`
    )
  }

  /**
   * Issues a warning to an agent
   *
   * @param agentId - ID of the agent to warn
   * @param reason - Reason for the warning
   */
  issueWarning(agentId: string, reason: string): void {
    // Create audit record
    this.auditRepo.insert({
      id: randomUUID(),
      taskId: this.taskId,
      agentId,
      eventType: 'warning',
      reason,
      metadata: {},
      timestamp: Date.now(),
    })

    // Get agent and update warning count
    const agent = this.getAgent(agentId)
    if (!agent) {
      this.logger.warn(`Agent ${agentId} not found, cannot issue warning`)
      return
    }

    const config = JSON.parse(agent.config) as AgentConfigData
    const warningsReceived = (config.warningsReceived ?? 0) + 1

    // Check if dismissal threshold reached
    if (warningsReceived >= this.config.warningThreshold) {
      void this.dismissAgent(agentId, 'Accumulated 3 warnings')
      return
    }

    // Update agent warnings
    this.updateAgentWarnings(agentId, warningsReceived)

    // Notify agent
    this.messageBus.sendMessage({
      id: randomUUID(),
      taskId: this.taskId,
      from: 'system',
      to: agentId,
      type: 'warning_issue' as MessageType,
      content: { reason, warningsReceived: warningsReceived },
      timestamp: Date.now(),
      priority: 3, // URGENT
    })

    this.logger.warn(
      `Warning issued to ${agentId}: ${reason} (${warningsReceived}/${this.config.warningThreshold})`
    )
  }

  /**
   * Demotes an agent to a lower layer
   *
   * @param agentId - ID of the agent to demote
   * @param reason - Reason for demotion
   */
  demoteAgent(agentId: string, reason: string): void {
    const agent = this.getAgent(agentId)

    if (!agent) {
      this.logger.warn(`Agent ${agentId} not found, cannot demote`)
      return
    }

    if (agent.layer === 'bottom') {
      // Already at bottom, cannot demote further - issue warning instead
      void this.issueWarning(agentId, `Demotion attempted: ${reason}`)
      return
    }

    // Create audit record
    this.auditRepo.insert({
      id: randomUUID(),
      taskId: this.taskId,
      agentId,
      eventType: 'demotion',
      reason,
      metadata: { previousLayer: agent.layer },
      timestamp: Date.now(),
    })

    // Notify agent
    this.messageBus.sendMessage({
      id: randomUUID(),
      taskId: this.taskId,
      from: 'system',
      to: agentId,
      type: 'demotion_notice' as MessageType,
      content: { reason },
      timestamp: Date.now(),
      priority: 3, // URGENT
    })

    this.logger.info(`Agent ${agentId} demoted: ${reason}`)

    // TODO: Implement actual demotion logic (mid -> bottom)
    // This would involve creating a new bottom-layer agent and
    // transferring responsibilities
  }

  /**
   * Dismisses an agent from the system
   *
   * @param agentId - ID of the agent to dismiss
   * @param reason - Reason for dismissal
   */
  dismissAgent(agentId: string, reason: string): void {
    // Create audit record
    this.auditRepo.insert({
      id: randomUUID(),
      taskId: this.taskId,
      agentId,
      eventType: 'dismissal',
      reason,
      metadata: {},
      timestamp: Date.now(),
    })

    // Update agent status to terminated
    const stmt = this.db.prepare('UPDATE agents SET status = ? WHERE id = ?')
    stmt.run('terminated', agentId)

    // Get agent info for notification
    const agent = this.getAgent(agentId)

    // Notify supervisor if exists
    if (agent?.supervisor) {
      this.messageBus.sendMessage({
        id: randomUUID(),
        taskId: this.taskId,
        from: 'system',
        to: agent.supervisor,
        type: 'dismissal_notice' as MessageType,
        content: { agentId, reason },
        timestamp: Date.now(),
        priority: 3, // URGENT
      })
    }

    this.logger.info(`Agent ${agentId} dismissed: ${reason}`)

    // TODO: Trigger replacement process
    // This will be implemented with team management in Task 08
  }

  /**
   * Identifies agents responsible for a task
   *
   * @param taskId - Task ID
   * @returns Array of responsible agent IDs
   */
  private identifyResponsibleAgents(taskId: string): string[] {
    // Find task assignment messages
    const stmt = this.db.prepare(`
      SELECT to_agent FROM messages
      WHERE task_id = ? AND type = 'task_assign'
    `)
    const assignments = stmt.all(taskId) as Array<{ to_agent: string }>

    const assignees = assignments.map((a) => a.to_agent)

    // TODO: Find signers who approved the task
    // This would query decisions table for related approvals

    return [...new Set(assignees)]
  }

  /**
   * Gets an agent by ID
   *
   * @param agentId - Agent ID
   * @returns Agent row or undefined
   */
  private getAgent(agentId: string): AgentRow | undefined {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?')
    return stmt.get(agentId) as AgentRow | undefined
  }

  /**
   * Updates agent warning count
   *
   * @param agentId - Agent ID
   * @param warningsReceived - New warning count
   */
  private updateAgentWarnings(agentId: string, warningsReceived: number): void {
    const agent = this.getAgent(agentId)
    if (!agent) return

    const config = JSON.parse(agent.config) as AgentConfigData
    config.warningsReceived = warningsReceived

    const stmt = this.db.prepare('UPDATE agents SET config = ? WHERE id = ?')
    stmt.run(JSON.stringify(config), agentId)
  }
}
