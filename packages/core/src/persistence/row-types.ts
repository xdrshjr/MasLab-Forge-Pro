/**
 * Database row types
 *
 * These types represent the raw data structure returned from SQLite queries.
 * They use snake_case to match the database column names.
 */

/**
 * Task table row
 */
export interface TaskRow {
  id: string
  description: string
  status: string
  mode: string
  created_at: number
  completed_at: number | null
}

/**
 * Agent table row
 */
export interface AgentRow {
  id: string
  task_id: string
  name: string
  layer: string
  role: string
  status: string
  subordinates: string
  capabilities: string
  config: string
  created_at: number
}

/**
 * Message table row
 */
export interface MessageRow {
  id: string
  task_id: string
  from_agent: string
  to_agent: string
  type: string
  content: string
  timestamp: number
  heartbeat_number: number | null
}

/**
 * Decision table row
 */
export interface DecisionRow {
  id: string
  task_id: string
  proposer_id: string
  type: string
  content: string
  require_signers: string
  signers: string
  vetoers: string
  status: string
  created_at: number
  approved_at: number | null
  rejected_at: number | null
}

/**
 * Audit table row
 */
export interface AuditRow {
  id: string
  task_id: string
  agent_id: string
  event_type: string
  reason: string
  metadata: string | null
  created_at: number
}

/**
 * Election table row
 */
export interface ElectionRow {
  id: string
  task_id: string
  round: number
  action: string
  target_agent_id: string
  votes: string
  result: string
  created_at: number
}
