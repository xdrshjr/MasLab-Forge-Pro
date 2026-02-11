/**
 * Appeal Module - Handles appeals for vetoed decisions
 *
 * Allows proposers to challenge vetoed decisions through top-layer voting.
 * Appeals succeed with 2/3 support from top-layer agents.
 */

import type Database from 'better-sqlite3'
import type { Logger } from 'pino'
import type { MessageBus } from '../communication/message-bus.js'
import type { DecisionRepository } from '../persistence/repositories/decision-repository.js'
import type { Appeal, AppealVote, MessageType, Decision } from '../types/index.js'
import { randomUUID } from 'node:crypto'

/**
 * Appeal configuration
 */
export interface AppealConfig {
  votingThreshold: number // e.g., 2/3 = 0.67
  votingTimeout: number // milliseconds
}

/**
 * Appeal database row structure
 */
interface AppealRow {
  id: string
  decision_id: string
  appealer_id: string
  arguments: string
  votes: string // JSON array
  result: string | null
  created_at: number
  resolved_at: number | null
}

/**
 * Appeal Module class
 */
export class AppealModule {
  private db: Database.Database
  private decisionRepo: DecisionRepository
  private messageBus: MessageBus
  private logger: Logger
  private taskId: string
  private config: AppealConfig

  constructor(
    database: Database.Database,
    decisionRepo: DecisionRepository,
    messageBus: MessageBus,
    logger: Logger,
    taskId: string,
    config: AppealConfig = { votingThreshold: 2 / 3, votingTimeout: 300000 }
  ) {
    this.db = database
    this.decisionRepo = decisionRepo
    this.messageBus = messageBus
    this.logger = logger
    this.taskId = taskId
    this.config = config

    this.createAppealsTable()
  }

  /**
   * Creates appeals table if it doesn't exist
   */
  private createAppealsTable(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS appeals (
        id TEXT PRIMARY KEY,
        decision_id TEXT NOT NULL,
        appealer_id TEXT NOT NULL,
        arguments TEXT NOT NULL,
        votes TEXT NOT NULL DEFAULT '[]',
        result TEXT CHECK(result IN ('success', 'failed')),
        created_at INTEGER NOT NULL,
        resolved_at INTEGER,
        FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE
      )
    `)

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_appeals_decision ON appeals(decision_id);
      CREATE INDEX IF NOT EXISTS idx_appeals_appealer ON appeals(appealer_id);
    `)
  }

  /**
   * Creates an appeal for a vetoed decision
   *
   * @param decisionId - ID of the vetoed decision
   * @param appealerId - ID of the agent appealing
   * @param appealArguments - Arguments for the appeal
   * @returns Created appeal
   * @throws Error if validation fails
   */
  createAppeal(decisionId: string, appealerId: string, appealArguments: string): Appeal {
    const decision = this.decisionRepo.get(decisionId)

    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`)
    }

    if (decision.proposerId !== appealerId) {
      throw new Error('Only proposer can appeal')
    }

    if (decision.status !== 'rejected') {
      throw new Error('Can only appeal rejected decisions')
    }

    // Create appeal
    const appeal: Appeal = {
      id: randomUUID(),
      decisionId,
      appealerId,
      arguments: appealArguments,
      votes: [],
      createdAt: Date.now(),
    }

    // Save to database
    const stmt = this.db.prepare(`
      INSERT INTO appeals (id, decision_id, appealer_id, arguments, votes, created_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      appeal.id,
      decisionId,
      appealerId,
      appealArguments,
      JSON.stringify([]),
      appeal.createdAt
    )

    // Update decision status to appealing
    this.decisionRepo.updateStatus(decisionId, 'appealing')

    // Request votes from top layer
    this.requestVotesFromTopLayer(appeal, decision)

    this.logger.info(`Appeal ${appeal.id} created for decision ${decisionId}`)

    return appeal
  }

  /**
   * Requests votes from top-layer agents
   */
  private requestVotesFromTopLayer(appeal: Appeal, decision: Decision): void {
    const topLayerAgents = this.getTopLayerAgents()

    for (const agentId of topLayerAgents) {
      this.messageBus.sendMessage({
        id: randomUUID(),
        taskId: this.taskId,
        from: 'system',
        to: agentId,
        type: 'vote_request' as MessageType,
        content: {
          appeal: appeal as unknown as Record<string, unknown>,
          decision: decision as unknown as Record<string, unknown>,
          deadline: Date.now() + this.config.votingTimeout,
        },
        timestamp: Date.now(),
        priority: 3, // URGENT
      })
    }
  }

  /**
   * Records a vote on an appeal
   *
   * @param appealId - Appeal ID
   * @param voterId - ID of the voting agent
   * @param vote - Vote (support or oppose)
   */
  voteOnAppeal(appealId: string, voterId: string, vote: AppealVote): void {
    const appeal = this.getAppeal(appealId)

    if (!appeal) {
      throw new Error(`Appeal ${appealId} not found`)
    }

    if (appeal.result) {
      throw new Error('Appeal already resolved')
    }

    // Check if already voted
    if (appeal.votes.some((v) => v.agentId === voterId)) {
      throw new Error(`${voterId} has already voted`)
    }

    // Record vote
    appeal.votes.push({ agentId: voterId, vote })

    // Update database
    const stmt = this.db.prepare('UPDATE appeals SET votes = ? WHERE id = ?')
    stmt.run(JSON.stringify(appeal.votes), appealId)

    this.logger.info(`Vote recorded: ${voterId} voted ${vote} on appeal ${appealId}`)

    // Check if all votes collected
    const topLayerCount = 3
    if (appeal.votes.length === topLayerCount) {
      this.resolveAppeal(appeal)
    }
  }

  /**
   * Resolves an appeal based on votes
   */
  private resolveAppeal(appeal: Appeal): void {
    const supportCount = appeal.votes.filter((v) => v.vote === 'support').length
    const threshold = Math.ceil(3 * this.config.votingThreshold) // 2 out of 3

    if (supportCount >= threshold) {
      // Appeal succeeded
      appeal.result = 'success'
      appeal.resolvedAt = Date.now()

      // Approve original decision
      this.decisionRepo.approve(appeal.decisionId)

      this.sendAppealResult(appeal, 'success')

      this.logger.info(`Appeal ${appeal.id} SUCCEEDED (${supportCount}/${threshold})`)
    } else {
      // Appeal failed
      appeal.result = 'failed'
      appeal.resolvedAt = Date.now()

      // Update decision status back to rejected
      this.decisionRepo.updateStatus(appeal.decisionId, 'rejected')

      this.sendAppealResult(appeal, 'failed')

      this.logger.info(`Appeal ${appeal.id} FAILED (${supportCount}/${threshold})`)
    }

    // Update database
    const stmt = this.db.prepare('UPDATE appeals SET result = ?, resolved_at = ? WHERE id = ?')
    stmt.run(appeal.result, appeal.resolvedAt, appeal.id)
  }

  /**
   * Sends appeal result to appealer
   */
  private sendAppealResult(appeal: Appeal, result: 'success' | 'failed'): void {
    this.messageBus.sendMessage({
      id: randomUUID(),
      taskId: this.taskId,
      from: 'system',
      to: appeal.appealerId,
      type: 'appeal_result' as MessageType,
      content: { result, votes: appeal.votes },
      timestamp: Date.now(),
    })
  }

  /**
   * Gets an appeal by ID
   *
   * @param appealId - Appeal ID
   * @returns Appeal or undefined
   */
  getAppeal(appealId: string): Appeal | undefined {
    const stmt = this.db.prepare('SELECT * FROM appeals WHERE id = ?')
    const row = stmt.get(appealId) as AppealRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToAppeal(row)
  }

  /**
   * Gets top-layer agents (stub - will be replaced with actual implementation)
   */
  private getTopLayerAgents(): string[] {
    // TODO: Query agents table for top-layer agents
    // For now, return placeholder IDs
    return ['top-1', 'top-2', 'top-3']
  }

  /**
   * Maps database row to Appeal object
   */
  private mapRowToAppeal(row: AppealRow): Appeal {
    const votes = JSON.parse(row.votes) as Array<{ agentId: string; vote: AppealVote }>
    return {
      id: row.id,
      decisionId: row.decision_id,
      appealerId: row.appealer_id,
      arguments: row.arguments,
      votes,
      result: row.result as 'success' | 'failed' | undefined,
      createdAt: row.created_at,
      resolvedAt: row.resolved_at ?? undefined,
    }
  }
}
