/**
 * TUI Type Definitions
 *
 * Types for the Terminal User Interface components.
 */

import type { AgentTeam } from '@magf/core'

/**
 * Props for the main TUI App component
 */
export interface TUIProps {
  /** AgentTeam instance to monitor */
  team: AgentTeam
}

/**
 * Log entry for execution log
 */
export interface LogEntry {
  /** Timestamp */
  timestamp: string

  /** Log message */
  message: string

  /** Log level */
  level?: 'info' | 'warn' | 'error'
}
