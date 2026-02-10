/**
 * Repository Classes
 *
 * Type-safe CRUD operations for all database entities.
 * Each repository provides insert, get, update, query, and delete operations.
 */

import Database from 'better-sqlite3'
import { Task, Agent, Message, Decision, Audit, Election } from './types.js'

/**
 * Base repository with common CRUD operations
 */
abstract class BaseRepository<T extends object> {
  constructor(
    protected db: Database.Database,
    protected tableName: string
  ) {}

  /**
   * Get all records from the table
   */
  getAll(): T[] {
    const stmt = this.db.prepare(`SELECT * FROM ${this.tableName}`)
    return stmt.all() as T[]
  }

  /**
   * Delete a record by ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare(`DELETE FROM ${this.tableName} WHERE id = ?`)
    stmt.run(id)
  }

  /**
   * Count total records
   */
  count(): number {
    const stmt = this.db.prepare(`SELECT COUNT(*) as count FROM ${this.tableName}`)
    const result = stmt.get() as { count: number }
    return result.count
  }
}

/**
 * Task repository for task CRUD operations
 */
export class TaskRepository extends BaseRepository<Task> {
  constructor(db: Database.Database) {
    super(db, 'tasks')
  }

  /**
   * Insert a new task
   */
  insert(task: Task): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, description, status, mode, created_at, completed_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      task.id,
      task.description,
      task.status,
      task.mode,
      task.created_at,
      task.completed_at ?? null
    )
  }

  /**
   * Get a task by ID
   */
  get(id: string): Task | undefined {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?')
    return stmt.get(id) as Task | undefined
  }

  /**
   * Update a task
   */
  update(id: string, updates: Partial<Task>): void {
    const fields = Object.keys(updates).filter((k) => k !== 'id')
    if (fields.length === 0) return

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => updates[f as keyof Task])

    const stmt = this.db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`)
    stmt.run(...values, id)
  }

  /**
   * Query tasks with filters
   */
  query(filters: Partial<Task>): Task[] {
    const conditions = Object.keys(filters).map((k) => `${k} = ?`)
    const values = Object.values(filters)

    if (conditions.length === 0) {
      return this.getAll()
    }

    const whereClause = conditions.join(' AND ')
    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE ${whereClause}`)
    return stmt.all(...values) as Task[]
  }
}

/**
 * Agent repository for agent CRUD operations
 */
export class AgentRepository extends BaseRepository<Agent> {
  constructor(db: Database.Database) {
    super(db, 'agents')
  }

  insert(agent: Agent): void {
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, task_id, name, layer, role, status, supervisor, subordinates, capabilities, metrics, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      agent.id,
      agent.task_id,
      agent.name,
      agent.layer,
      agent.role,
      agent.status,
      agent.supervisor ?? null,
      agent.subordinates,
      agent.capabilities,
      agent.metrics,
      agent.created_at
    )
  }

  get(id: string): Agent | undefined {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?')
    return stmt.get(id) as Agent | undefined
  }

  update(id: string, updates: Partial<Agent>): void {
    const fields = Object.keys(updates).filter((k) => k !== 'id')
    if (fields.length === 0) return

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => updates[f as keyof Agent])

    const stmt = this.db.prepare(`UPDATE agents SET ${setClause} WHERE id = ?`)
    stmt.run(...values, id)
  }

  query(filters: Partial<Agent>): Agent[] {
    const conditions = Object.keys(filters).map((k) => `${k} = ?`)
    const values = Object.values(filters)

    if (conditions.length === 0) {
      return this.getAll()
    }

    const whereClause = conditions.join(' AND ')
    const stmt = this.db.prepare(`SELECT * FROM agents WHERE ${whereClause}`)
    return stmt.all(...values) as Agent[]
  }

  /**
   * Get all agents for a specific task
   */
  getByTask(taskId: string): Agent[] {
    return this.query({ task_id: taskId })
  }

  /**
   * Get agents by layer
   */
  getByLayer(layer: 'top' | 'mid' | 'bottom'): Agent[] {
    return this.query({ layer })
  }
}

/**
 * Message repository for message CRUD operations
 */
export class MessageRepository extends BaseRepository<Message> {
  constructor(db: Database.Database) {
    super(db, 'messages')
  }

  insert(message: Message): void {
    const stmt = this.db.prepare(`
      INSERT INTO messages (id, task_id, from_agent, to_agent, type, content, timestamp, heartbeat_number)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      message.id,
      message.task_id,
      message.from_agent,
      message.to_agent ?? null,
      message.type,
      message.content,
      message.timestamp,
      message.heartbeat_number
    )
  }

  get(id: string): Message | undefined {
    const stmt = this.db.prepare('SELECT * FROM messages WHERE id = ?')
    return stmt.get(id) as Message | undefined
  }

  /**
   * Query messages with filters
   */
  query(filters: Partial<Message>): Message[] {
    const conditions = Object.keys(filters).map((k) => `${k} = ?`)
    const values = Object.values(filters)

    if (conditions.length === 0) {
      return this.getAll()
    }

    const whereClause = conditions.join(' AND ')
    const stmt = this.db.prepare(
      `SELECT * FROM messages WHERE ${whereClause} ORDER BY timestamp DESC`
    )
    return stmt.all(...values) as Message[]
  }

  /**
   * Get messages by heartbeat number
   */
  getByHeartbeat(heartbeatNumber: number): Message[] {
    return this.query({ heartbeat_number: heartbeatNumber })
  }

  /**
   * Get messages between two agents
   */
  getBetweenAgents(agent1: string, agent2: string): Message[] {
    const stmt = this.db.prepare(`
      SELECT * FROM messages
      WHERE (from_agent = ? AND to_agent = ?)
         OR (from_agent = ? AND to_agent = ?)
      ORDER BY timestamp ASC
    `)
    return stmt.all(agent1, agent2, agent2, agent1) as Message[]
  }
}

/**
 * Decision repository for governance decision tracking
 */
export class DecisionRepository extends BaseRepository<Decision> {
  constructor(db: Database.Database) {
    super(db, 'decisions')
  }

  insert(decision: Decision): void {
    const stmt = this.db.prepare(`
      INSERT INTO decisions (id, task_id, proposer_id, type, content, require_signers, signers, vetoers, status, created_at, approved_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      decision.id,
      decision.task_id,
      decision.proposer_id,
      decision.type,
      decision.content,
      decision.require_signers,
      decision.signers,
      decision.vetoers,
      decision.status,
      decision.created_at,
      decision.approved_at ?? null
    )
  }

  get(id: string): Decision | undefined {
    const stmt = this.db.prepare('SELECT * FROM decisions WHERE id = ?')
    return stmt.get(id) as Decision | undefined
  }

  update(id: string, updates: Partial<Decision>): void {
    const fields = Object.keys(updates).filter((k) => k !== 'id')
    if (fields.length === 0) return

    const setClause = fields.map((f) => `${f} = ?`).join(', ')
    const values = fields.map((f) => updates[f as keyof Decision])

    const stmt = this.db.prepare(`UPDATE decisions SET ${setClause} WHERE id = ?`)
    stmt.run(...values, id)
  }

  query(filters: Partial<Decision>): Decision[] {
    const conditions = Object.keys(filters).map((k) => `${k} = ?`)
    const values = Object.values(filters)

    if (conditions.length === 0) {
      return this.getAll()
    }

    const whereClause = conditions.join(' AND ')
    const stmt = this.db.prepare(`SELECT * FROM decisions WHERE ${whereClause}`)
    return stmt.all(...values) as Decision[]
  }

  /**
   * Get pending decisions
   */
  getPending(): Decision[] {
    return this.query({ status: 'pending' })
  }
}

/**
 * Audit repository for accountability tracking
 */
export class AuditRepository extends BaseRepository<Audit> {
  constructor(db: Database.Database) {
    super(db, 'audits')
  }

  insert(audit: Audit): void {
    const stmt = this.db.prepare(`
      INSERT INTO audits (id, task_id, agent_id, event_type, reason, related_decision_id, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      audit.id,
      audit.task_id,
      audit.agent_id,
      audit.event_type,
      audit.reason,
      audit.related_decision_id ?? null,
      audit.created_at
    )
  }

  get(id: string): Audit | undefined {
    const stmt = this.db.prepare('SELECT * FROM audits WHERE id = ?')
    return stmt.get(id) as Audit | undefined
  }

  query(filters: Partial<Audit>): Audit[] {
    const conditions = Object.keys(filters).map((k) => `${k} = ?`)
    const values = Object.values(filters)

    if (conditions.length === 0) {
      return this.getAll()
    }

    const whereClause = conditions.join(' AND ')
    const stmt = this.db.prepare(
      `SELECT * FROM audits WHERE ${whereClause} ORDER BY created_at DESC`
    )
    return stmt.all(...values) as Audit[]
  }

  /**
   * Get audit events for a specific agent
   */
  getByAgent(agentId: string): Audit[] {
    return this.query({ agent_id: agentId })
  }

  /**
   * Get audit events by type
   */
  getByType(eventType: Audit['event_type']): Audit[] {
    return this.query({ event_type: eventType })
  }
}

/**
 * Election repository for performance evaluation tracking
 */
export class ElectionRepository extends BaseRepository<Election> {
  constructor(db: Database.Database) {
    super(db, 'elections')
  }

  insert(election: Election): void {
    const stmt = this.db.prepare(`
      INSERT INTO elections (id, task_id, round, layer, results, actions, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `)
    stmt.run(
      election.id,
      election.task_id,
      election.round,
      election.layer,
      election.results,
      election.actions,
      election.created_at
    )
  }

  get(id: string): Election | undefined {
    const stmt = this.db.prepare('SELECT * FROM elections WHERE id = ?')
    return stmt.get(id) as Election | undefined
  }

  query(filters: Partial<Election>): Election[] {
    const conditions = Object.keys(filters).map((k) => `${k} = ?`)
    const values = Object.values(filters)

    if (conditions.length === 0) {
      return this.getAll()
    }

    const whereClause = conditions.join(' AND ')
    const stmt = this.db.prepare(`SELECT * FROM elections WHERE ${whereClause} ORDER BY round DESC`)
    return stmt.all(...values) as Election[]
  }

  /**
   * Get elections by layer
   */
  getByLayer(layer: 'top' | 'mid' | 'bottom'): Election[] {
    return this.query({ layer })
  }

  /**
   * Get latest election for a layer
   */
  getLatest(layer: 'top' | 'mid' | 'bottom'): Election | undefined {
    const stmt = this.db.prepare(`
      SELECT * FROM elections
      WHERE layer = ?
      ORDER BY round DESC
      LIMIT 1
    `)
    return stmt.get(layer) as Election | undefined
  }
}
