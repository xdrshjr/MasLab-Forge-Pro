/**
 * Agent-specific type definitions
 *
 * This module defines types specific to agent implementation,
 * extending the core types from the types module.
 */

import type { AgentConfig } from '../types/index.js'
import type { MessageBus } from '../communication/index.js'
import type { WhiteboardSystem } from '../whiteboard/index.js'
import type { DatabaseManager } from '../persistence/index.js'
import type { ErrorRecoveryManager } from '../recovery/index.js'
import type { PeerTakeoverCoordinator } from '../recovery/index.js'
import type { SupervisorEscalationHandler } from '../recovery/index.js'
import type { ExecutionMonitor } from '../recovery/index.js'

/**
 * Dependencies required by all agents
 */
export interface AgentDependencies {
  messageBus: MessageBus
  whiteboardSystem: WhiteboardSystem
  database: DatabaseManager
  // governanceEngine will be added in Task 06
  governanceEngine?: unknown
  // Error recovery components (Task 09)
  errorRecoveryManager?: ErrorRecoveryManager
  peerTakeoverCoordinator?: PeerTakeoverCoordinator
  supervisorEscalationHandler?: SupervisorEscalationHandler
  executionMonitor?: ExecutionMonitor
}

/**
 * Top layer agent specific configuration
 */
export interface TopLayerAgentConfig extends AgentConfig {
  powerType: 'power_a' | 'power_b' | 'power_c'
  voteWeight: number
  signatureAuthority: string[]
}

/**
 * Mid layer agent specific configuration
 */
export interface MidLayerAgentConfig extends AgentConfig {
  domain: string
  maxSubordinates: number
}

/**
 * Bottom layer agent specific configuration
 */
export interface BottomLayerAgentConfig extends AgentConfig {
  tools: string[]
}

/**
 * Agent task structure for execution
 * (Renamed to avoid conflict with main Task interface)
 */
export interface AgentTask {
  id: string
  description: string
  deadline?: number
  dependencies?: string[]
  context?: Record<string, unknown>
}

/**
 * Issue structure for escalation
 */
export interface Issue {
  id: string
  description: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  affectedAgents: string[]
  timestamp: number
}

/**
 * Progress report structure
 */
export interface ProgressReport {
  taskId: string
  status: 'in_progress' | 'completed' | 'failed'
  percentage: number
  description: string
  result?: Record<string, unknown>
  blockers?: string[]
}

/**
 * Decision structure (placeholder for Task 06)
 */
export interface DecisionProposal {
  id: string
  proposerId: string
  content: Record<string, unknown>
  requireSigners: string[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
}

/**
 * Vote structure for conflict resolution
 */
export interface Vote {
  agentId: string
  decision: 'approve' | 'reject' | 'abstain'
  reason?: string
}

/**
 * Task decomposition result
 */
export interface TaskDecomposition {
  subtasks: SubTask[]
  dependencies: Record<string, string[]>
}

/**
 * Subtask structure
 */
export interface SubTask {
  id: string
  description: string
  assignee: string
  estimatedDuration?: number
  dependencies?: string[]
}

/**
 * Task execution result
 */
export interface TaskExecutionResult {
  success: boolean
  output: string
  duration: number
  error?: string
}
