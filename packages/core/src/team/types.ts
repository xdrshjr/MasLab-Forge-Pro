/**
 * Team Management Type Definitions
 *
 * Defines types for dynamic role generation, team structure,
 * and task lifecycle management.
 */

import type { AgentLayer, AgentCapability, ExecutionMode } from '../types/index.js'
import type { BaseAgent } from '../agents/base-agent.js'

/**
 * Task context gathered through requirement clarification
 */
export interface TaskContext {
  id: string
  description: string
  type: string // e.g., "development", "research", "infrastructure"
  requirements: string[]
  constraints: {
    timeline?: string
    resources?: string[]
    preferences?: Record<string, unknown>
  }
  clarificationHistory: Array<{
    question: string
    answer: string
  }>
  mode: ExecutionMode
}

/**
 * Role definition for an agent in the team
 */
export interface RoleDefinition {
  name: string
  layer: AgentLayer
  responsibilities: string[]
  capabilities: AgentCapability[]
  signatureAuthority?: string[] // For top layer
  domain?: string // For mid layer
  tools?: string[] // For bottom layer
}

/**
 * Complete team structure with all three layers
 */
export interface TeamStructure {
  topLayer: RoleDefinition[] // Always 3
  midLayer: RoleDefinition[] // 2-5
  bottomLayer: RoleDefinition[] // 4-10+
}

/**
 * Validation result for team structure
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Task lifecycle status
 */
export enum TaskLifecycleStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  FAILED = 'failed',
}

/**
 * Active task state
 */
export interface ActiveTask {
  context: TaskContext
  team: Map<string, BaseAgent>
  status: TaskLifecycleStatus
  startedAt: number
  completedAt?: number
}

/**
 * Team analysis for rebalancing
 */
export interface TeamAnalysis {
  overloadedAgents: BaseAgent[]
  idleAgents: BaseAgent[]
  underStaffedDomains: string[]
}

/**
 * Team status for external queries
 */
export interface TeamStatus {
  taskId: string
  status: TaskLifecycleStatus
  teamSize: number
  agents: Array<{
    id: string
    name: string
    layer: AgentLayer
    status: string
  }>
}

/**
 * Task result returned after completion
 */
export interface TaskResult {
  success: boolean
  output?: string
  error?: string
  duration: number
}
