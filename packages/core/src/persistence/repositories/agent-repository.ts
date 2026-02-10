/**
 * Agent repository for database operations
 *
 * Provides type-safe CRUD operations for agent entities.
 */

import type Database from 'better-sqlite3'
import type { AgentConfig, AgentMetrics, AgentStatus } from '../../types/index.js'
import type { AgentRow } from '../row-types.js'

/**
 * Agent database record structure
 */
export interface AgentRecord {
  id: string
  taskId: string
  name: string
  layer: 'top' | 'mid' | 'bottom'
  role: string
  status: AgentStatus
  subordinates: string[]
  capabilities: string[]
  config: Record<string, unknown>
  createdAt: number
}

/**
 * Repository for agent-related database operations
 */
export class AgentRepository {
  constructor(private db: Database.Database) {}

  /**
   * Inserts a new agent into the database
   *
   * @param agent - Agent configuration to insert
   * @param taskId - Associated task ID
   */
  insert(agent: AgentConfig, taskId: string): void {
    const stmt = this.db.prepare(`
      INSERT INTO agents (
        id, task_id, name, layer, role, status,
        subordinates, capabilities, config, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    stmt.run(
      agent.id,
      taskId,
      agent.name,
      agent.layer,
      agent.role,
      'initializing',
      JSON.stringify(agent.subordinates),
      JSON.stringify(agent.capabilities),
      JSON.stringify(agent.config),
      Date.now()
    )
  }

  /**
   * Retrieves an agent by ID
   *
   * @param id - Agent ID
   * @returns Agent record or undefined if not found
   */
  get(id: string): AgentRecord | undefined {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?')
    const row = stmt.get(id) as AgentRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToAgent(row)
  }

  /**
   * Updates an agent's status
   *
   * @param id - Agent ID
   * @param status - New status
   */
  updateStatus(id: string, status: AgentStatus): void {
    const stmt = this.db.prepare('UPDATE agents SET status = ? WHERE id = ?')
    stmt.run(status, id)
  }

  /**
   * Updates an agent's metrics
   *
   * @param id - Agent ID
   * @param metrics - New metrics
   */
  updateMetrics(id: string, metrics: AgentMetrics): void {
    const stmt = this.db.prepare('UPDATE agents SET config = ? WHERE id = ?')
    stmt.run(JSON.stringify(metrics), id)
  }

  /**
   * Gets all agents for a task
   *
   * @param taskId - Task ID
   * @returns Array of agent records
   */
  getByTask(taskId: string): AgentRecord[] {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE task_id = ?')
    const rows = stmt.all(taskId) as AgentRow[]
    return rows.map((row) => this.mapRowToAgent(row))
  }

  /**
   * Gets agents by layer
   *
   * @param layer - Agent layer
   * @param taskId - Optional task ID filter
   * @returns Array of agent records
   */
  getByLayer(layer: 'top' | 'mid' | 'bottom', taskId?: string): AgentRecord[] {
    if (taskId) {
      const stmt = this.db.prepare('SELECT * FROM agents WHERE layer = ? AND task_id = ?')
      const rows = stmt.all(layer, taskId) as AgentRow[]
      return rows.map((row) => this.mapRowToAgent(row))
    }
    const stmt = this.db.prepare('SELECT * FROM agents WHERE layer = ?')
    const rows = stmt.all(layer) as AgentRow[]
    return rows.map((row) => this.mapRowToAgent(row))
  }

  /**
   * Gets agents by status
   *
   * @param taskId - Task ID
   * @param status - Agent status
   * @returns Array of agent records
   */
  getByStatus(taskId: string, status: AgentStatus): AgentRecord[] {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE task_id = ? AND status = ?')
    const rows = stmt.all(taskId, status) as AgentRow[]
    return rows.map((row) => this.mapRowToAgent(row))
  }

  /**
   * Deletes an agent
   *
   * @param id - Agent ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM agents WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Gets all agents
   *
   * @returns Array of all agent records
   */
  getAll(): AgentRecord[] {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY created_at DESC')
    const rows = stmt.all() as AgentRow[]
    return rows.map((row) => this.mapRowToAgent(row))
  }

  /**
   * Maps a database row to an AgentRecord
   *
   * @param row - Database row
   * @returns Agent record
   */
  private mapRowToAgent(row: AgentRow): AgentRecord {
    return {
      id: row.id,
      taskId: row.task_id,
      name: row.name,
      layer: row.layer as 'top' | 'mid' | 'bottom',
      role: row.role,
      status: row.status as AgentStatus,
      subordinates: JSON.parse(row.subordinates) as string[],
      capabilities: JSON.parse(row.capabilities) as string[],
      config: JSON.parse(row.config) as Record<string, unknown>,
      createdAt: row.created_at,
    }
  }
}
