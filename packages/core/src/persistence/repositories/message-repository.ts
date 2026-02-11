/**
 * Message repository for database operations
 *
 * Provides type-safe CRUD operations for message entities.
 */

import type Database from 'better-sqlite3'
import type { Message, MessageType } from '../../types/index.js'
import type { MessageRow } from '../row-types.js'

/**
 * Repository for message-related database operations
 */
export class MessageRepository {
  constructor(private db: Database.Database) {}

  /**
   * Inserts a new message into the database
   *
   * @param message - Message to insert
   * @param taskId - Associated task ID
   * @param heartbeatNumber - Current heartbeat number
   */
  insert(message: Message, taskId: string, heartbeatNumber: number): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (
        id, task_id, from_agent, to_agent, type, content, timestamp, heartbeat_number
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      message.id,
      taskId,
      message.from,
      message.to,
      message.type,
      JSON.stringify(message.content),
      message.timestamp,
      heartbeatNumber
    )
  }

  /**
   * Retrieves a message by ID
   *
   * @param id - Message ID
   * @returns Message or undefined if not found
   */
  get(id: string): Message | undefined {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?')
    const row = stmt.get(id) as MessageRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToMessage(row)
  }

  /**
   * Gets all messages for a task
   *
   * @param taskId - Task ID
   * @returns Array of messages
   */
  getByTask(taskId: string): Message[] {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE task_id = ? ORDER BY timestamp ASC')
    const rows = stmt.all(taskId) as MessageRow[]
    return rows.map((row) => this.mapRowToMessage(row))
  }

  /**
   * Gets messages by heartbeat number
   *
   * @param taskId - Task ID
   * @param heartbeatNumber - Heartbeat number
   * @returns Array of messages
   */
  getByHeartbeat(taskId: string, heartbeatNumber: number): Message[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE task_id = ? AND heartbeat_number = ? ORDER BY timestamp ASC'
    )
    const rows = stmt.all(taskId, heartbeatNumber) as MessageRow[]
    return rows.map((row) => this.mapRowToMessage(row))
  }

  /**
   * Gets messages between two agents
   *
   * @param taskId - Task ID
   * @param fromAgent - Sender agent ID
   * @param toAgent - Receiver agent ID
   * @returns Array of messages
   */
  getBetweenAgents(taskId: string, fromAgent: string, toAgent: string): Message[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE task_id = ? AND from_agent = ? AND to_agent = ? ORDER BY timestamp ASC'
    )
    const rows = stmt.all(taskId, fromAgent, toAgent) as MessageRow[]
    return rows.map((row) => this.mapRowToMessage(row))
  }

  /**
   * Gets messages by type
   *
   * @param taskId - Task ID
   * @param type - Message type
   * @returns Array of messages
   */
  getByType(taskId: string, type: string): Message[] {
    const stmt = this.db.prepare(
      'SELECT * FROM messages WHERE task_id = ? AND type = ? ORDER BY timestamp ASC'
    )
    const rows = stmt.all(taskId, type) as MessageRow[]
    return rows.map((row) => this.mapRowToMessage(row))
  }

  /**
   * Deletes a message
   *
   * @param id - Message ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM messages WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Gets all messages
   *
   * @returns Array of all messages
   */
  getAll(): Message[] {
    const stmt = this.db.prepare('SELECT * FROM messages ORDER BY timestamp DESC')
    const rows = stmt.all() as MessageRow[]
    return rows.map((row) => this.mapRowToMessage(row))
  }

  /**
   * Maps a database row to a Message
   *
   * @param row - Database row
   * @returns Message
   */
  private mapRowToMessage(row: MessageRow): Message {
    return {
      id: row.id,
      taskId: row.task_id,
      from: row.from_agent,
      to: row.to_agent,
      type: row.type as MessageType,
      content: JSON.parse(row.content) as Record<string, unknown>,
      timestamp: row.timestamp,
      heartbeatNumber: row.heartbeat_number ?? undefined,
    }
  }
}
