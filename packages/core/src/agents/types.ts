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

/**
 * Dependencies required by all agents
 */
export interface AgentDependencies {
  messageBus: MessageBus
  whiteboardSystem: WhiteboardSystem
  database: DatabaseManager
  // governanceEngine will be added in Task 06
  governanceEngine?: any
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
  context?: any
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
  result?: any
  blockers?: string[]
}
