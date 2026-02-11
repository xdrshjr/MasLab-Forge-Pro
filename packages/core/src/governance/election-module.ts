/**
 * Election Module - Handles periodic performance-based elections
 *
 * Runs elections every 50 heartbeats to evaluate agent performance and
 * take actions: promote, demote, dismiss, or maintain based on scores.
 */

import type Database from 'better-sqlite3'
import type { Logger } from 'pino'
import type { MessageBus } from '../communication/message-bus.js'
import type { AccountabilityModule } from './accountability-module.js'
import type { PerformanceEvaluator } from './performance-evaluator.js'
import type { AgentLayer, AgentMetrics, PerformanceScore, ElectionAction } from '../types/index.js'
import { MessageType } from '../types/index.js'
import { randomUUID } from 'node:crypto'

/**
 * Election configuration
 */
export interface ElectionConfig {
  interval: number // Heartbeat interval (e.g., 50 heartbeats)
  performanceThresholds: {
    excellent: number // >= 80: consider promotion
    good: number // >= 60: maintain
    poor: number // < 40: dismiss
    failing: number // < 20: immediate dismissal
  }
}

/**
 * Election action with agent ID
 */
interface ElectionActionItem {
  agentId: string
  action: ElectionAction
  score: number
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
 * Election Module class
 */
export class ElectionModule {
  private db: Database.Database
  private evaluator: PerformanceEvaluator
  private accountabilityModule: AccountabilityModule
  private messageBus: MessageBus
  private logger: Logger
  private taskId: string
  private config: ElectionConfig

  constructor(
    database: Database.Database,
    evaluator: PerformanceEvaluator,
    accountabilityModule: AccountabilityModule,
    messageBus: MessageBus,
    logger: Logger,
    taskId: string,
    config: ElectionConfig = {
      interval: 50,
      performanceThresholds: {
        excellent: 80,
        good: 60,
        poor: 40,
        failing: 20,
      },
    }
  ) {
    this.db = database
    this.evaluator = evaluator
    this.accountabilityModule = accountabilityModule
    this.messageBus = messageBus
    this.logger = logger
    this.taskId = taskId
    this.config = config
  }

  /**
   * Triggers an election for a specific layer
   *
   * @param layer - Agent layer to evaluate
   * @param round - Election round number
   */
  triggerElection(layer: AgentLayer, round: number): void {
    this.logger.info(`Election round ${round} for ${layer} layer`)

    const agents = this.getAgentsByLayer(layer)
    if (agents.length === 0) {
      this.logger.info(`No agents in ${layer} layer, skipping election`)
      return
    }

    // Evaluate all agents
    const scores: PerformanceScore[] = []
    for (const agent of agents) {
      const metrics = this.getAgentMetrics(agent.id)
      const score = this.evaluator.calculateScore(metrics)
      score.agentId = agent.id
      scores.push(score)
    }

    // Sort by overall score (descending)
    scores.sort((a, b) => b.overallScore - a.overallScore)

    // Determine actions
    const actions: ElectionActionItem[] = []
    for (const score of scores) {
      const action = this.determineAction(score, layer)
      actions.push({ agentId: score.agentId, action, score: score.overallScore })
    }

    // Execute actions
    for (const actionItem of actions) {
      this.executeElectionAction(actionItem)
    }

    // Record election results
    this.recordElectionResults(round, layer, scores, actions)

    this.logger.info(`Election complete: ${actions.length} actions taken`)
  }

  /**
   * Determines action based on performance score
   *
   * @param score - Performance score
   * @param layer - Agent layer
   * @returns Election action
   */
  private determineAction(score: PerformanceScore, layer: AgentLayer): ElectionAction {
    const thresholds = this.config.performanceThresholds

    if (score.overallScore < thresholds.failing) {
      return 'dismiss'
    }

    if (score.overallScore < thresholds.poor) {
      if (layer === 'mid') {
        return 'demote'
      } else {
        return 'dismiss'
      }
    }

    if (score.overallScore >= thresholds.excellent) {
      if (layer === 'bottom') {
        return 'promote'
      } else {
        return 'maintain'
      }
    }

    return 'maintain'
  }

  /**
   * Executes an election action
   *
   * @param actionItem - Action to execute
   */
  private executeElectionAction(actionItem: ElectionActionItem): void {
    switch (actionItem.action) {
      case 'promote':
        this.promoteAgent(actionItem.agentId)
        break

      case 'demote':
        this.accountabilityModule.demoteAgent(actionItem.agentId, 'Poor performance in election')
        break

      case 'dismiss':
        this.accountabilityModule.dismissAgent(
          actionItem.agentId,
          'Failing performance in election'
        )
        break

      case 'maintain':
        // No action needed
        break
    }
  }

  /**
   * Promotes an agent to a higher layer
   *
   * @param agentId - Agent ID to promote
   */
  private promoteAgent(agentId: string): void {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?')
    const agent = stmt.get(agentId) as AgentRow | undefined

    if (!agent || agent.layer !== 'bottom') {
      return
    }

    // Create audit record
    const auditStmt = this.db.prepare(`
      INSERT INTO audits (id, task_id, agent_id, event_type, reason, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    auditStmt.run(
      randomUUID(),
      this.taskId,
      agentId,
      'promotion',
      'Outstanding performance in election',
      Date.now()
    )

    // Notify agent
    this.messageBus.sendMessage({
      id: randomUUID(),
      taskId: this.taskId,
      from: 'system',
      to: agentId,
      type: MessageType.PROMOTION_NOTICE,
      content: { newLayer: 'mid' },
      timestamp: Date.now(),
      priority: 2, // HIGH
    })

    this.logger.info(`Agent ${agentId} promoted to mid-layer`)

    // TODO: Implement actual promotion logic
    // Would involve creating new mid-layer agent and transitioning responsibilities
  }

  /**
   * Gets agents by layer
   *
   * @param layer - Agent layer
   * @returns Array of agents
   */
  private getAgentsByLayer(layer: AgentLayer): AgentRow[] {
    const stmt = this.db.prepare(
      'SELECT * FROM agents WHERE task_id = ? AND layer = ? AND status != ?'
    )
    return stmt.all(this.taskId, layer, 'terminated') as AgentRow[]
  }

  /**
   * Gets agent metrics (stub - returns default metrics)
   *
   * @param _agentId - Agent ID (unused in current implementation)
   * @returns Agent metrics
   */
  private getAgentMetrics(_agentId: string): AgentMetrics {
    // TODO: Implement actual metrics collection from agent history
    // For now, return default metrics
    return {
      tasksCompleted: 10,
      tasksFailed: 2,
      averageTaskDuration: 30000,
      messagesProcessed: 50,
      heartbeatsResponded: 100,
      heartbeatsMissed: 5,
      warningsReceived: 0,
      lastActiveTimestamp: Date.now(),
      performanceScore: 0,
    }
  }

  /**
   * Records election results to database
   *
   * @param round - Election round
   * @param layer - Agent layer
   * @param _scores - Performance scores (unused in current implementation)
   * @param actions - Actions taken
   */
  private recordElectionResults(
    round: number,
    layer: AgentLayer,
    _scores: PerformanceScore[],
    actions: ElectionActionItem[]
  ): void {
    for (const action of actions) {
      const stmt = this.db.prepare(`
        INSERT INTO elections (id, task_id, round, action, target_agent_id, votes, result, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      const votes = JSON.stringify({ score: action.score })
      const result = JSON.stringify({ action: action.action, layer })

      stmt.run(
        randomUUID(),
        this.taskId,
        round,
        action.action,
        action.agentId,
        votes,
        result,
        Date.now()
      )
    }
  }
}
