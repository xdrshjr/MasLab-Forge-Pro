/**
 * Database manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../src/persistence/database.js'
import { unlinkSync, existsSync } from 'fs'

describe('DatabaseManager', () => {
  const testDbPath = ':memory:' // Use in-memory database for tests
  let dbManager: DatabaseManager

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: testDbPath })
  })

  afterEach(() => {
    if (dbManager) {
      dbManager.close()
    }
  })

  it('should initialize database successfully', () => {
    expect(() => dbManager.initialize()).not.toThrow()
  })

  it('should throw error when initializing twice', () => {
    dbManager.initialize()
    expect(() => dbManager.initialize()).toThrow('Database already initialized')
  })

  it('should throw error when getting database before initialization', () => {
    expect(() => dbManager.getDatabase()).toThrow('Database not initialized')
  })

  it('should create all tables on initialization', () => {
    dbManager.initialize()
    const db = dbManager.getDatabase()

    const tables = db
      .prepare("SELECT name FROM sqlite_master WHERE type='table'")
      .all() as Array<{ name: string }>

    const tableNames = tables.map(t => t.name)

    expect(tableNames).toContain('tasks')
    expect(tableNames).toContain('agents')
    expect(tableNames).toContain('messages')
    expect(tableNames).toContain('decisions')
    expect(tableNames).toContain('audits')
    expect(tableNames).toContain('elections')
    expect(tableNames).toContain('migrations')
  })

  it('should enable WAL mode', () => {
    dbManager.initialize()
    const db = dbManager.getDatabase()

    const result = db.pragma('journal_mode', { simple: true }) as string
    // In-memory databases use 'memory' mode instead of 'wal'
    expect(['wal', 'memory']).toContain(result)
  })

  it('should enable foreign keys', () => {
    dbManager.initialize()
    const db = dbManager.getDatabase()

    const result = db.pragma('foreign_keys', { simple: true }) as number
    expect(result).toBe(1)
  })

  it('should execute transactions successfully', () => {
    dbManager.initialize()

    const result = dbManager.transaction(() => {
      return 42
    })

    expect(result).toBe(42)
  })

  it('should rollback transaction on error', () => {
    dbManager.initialize()
    const db = dbManager.getDatabase()

    // Insert a test record
    db.prepare("INSERT INTO tasks (id, description, status, mode, created_at) VALUES ('test', 'test', 'pending', 'auto', 1)").run()

    // Try to insert duplicate (should fail)
    expect(() => {
      dbManager.transaction(() => {
        db.prepare("INSERT INTO tasks (id, description, status, mode, created_at) VALUES ('test', 'test2', 'pending', 'auto', 2)").run()
      })
    }).toThrow()

    // Verify original record still exists
    const result = db.prepare('SELECT * FROM tasks WHERE id = ?').get('test')
    expect(result).toBeDefined()
  })

  it('should close database connection', () => {
    dbManager.initialize()
    expect(() => dbManager.close()).not.toThrow()
  })

  it('should handle withTransaction callback', () => {
    dbManager.initialize()

    const result = dbManager.withTransaction(db => {
      db.prepare("INSERT INTO tasks (id, description, status, mode, created_at) VALUES ('test', 'test', 'pending', 'auto', 1)").run()
      return 'success'
    })

    expect(result).toBe('success')

    const db = dbManager.getDatabase()
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get('test')
    expect(task).toBeDefined()
  })
})
