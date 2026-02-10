/**
 * Election repository for database operations
 *
 * Provides type-safe CRUD operations for election entities.
 */

import type Database from 'better-sqlite3'
import type { ElectionResult } from '../../types/index.js'
import type { ElectionRow } from '../row-types.js'

/**
 * Repository for election-related database operations
 */
export class ElectionRepository {
  constructor(private db: Database.Database) {}

  /**
   * Inserts a new election result into the database
   *
   * @param election - Election result to insert
   */
  insert(election: ElectionResult): void {
    const stmt = this.db.prepare(`
      INSERT INTO elections (id, task_id, round, action, target_agent_id, votes, result, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      election.id,
      election.taskId,
      election.round,
      election.action,
      election.targetAgentId,
      JSON.stringify(election.votes),
      election.result,
      election.timestamp
    )
  }

  /**
   * Retrieves an election result by ID
   *
   * @param id - Election ID
   * @returns Election result or undefined if not found
   */
  get(id: string): ElectionResult | undefined {
    const stmt = this.db.prepare('SELECT * FROM elections WHERE id = ?')
    const row = stmt.get(id) as ElectionRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToElection(row)
  }

  /**
   * Gets all election results for a task
   *
   * @param taskId - Task ID
   * @returns Array of election results
   */
  getByTask(taskId: string): ElectionResult[] {
    const stmt = this.db.prepare(
      'SELECT * FROM elections WHERE task_id = ? ORDER BY round DESC, created_at DESC'
    )
    const rows = stmt.all(taskId) as ElectionRow[]
    return rows.map((row) => this.mapRowToElection(row))
  }

  /**
   * Gets election results by round
   *
   * @param taskId - Task ID
   * @param round - Round number
   * @returns Array of election results
   */
  getByRound(taskId: string, round: number): ElectionResult[] {
    const stmt = this.db.prepare(
      'SELECT * FROM elections WHERE task_id = ? AND round = ? ORDER BY created_at DESC'
    )
    const rows = stmt.all(taskId, round) as ElectionRow[]
    return rows.map((row) => this.mapRowToElection(row))
  }

  /**
   * Gets election results for a specific agent
   *
   * @param taskId - Task ID
   * @param agentId - Agent ID
   * @returns Array of election results
   */
  getByAgent(taskId: string, agentId: string): ElectionResult[] {
    const stmt = this.db.prepare(
      'SELECT * FROM elections WHERE task_id = ? AND target_agent_id = ? ORDER BY round DESC'
    )
    const rows = stmt.all(taskId, agentId) as ElectionRow[]
    return rows.map((row) => this.mapRowToElection(row))
  }

  /**
   * Deletes an election result
   *
   * @param id - Election ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM elections WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Gets all election results
   *
   * @returns Array of all election results
   */
  getAll(): ElectionResult[] {
    const stmt = this.db.prepare('SELECT * FROM elections ORDER BY round DESC, created_at DESC')
    const rows = stmt.all() as ElectionRow[]
    return rows.map((row) => this.mapRowToElection(row))
  }

  /**
   * Maps a database row to an ElectionResult
   *
   * @param row - Database row
   * @returns Election result
   */
  private mapRowToElection(row: ElectionRow): ElectionResult {
    return {
      id: row.id,
      taskId: row.task_id,
      round: row.round,
      action: row.action,
      targetAgentId: row.target_agent_id,
      votes: JSON.parse(row.votes) as Record<string, string>,
      result: row.result,
      timestamp: row.created_at,
    }
  }
}
