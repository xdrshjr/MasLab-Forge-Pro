/**
 * Database entity type definitions
 *
 * This file contains all TypeScript interfaces for database entities,
 * ensuring type safety across the persistence layer.
 */

/**
 * Task entity representing a user-submitted task
 */
export interface Task {
  id: string
  description: string
  status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled'
  mode: 'auto' | 'semi-auto'
  created_at: number
  completed_at?: number
}

/**
 * Agent entity representing an agent in the system
 */
export interface Agent {
  id: string
  task_id: string
  name: string
  layer: 'top' | 'mid' | 'bottom'
  role: string
  status:
    | 'initializing'
    | 'idle'
    | 'working'
    | 'waiting_approval'
    | 'blocked'
    | 'failed'
    | 'shutting_down'
    | 'terminated'
  supervisor?: string
  subordinates: string // JSON array of agent IDs
  capabilities: string // JSON array of capability strings
  metrics: string // JSON object of agent metrics
  created_at: number
}

/**
 * Message entity representing inter-agent communication
 */
export interface Message {
  id: string
  task_id: string
  from_agent: string
  to_agent?: string // null for broadcast messages
  type: string
  content: string // JSON string
  timestamp: number
  heartbeat_number: number
}

/**
 * Decision entity for governance signature/veto tracking
 */
export interface Decision {
  id: string
  task_id: string
  proposer_id: string
  type: string
  content: string // JSON string
  require_signers: string // JSON array
  signers: string // JSON array
  vetoers: string // JSON array
  status: 'pending' | 'approved' | 'rejected' | 'appealing'
  created_at: number
  approved_at?: number
}

/**
 * Audit entity for accountability tracking
 */
export interface Audit {
  id: string
  task_id: string
  agent_id: string
  event_type: 'warning' | 'demotion' | 'dismissal' | 'promotion' | 'veto' | 'decision'
  reason: string
  related_decision_id?: string
  created_at: number
}

/**
 * Election entity for performance evaluation rounds
 */
export interface Election {
  id: string
  task_id: string
  round: number
  layer: 'top' | 'mid' | 'bottom'
  results: string // JSON object with agent scores
  actions: string // JSON array of actions taken
  created_at: number
}

/**
 * Migration tracking entity
 */
export interface Migration {
  version: number
  name: string
  applied_at: number
}
