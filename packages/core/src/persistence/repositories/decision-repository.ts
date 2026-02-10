/**
 * Decision repository for database operations
 *
 * Provides type-safe CRUD operations for decision entities.
 */

import type Database from 'better-sqlite3'
import type { Decision } from '../../types/index.js'
import type { DecisionRow } from '../row-types.js'

/**
 * Repository for decision-related database operations
 */
export class DecisionRepository {
  constructor(private db: Database.Database) {}

  /**
   * Inserts a new decision into the database
   *
   * @param decision - Decision to insert
   * @param taskId - Associated task ID
   */
  insert(decision: Decision, taskId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO decisions (
        id, task_id, proposer_id, type, content, require_signers,
        signers, vetoers, status, created_at, approved_at, rejected_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      decision.id,
      taskId,
      decision.proposerId,
      decision.type,
      JSON.stringify(decision.content),
      JSON.stringify(decision.requireSigners),
      JSON.stringify(decision.signers),
      JSON.stringify(decision.vetoers),
      decision.status,
      decision.createdAt,
      decision.approvedAt ?? null,
      decision.rejectedAt ?? null
    )
  }

  /**
   * Retrieves a decision by ID
   *
   * @param id - Decision ID
   * @returns Decision or undefined if not found
   */
  get(id: string): Decision | undefined {
    const stmt = this.db.prepare('SELECT * FROM decisions WHERE id = ?')
    const row = stmt.get(id) as DecisionRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToDecision(row)
  }

  /**
   * Updates a decision's status
   *
   * @param id - Decision ID
   * @param status - New status
   */
  updateStatus(id: string, status: 'pending' | 'approved' | 'rejected'): void {
    const stmt = this.db.prepare('UPDATE decisions SET status = ? WHERE id = ?')
    stmt.run(status, id)
  }

  /**
   * Approves a decision
   *
   * @param id - Decision ID
   */
  approve(id: string): void {
    const stmt = this.db.prepare('UPDATE decisions SET status = ?, approved_at = ? WHERE id = ?')
    stmt.run('approved', Date.now(), id)
  }

  /**
   * Adds a signer to a decision
   *
   * @param id - Decision ID
   * @param signerId - Signer agent ID
   */
  addSigner(id: string, signerId: string): void {
    const decision = this.get(id)
    if (!decision) return

    const signers = [...decision.signers, signerId]
    const stmt = this.db.prepare('UPDATE decisions SET signers = ? WHERE id = ?')
    stmt.run(JSON.stringify(signers), id)
  }

  /**
   * Adds a vetoer to a decision
   *
   * @param id - Decision ID
   * @param vetoerId - Vetoer agent ID
   */
  addVetoer(id: string, vetoerId: string): void {
    const decision = this.get(id)
    if (!decision) return

    const vetoers = [...decision.vetoers, vetoerId]
    const stmt = this.db.prepare('UPDATE decisions SET vetoers = ? WHERE id = ?')
    stmt.run(JSON.stringify(vetoers), id)
  }

  /**
   * Gets all decisions for a task
   *
   * @param taskId - Task ID
   * @returns Array of decisions
   */
  getByTask(taskId: string): Decision[] {
    const stmt = this.db.prepare(
      'SELECT * FROM decisions WHERE task_id = ? ORDER BY created_at DESC'
    )
    const rows = stmt.all(taskId) as DecisionRow[]
    return rows.map((row) => this.mapRowToDecision(row))
  }

  /**
   * Gets decisions by status
   *
   * @param taskId - Task ID
   * @param status - Decision status
   * @returns Array of decisions
   */
  getByStatus(taskId: string, status: 'pending' | 'approved' | 'rejected'): Decision[] {
    const stmt = this.db.prepare('SELECT * FROM decisions WHERE task_id = ? AND status = ?')
    const rows = stmt.all(taskId, status) as DecisionRow[]
    return rows.map((row) => this.mapRowToDecision(row))
  }

  /**
   * Deletes a decision
   *
   * @param id - Decision ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM decisions WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Gets all decisions
   *
   * @returns Array of all decisions
   */
  getAll(): Decision[] {
    const stmt = this.db.prepare('SELECT * FROM decisions ORDER BY created_at DESC')
    const rows = stmt.all() as DecisionRow[]
    return rows.map((row) => this.mapRowToDecision(row))
  }

  /**
   * Maps a database row to a Decision
   *
   * @param row - Database row
   * @returns Decision
   */
  private mapRowToDecision(row: DecisionRow): Decision {
    return {
      id: row.id,
      taskId: row.task_id,
      proposerId: row.proposer_id,
      type: row.type,
      content: JSON.parse(row.content) as Record<string, unknown>,
      requireSigners: JSON.parse(row.require_signers) as string[],
      signers: JSON.parse(row.signers) as string[],
      vetoers: JSON.parse(row.vetoers) as string[],
      status: row.status as 'pending' | 'approved' | 'rejected',
      createdAt: row.created_at,
      approvedAt: row.approved_at ?? undefined,
      rejectedAt: row.rejected_at ?? undefined,
    }
  }
}
