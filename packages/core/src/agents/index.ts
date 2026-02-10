/**
 * Agent Module Exports
 *
 * This module provides the agent system for the Multi-Agent Governance Framework,
 * including base classes, layer-specific implementations, and management utilities.
 */

// Base agent and state machine
export { BaseAgent } from './base-agent.js'
export { AgentStateMachine } from './state-machine.js'

// Layer-specific agents
export { TopLayerAgent } from './top-layer-agent.js'
export { MidLayerAgent } from './mid-layer-agent.js'
export { BottomLayerAgent } from './bottom-layer-agent.js'

// Agent management
export { AgentPool } from './agent-pool.js'
export type { AgentPoolConfig } from './agent-pool.js'

// Capability system
export { CapabilityRegistry } from './capability-registry.js'
export type { Capability } from './capability-registry.js'

// Metrics calculation
export { AgentMetricsCalculator } from './metrics-calculator.js'
export type { PerformanceScoreBreakdown } from './metrics-calculator.js'

// Types
export type {
  AgentDependencies,
  TopLayerAgentConfig,
  MidLayerAgentConfig,
  BottomLayerAgentConfig,
  AgentTask,
  Issue,
  ProgressReport,
} from './types.js'
