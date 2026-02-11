/**
 * Error Recovery Types
 *
 * Defines types for the error recovery system including error severity,
 * recovery actions, and error context.
 */

/**
 * Error severity levels
 */
export enum ErrorSeverity {
  LOW = 'low', // Retry immediately
  MEDIUM = 'medium', // Retry with backoff
  HIGH = 'high', // Escalate to supervisor
  CRITICAL = 'critical', // Escalate to top layer
}

/**
 * Error context for recovery decisions
 */
export interface ErrorContext {
  error: Error
  agentId: string
  taskId: string
  attemptCount: number
  severity: ErrorSeverity
}

/**
 * Recovery action types
 */
export type RecoveryActionType =
  | 'retry'
  | 'peer_takeover'
  | 'escalate_to_supervisor'
  | 'escalate_to_top'

/**
 * Recovery action result
 */
export interface RecoveryAction {
  type: RecoveryActionType
  agentId: string
  delay?: number
  error?: Error
  taskId?: string
}

/**
 * Agent state for replacement
 */
export interface AgentState {
  currentTask: unknown
  taskQueue: unknown[]
  whiteboardContent: string
  metrics: unknown
  subordinates: string[]
}
