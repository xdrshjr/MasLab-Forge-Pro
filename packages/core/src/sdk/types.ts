/**
 * SDK Type Definitions
 *
 * Types for the AgentTeam SDK API that provides programmatic access
 * to the multi-agent governance framework.
 */

import type { AgentLayer, AgentStatus, Message } from '../types/index.js'
import type { TaskLifecycleStatus } from '../team/types.js'

/**
 * Configuration for AgentTeam
 */
export interface AgentTeamConfig {
  /** Execution mode: auto (fully autonomous) or semi-auto (requires approval) */
  mode: 'auto' | 'semi-auto'

  /** Heartbeat interval in milliseconds (default: 4000ms) */
  heartbeatInterval?: number

  /** Maximum number of bottom-layer agents (default: 5) */
  maxBottomAgents?: number

  /** Database file path (default: './.agent-workspace/task.db') */
  databasePath?: string

  /** Workspace directory path (default: './.agent-workspace') */
  workspacePath?: string

  /** Project root directory (default: '.') */
  projectRoot?: string

  /** LLM model to use (default: 'claude-3-5-sonnet') */
  llmModel?: string

  /** Governance configuration */
  governance?: {
    /** Signature threshold (0-1, default: 0.67) */
    signatureThreshold?: number

    /** Election interval in heartbeats (default: 50) */
    electionInterval?: number

    /** Warning threshold before demotion (default: 3) */
    warningThreshold?: number
  }
}

/**
 * Result of task execution (SDK version with extended metrics)
 */
export interface SDKTaskResult {
  /** Whether the task completed successfully */
  success: boolean

  /** Task identifier */
  taskId: string

  /** Duration in milliseconds */
  duration: number

  /** Task output (implementation-specific) */
  output: unknown

  /** Error message if failed */
  error?: string

  /** Execution metrics */
  metrics: {
    /** Total number of agents created */
    totalAgents: number

    /** Number of tasks completed */
    tasksCompleted: number

    /** Number of tasks failed */
    tasksFailed: number

    /** Number of decisions approved */
    decisionsApproved: number

    /** Number of decisions rejected */
    decisionsRejected: number
  }
}

/**
 * Summary of agent status
 */
export interface AgentStatusSummary {
  /** Agent identifier */
  id: string

  /** Agent name */
  name: string

  /** Agent layer */
  layer: AgentLayer

  /** Agent role */
  role: string

  /** Current status */
  status: AgentStatus

  /** Supervisor ID if any */
  supervisor?: string
}

/**
 * Current team status (SDK version with extended information)
 */
export interface SDKTeamStatus {
  /** Task identifier */
  taskId: string

  /** Task lifecycle status */
  status: TaskLifecycleStatus

  /** Current heartbeat number */
  currentHeartbeat: number

  /** Elapsed time in milliseconds */
  elapsedTime: number

  /** Total team size */
  teamSize: number

  /** Agent status summaries */
  agents: AgentStatusSummary[]

  /** Recent messages */
  recentMessages: Message[]

  /** Global whiteboard content */
  whiteboard: string
}

/**
 * SDK event types
 */
export type SDKEventType =
  | 'heartbeat'
  | 'agent:created'
  | 'agent:failed'
  | 'decision:pending'
  | 'decision:approved'
  | 'decision:rejected'
  | 'task:completed'
  | 'task:failed'
  | 'log'

/**
 * Event handler type
 */
export type EventHandler = (...args: unknown[]) => void
