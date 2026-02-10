/**
 * Database Manager
 *
 * Manages SQLite database connection, initialization, and lifecycle.
 * Uses better-sqlite3 for synchronous, high-performance database operations.
 */

import Database from 'better-sqlite3'

export interface DatabaseConfig {
  path: string
  verbose?: boolean
}

/**
 * Main database manager class
 * Handles connection, initialization, and transaction management
 */
export class DatabaseManager {
  private db: Database.Database | null = null
  private config: DatabaseConfig

  constructor(config: DatabaseConfig) {
    this.config = config
  }

  /**
   * Initialize database connection and run migrations
   */
  initialize(): void {
    if (this.db) {
      throw new Error('Database already initialized')
    }

    this.db = new Database(this.config.path, {
      verbose: this.config.verbose ? console.log : undefined,
      fileMustExist: false,
    })

    // Enable WAL mode for better concurrency
    this.db.pragma('journal_mode = WAL')

    // Enable foreign key constraints
    this.db.pragma('foreign_keys = ON')

    // Run schema creation
    this.createSchema()
  }

  /**
   * Get the database instance
   * Throws if not initialized
   */
  getDatabase(): Database.Database {
    if (!this.db) {
      throw new Error('Database not initialized. Call initialize() first.')
    }
    return this.db
  }

  /**
   * Close database connection
   */
  close(): void {
    if (this.db) {
      this.db.close()
      this.db = null
    }
  }

  /**
   * Execute a function within a transaction
   * Automatically rolls back on error
   */
  transaction<T>(fn: () => T): T {
    const db = this.getDatabase()
    const txn = db.transaction(fn)
    return txn()
  }

  /**
   * Execute a callback with database access in a transaction
   */
  withTransaction<T>(callback: (db: Database.Database) => T): T {
    return this.transaction(() => callback(this.getDatabase()))
  }

  /**
   * Create all database tables and indexes
   */
  private createSchema(): void {
    const db = this.getDatabase()

    // Tasks table
    db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        description TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'paused', 'completed', 'cancelled')),
        mode TEXT NOT NULL CHECK(mode IN ('auto', 'semi-auto')),
        created_at INTEGER NOT NULL,
        completed_at INTEGER
      )
    `)

    // Agents table
    db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        name TEXT NOT NULL,
        layer TEXT NOT NULL CHECK(layer IN ('top', 'mid', 'bottom')),
        role TEXT NOT NULL,
        status TEXT NOT NULL CHECK(status IN ('initializing', 'idle', 'working', 'waiting_approval', 'blocked', 'failed', 'shutting_down', 'terminated')),
        subordinates TEXT NOT NULL DEFAULT '[]',
        capabilities TEXT NOT NULL DEFAULT '[]',
        config TEXT NOT NULL DEFAULT '{}',
        created_at INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // Messages table
    db.exec(`
      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        from_agent TEXT NOT NULL,
        to_agent TEXT,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp INTEGER NOT NULL,
        heartbeat_number INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // Create indexes for messages table
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_task
      ON messages(task_id);

      CREATE INDEX IF NOT EXISTS idx_messages_agents
      ON messages(from_agent, to_agent);

      CREATE INDEX IF NOT EXISTS idx_messages_heartbeat
      ON messages(heartbeat_number);
    `)

    // Decisions table
    db.exec(`
      CREATE TABLE IF NOT EXISTS decisions (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        proposer_id TEXT NOT NULL,
        type TEXT NOT NULL,
        content TEXT NOT NULL,
        require_signers TEXT NOT NULL DEFAULT '[]',
        signers TEXT NOT NULL DEFAULT '[]',
        vetoers TEXT NOT NULL DEFAULT '[]',
        status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected')),
        created_at INTEGER NOT NULL,
        approved_at INTEGER,
        rejected_at INTEGER,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // Audits table
    db.exec(`
      CREATE TABLE IF NOT EXISTS audits (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        reason TEXT NOT NULL,
        metadata TEXT,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // Elections table
    db.exec(`
      CREATE TABLE IF NOT EXISTS elections (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        round INTEGER NOT NULL,
        action TEXT NOT NULL,
        target_agent_id TEXT NOT NULL,
        votes TEXT NOT NULL,
        result TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
      )
    `)

    // Migrations table for tracking schema versions
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `)
  }

  /**
   * Run database migrations
   */
  runMigrations(migrations: MigrationDefinition[]): void {
    const db = this.getDatabase()

    // Sort migrations by version
    const sortedMigrations = [...migrations].sort((a, b) => a.version - b.version)

    // Get current version
    const result = db.prepare('SELECT MAX(version) as version FROM migrations').get() as {
      version: number | null
    }
    const currentVersion = result?.version || 0

    // Run pending migrations
    for (const migration of sortedMigrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration ${migration.version}: ${migration.name}`)

        this.transaction(() => {
          migration.up(db)

          db.prepare(
            `
            INSERT INTO migrations (version, name, applied_at)
            VALUES (?, ?, ?)
          `
          ).run(migration.version, migration.name, Date.now())
        })

        console.log(`Migration ${migration.version} completed`)
      }
    }
  }
}

/**
 * Migration definition interface
 */
export interface MigrationDefinition {
  version: number
  name: string
  up: (db: Database.Database) => void
  down: (db: Database.Database) => void
}
