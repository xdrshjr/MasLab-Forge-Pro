/**
 * Task repository for database operations
 *
 * Provides type-safe CRUD operations for task entities.
 */

import type Database from 'better-sqlite3'
import type { Task, TaskStatus, ExecutionMode } from '../../types/index.js'
import type { TaskRow } from '../row-types.js'

/**
 * Repository for task-related database operations
 */
export class TaskRepository {
  constructor(private db: Database.Database) {}

  /**
   * Inserts a new task into the database
   *
   * @param task - Task entity to insert
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
      task.createdAt,
      task.completedAt ?? null
    )
  }

  /**
   * Retrieves a task by ID
   *
   * @param id - Task ID
   * @returns Task entity or undefined if not found
   */
  get(id: string): Task | undefined {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?')
    const row = stmt.get(id) as TaskRow | undefined

    if (!row) {
      return undefined
    }

    return this.mapRowToTask(row)
  }

  /**
   * Updates a task with partial data
   *
   * @param id - Task ID
   * @param updates - Partial task data to update
   */
  update(id: string, updates: Partial<Omit<Task, 'id'>>): void {
    const fields = Object.keys(updates) as Array<keyof Omit<Task, 'id'>>
    if (fields.length === 0) {
      return
    }

    const setClause = fields.map((f) => `${this.camelToSnake(f)} = ?`).join(', ')
    const values = fields.map((f) => updates[f])

    const stmt = this.db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`)
    stmt.run(...values, id)
  }

  /**
   * Queries tasks with filters
   *
   * @param filters - Filter criteria
   * @returns Array of matching tasks
   */
  query(filters: Partial<Task>): Task[] {
    if (Object.keys(filters).length === 0) {
      const stmt = this.db.prepare('SELECT * FROM tasks')
      const rows = stmt.all() as TaskRow[]
      return rows.map((row) => this.mapRowToTask(row))
    }

    const conditions = Object.keys(filters).map((k) => `${this.camelToSnake(k)} = ?`)
    const values = Object.values(filters)

    const stmt = this.db.prepare(`SELECT * FROM tasks WHERE ${conditions.join(' AND ')}`)
    const rows = stmt.all(...values) as TaskRow[]

    return rows.map((row) => this.mapRowToTask(row))
  }

  /**
   * Deletes a task by ID
   *
   * @param id - Task ID
   */
  delete(id: string): void {
    const stmt = this.db.prepare('DELETE FROM tasks WHERE id = ?')
    stmt.run(id)
  }

  /**
   * Gets all tasks
   *
   * @returns Array of all tasks
   */
  getAll(): Task[] {
    const stmt = this.db.prepare('SELECT * FROM tasks ORDER BY created_at DESC')
    const rows = stmt.all() as TaskRow[]
    return rows.map((row) => this.mapRowToTask(row))
  }

  /**
   * Maps a database row to a Task entity
   *
   * @param row - Database row
   * @returns Task entity
   */
  private mapRowToTask(row: TaskRow): Task {
    return {
      id: row.id,
      description: row.description,
      status: row.status as TaskStatus,
      mode: row.mode as ExecutionMode,
      createdAt: row.created_at,
      completedAt: row.completed_at ?? undefined,
    }
  }

  /**
   * Converts camelCase to snake_case
   *
   * @param str - camelCase string
   * @returns snake_case string
   */
  private camelToSnake(str: string): string {
    return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)
  }
}
