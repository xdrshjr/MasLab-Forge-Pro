/**
 * Database schema definitions for SQLite
 *
 * This module contains all SQL schema definitions including tables,
 * indexes, and constraints for the multi-agent governance framework.
 */

import type Database from 'better-sqlite3'

/**
 * Creates all database tables with proper indexes and foreign keys
 *
 * @param db - SQLite database instance
 */
export function createSchema(db: Database.Database): void {
  // Enable foreign key constraints
  db.pragma('foreign_keys = ON')

  // Tasks table - stores task metadata and status
  db.exec(`
    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      description TEXT NOT NULL,
      status TEXT NOT NULL CHECK(status IN ('pending', 'running', 'paused', 'completed', 'cancelled', 'failed')),
      mode TEXT NOT NULL CHECK(mode IN ('auto', 'semi-auto')),
      created_at INTEGER NOT NULL,
      completed_at INTEGER
    )
  `)

  // Agents table - stores agent configurations and state
  db.exec(`
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      name TEXT NOT NULL,
      layer TEXT NOT NULL CHECK(layer IN ('top', 'mid', 'bottom')),
      role TEXT NOT NULL,
      status TEXT NOT NULL,
      supervisor TEXT,
      subordinates TEXT NOT NULL DEFAULT '[]',
      capabilities TEXT NOT NULL DEFAULT '[]',
      config TEXT NOT NULL DEFAULT '{}',
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for agents table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_agents_task ON agents(task_id);
    CREATE INDEX IF NOT EXISTS idx_agents_layer ON agents(layer);
    CREATE INDEX IF NOT EXISTS idx_agents_supervisor ON agents(supervisor);
  `)

  // Messages table - stores message bus history
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
    CREATE INDEX IF NOT EXISTS idx_messages_task ON messages(task_id);
    CREATE INDEX IF NOT EXISTS idx_messages_agents ON messages(from_agent, to_agent);
    CREATE INDEX IF NOT EXISTS idx_messages_heartbeat ON messages(heartbeat_number);
    CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(type);
  `)

  // Decisions table - stores governance decisions and signatures
  db.exec(`
    CREATE TABLE IF NOT EXISTS decisions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      proposer_id TEXT NOT NULL,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      require_signers TEXT NOT NULL,
      signers TEXT NOT NULL DEFAULT '[]',
      vetoers TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL CHECK(status IN ('pending', 'approved', 'rejected', 'appealing')),
      created_at INTEGER NOT NULL,
      approved_at INTEGER,
      rejected_at INTEGER,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for decisions table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_decisions_task ON decisions(task_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_proposer ON decisions(proposer_id);
    CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
  `)

  // Audits table - stores accountability and governance events
  db.exec(`
    CREATE TABLE IF NOT EXISTS audits (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      agent_id TEXT NOT NULL,
      event_type TEXT NOT NULL CHECK(event_type IN ('warning', 'demotion', 'dismissal', 'promotion', 'decision', 'veto', 'appeal')),
      reason TEXT NOT NULL,
      metadata TEXT,
      created_at INTEGER NOT NULL,
      FOREIGN KEY (task_id) REFERENCES tasks(id) ON DELETE CASCADE
    )
  `)

  // Create indexes for audits table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_audits_task ON audits(task_id);
    CREATE INDEX IF NOT EXISTS idx_audits_agent ON audits(agent_id);
    CREATE INDEX IF NOT EXISTS idx_audits_event_type ON audits(event_type);
    CREATE INDEX IF NOT EXISTS idx_audits_created_at ON audits(created_at);
  `)

  // Elections table - stores election results and actions
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

  // Create indexes for elections table
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_elections_task ON elections(task_id);
    CREATE INDEX IF NOT EXISTS idx_elections_round ON elections(round);
    CREATE INDEX IF NOT EXISTS idx_elections_target ON elections(target_agent_id);
  `)
}

/**
 * Drops all tables (used for testing or cleanup)
 *
 * @param db - SQLite database instance
 */
export function dropSchema(db: Database.Database): void {
  db.exec(`
    DROP TABLE IF EXISTS elections;
    DROP TABLE IF EXISTS audits;
    DROP TABLE IF EXISTS decisions;
    DROP TABLE IF EXISTS messages;
    DROP TABLE IF EXISTS agents;
    DROP TABLE IF EXISTS tasks;
  `)
}
