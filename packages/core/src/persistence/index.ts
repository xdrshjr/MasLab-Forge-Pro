/**
 * Persistence layer exports
 *
 * Provides database, repositories, and backup utilities.
 */

// Database
export { DatabaseManager } from './database.js'

// Row types for type-safe database queries
export type {
  TaskRow,
  AgentRow,
  MessageRow,
  DecisionRow,
  AuditRow,
  ElectionRow,
} from './row-types.js'

// Repositories
export {
  TaskRepository,
  AgentRepository,
  MessageRepository,
  DecisionRepository,
  AuditRepository,
  ElectionRepository,
  type AgentRecord,
} from './repositories/index.js'

// Backup utilities
export { DatabaseBackupManager } from './backup.js'
