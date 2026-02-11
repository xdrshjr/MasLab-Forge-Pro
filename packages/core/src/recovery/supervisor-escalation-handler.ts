/**
 * Supervisor Escalation Handler
 *
 * Handles escalation of errors to supervisor agents or top layer
 * when recovery attempts fail.
 */

import type { MessageBus } from '../communication/index.js'
import type { AgentPool } from '../agents/agent-pool.js'
import { MessageType } from '../types/index.js'
import { ErrorSeverity } from './types.js'
import { v4 as uuidv4 } from 'uuid'

/**
 * Handles error escalation to supervisors and top layer
 */
export class SupervisorEscalationHandler {
  constructor(
    private agentPool: AgentPool,
    private messageBus: MessageBus
  ) {}

  /**
   * Escalate error to supervisor
   */
  escalateToSupervisor(agentId: string, error: Error): void {
    const agent = this.agentPool.getAgent(agentId)
    const agentConfig = agent?.getConfig()

    if (!agent || !agentConfig?.supervisor) {
      // No supervisor, escalate to top layer
      this.escalateToTopLayer(agentId, error)
      return
    }

    const supervisor = this.agentPool.getAgent(agentConfig.supervisor)

    if (!supervisor) {
      console.error(`[Escalation] Supervisor ${agentConfig.supervisor} not found`)
      return
    }

    console.log(`[Escalation] ${agentId} escalated to supervisor ${supervisor.getId()}`)

    // Send escalation message
    this.messageBus.sendMessage({
      id: uuidv4(),
      from: 'system',
      to: supervisor.getId(),
      type: MessageType.ISSUE_ESCALATION,
      content: {
        agentId,
        error: {
          message: error.message,
          stack: error.stack,
        },
        metrics: agent.getMetrics(),
        proposedSolution: this.proposeSolution(agentId, error),
      },
      timestamp: Date.now(),
      taskId: 'system', // System-level message
    })
  }

  /**
   * Escalate critical error to top layer
   */
  escalateToTopLayer(agentId: string, error: Error): void {
    const topLayerAgents = this.agentPool.getAgentsByLayer('top')

    if (topLayerAgents.length === 0) {
      console.error('[Escalation] No top-layer agents available for escalation')
      return
    }

    console.log(`[Escalation] ${agentId} escalated to top layer (critical)`)

    // Send to all top-layer agents for consultation
    for (const topAgent of topLayerAgents) {
      this.messageBus.sendMessage({
        id: uuidv4(),
        from: 'system',
        to: topAgent.getId(),
        type: MessageType.ISSUE_ESCALATION,
        content: {
          agentId,
          error: {
            message: error.message,
            stack: error.stack,
          },
          severity: ErrorSeverity.CRITICAL,
          requiresDecision: true,
        },
        timestamp: Date.now(),
        taskId: 'system', // System-level message
      })
    }
  }

  /**
   * Propose a solution for the error
   */
  private proposeSolution(agentId: string, error: Error): string {
    // Simple heuristic-based solution proposal
    const message = error.message.toLowerCase()

    if (message.includes('timeout') || message.includes('connection')) {
      return `Recommend retry with increased timeout or check network connectivity for ${agentId}`
    }

    if (message.includes('file not found') || message.includes('enoent')) {
      return `Recommend verifying file paths and permissions for ${agentId}`
    }

    if (message.includes('syntax') || message.includes('parse')) {
      return `Recommend code review and validation for ${agentId}`
    }

    return `Recommend replacing agent ${agentId} due to persistent failure`
  }
}
