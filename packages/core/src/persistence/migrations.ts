/**
 * Database migration system
 *
 * Provides a simple migration runner for schema updates and versioning.
 * Migrations are executed in order and tracked in the migrations table.
 */

import type Database from 'better-sqlite3'
import { createSchema } from './schema.js'

/**
 * Migration definition interface
 */
export interface Migration {
  version: number
  name: string
  up: (db: Database.Database) => void
  down: (db: Database.Database) => void
}

/**
 * Migration runner that manages schema versions
 */
export class MigrationRunner {
  private migrations: Migration[] = []

  /**
   * Registers a migration to be run
   *
   * @param migration - Migration definition
   */
  register(migration: Migration): void {
    this.migrations.push(migration)
    // Sort by version to ensure correct execution order
    this.migrations.sort((a, b) => a.version - b.version)
  }

  /**
   * Runs all pending migrations
   *
   * @param db - SQLite database instance
   */
  run(db: Database.Database): void {
    // Create migrations tracking table
    db.exec(`
      CREATE TABLE IF NOT EXISTS migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at INTEGER NOT NULL
      )
    `)

    // Get current version
    const result = db.prepare('SELECT MAX(version) as version FROM migrations').get() as {
      version: number | null
    }
    const currentVersion = result?.version ?? 0

    // Run pending migrations
    for (const migration of this.migrations) {
      if (migration.version > currentVersion) {
        console.log(`Running migration ${migration.version}: ${migration.name}`)

        // Execute migration in a transaction
        const runMigration = db.transaction(() => {
          migration.up(db)

          db.prepare(
            `
            INSERT INTO migrations (version, name, applied_at)
            VALUES (?, ?, ?)
          `
          ).run(migration.version, migration.name, Date.now())
        })

        runMigration()

        console.log(`Migration ${migration.version} completed successfully`)
      }
    }
  }

  /**
   * Rolls back the last migration
   *
   * @param db - SQLite database instance
   */
  rollback(db: Database.Database): void {
    const result = db.prepare('SELECT MAX(version) as version FROM migrations').get() as {
      version: number | null
    }
    const currentVersion = result?.version

    if (!currentVersion) {
      console.log('No migrations to rollback')
      return
    }

    const migration = this.migrations.find((m) => m.version === currentVersion)
    if (!migration) {
      throw new Error(`Migration ${currentVersion} not found`)
    }

    console.log(`Rolling back migration ${migration.version}: ${migration.name}`)

    const rollbackMigration = db.transaction(() => {
      migration.down(db)

      db.prepare('DELETE FROM migrations WHERE version = ?').run(currentVersion)
    })

    rollbackMigration()

    console.log(`Migration ${migration.version} rolled back successfully`)
  }

  /**
   * Gets the current migration version
   *
   * @param db - SQLite database instance
   * @returns Current version number
   */
  getCurrentVersion(db: Database.Database): number {
    try {
      const result = db.prepare('SELECT MAX(version) as version FROM migrations').get() as {
        version: number | null
      }
      return result?.version ?? 0
    } catch {
      return 0
    }
  }
}

/**
 * Initial schema migration (version 1)
 */
export const initialMigration: Migration = {
  version: 1,
  name: 'initial_schema',
  up: (db: Database.Database) => {
    createSchema(db)
  },
  down: (db: Database.Database) => {
    db.exec(`
      DROP TABLE IF EXISTS elections;
      DROP TABLE IF EXISTS audits;
      DROP TABLE IF EXISTS decisions;
      DROP TABLE IF EXISTS messages;
      DROP TABLE IF EXISTS agents;
      DROP TABLE IF EXISTS tasks;
    `)
  },
}
