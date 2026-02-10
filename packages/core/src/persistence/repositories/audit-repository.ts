/**
 * Audit repository for database operations
 *
 * Provides type-safe CRUD operations for audit entities.
 */

import type Database from 'better-sqlite3'
import type { AuditEvent } from '../../types/index.js'
import type { AuditRow } from '../row-types.js'

/**
 * Repository for audit-related database operations
 */
export class AuditRepository {
  constructor(private db: Database.Database) {}

  /**
   * Inserts a new audit event into the database
   *
   * @param event - Audit event to insert
   */
  insert(event: AuditEvent): void {
    const stmt = this.db.prepare(`
      INSERT INTO audits (id, task_id, agent_id, event_type, reason, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      event.id,
      event.taskId,
      event.agentId,
      event.eventType,
      event.reason,
      event.metadata ? JSON.stringify(event.metadata) : null,
      event.timestamp
    )
  }

  /**
   * Retrieves an audit event by ID
   *
   * @param id - Audit event ID
   * @returns Audit event or undefined if not found
   */
  get(id: string): AuditEvent | undefined {
    const stmt = this.db.prepare('SELECT * FROM audits WHERE id = ?')
    const row = stmt.get(id) as AuditRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToAudit(row)
  }

  /**
   * Gets all audit events for a task
   *
   * @param taskId - Task ID
   * @returns Array of audit events
   */
  getByTask(taskId: string): AuditEvent[] {
    const stmt = this.db.prepare('SELECT * FROM audits WHERE task_id = ? ORDER BY created_at DESC')
    const rows = stmt.all(taskId) as AuditRow[]
    return rows.map((row) => this.mapRowToAudit(row))
  }

  /**
   * Gets audit events for a specific agent
   *
   * @param taskId - Task ID
   * @param agentId - Agent ID
   * @returns Array of audit events
   */
  getByAgent(taskId: string, agentId: string): AuditEvent[] {
    const stmt = this.db.prepare(
      'SELECT * FROM audits WHERE task_id = ? AND agent_id = ? ORDER BY created_at DESC'
    )
    const rows = stmt.all(taskId, agentId) as AuditRow[]
    return rows.map((row) => this.mapRowToAudit(row))
  }

  /**
   * Gets audit events by type
   *
   * @param taskId - Task ID
   * @param eventType - Event type
   * @returns Array of audit events
   */
  getByType(taskId: string, eventType: string): AuditEvent[] {
    const stmt = this.db.prepare(
      'SELECT * FROM audits WHERE task_id = ? AND event_type = ? ORDER BY created_at DESC'
    )
    const rows = stmt.all(taskId, eventType) as AuditRow[]
    return rows.map((row) => this.mapRowToAudit(row))
  }

  /**
   * Counts warnings for an agent
   *
   * @param taskId - Task ID
   * @param agentId - Agent ID
   * @returns Number of warnings
   */
  countWarnings(taskId: string, agentId: string): number {
    const stmt = this.db.prepare(
      'SELECT COUNT(*) as count FROM audits WHERE task_id = ? AND agent_id = ? AND event_type = ?'
    )
    const result = stmt.get(taskId, agentId, 'warning') as { count: number } | undefined
    return result?.count ?? 0
  }

  /**
   * Deletes an audit event
   *
   * @param id - Audit event ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM audits WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Gets all audit events
   *
   * @returns Array of all audit events
   */
  getAll(): AuditEvent[] {
    const stmt = this.db.prepare('SELECT * FROM audits ORDER BY created_at DESC')
    const rows = stmt.all() as AuditRow[]
    return rows.map((row) => this.mapRowToAudit(row))
  }

  /**
   * Maps a database row to an AuditEvent
   *
   * @param row - Database row
   * @returns Audit event
   */
  private mapRowToAudit(row: AuditRow): AuditEvent {
    return {
      id: row.id,
      taskId: row.task_id,
      agentId: row.agent_id,
      eventType: row.event_type,
      reason: row.reason,
      metadata: row.metadata ? (JSON.parse(row.metadata) as Record<string, unknown>) : undefined,
      timestamp: row.created_at,
    }
  }
}
