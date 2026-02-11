/**
 * Core type definitions for the Multi-Agent Governance Framework
 *
 * This module defines the fundamental types used throughout the framework,
 * including agent configurations, message structures, and system states.
 */

/**
 * Agent layer in the three-tier governance hierarchy
 */
export type AgentLayer = 'top' | 'mid' | 'bottom'

/**
 * Agent operational status
 */
export enum AgentStatus {
  INITIALIZING = 'initializing',
  IDLE = 'idle',
  WORKING = 'working',
  WAITING_APPROVAL = 'waiting_approval',
  BLOCKED = 'blocked',
  FAILED = 'failed',
  SHUTTING_DOWN = 'shutting_down',
  TERMINATED = 'terminated',
}

/**
 * Agent capabilities that define what actions an agent can perform
 */
export type AgentCapability =
  | 'plan'
  | 'execute'
  | 'reflect'
  | 'tool_call'
  | 'code_gen'
  | 'test_exec'
  | 'review'
  | 'coordinate'
  | 'delegate'
  | 'arbitrate'

/**
 * Configuration for creating an agent instance
 */
export interface AgentConfig {
  id: string
  name: string
  layer: AgentLayer
  role: string
  supervisor?: string
  subordinates: string[]
  capabilities: AgentCapability[]
  config: {
    llmModel?: string
    temperature?: number
    maxRetries: number
    timeoutMs: number
  }
}

/**
 * Performance metrics tracked for each agent
 */
export interface AgentMetrics {
  tasksCompleted: number
  tasksFailed: number
  averageTaskDuration: number
  messagesProcessed: number
  heartbeatsResponded: number
  heartbeatsMissed: number
  warningsReceived: number
  lastActiveTimestamp: number
  performanceScore: number
}

/**
 * Message priority levels
 */
export enum MessagePriority {
  LOW = 0,
  NORMAL = 1,
  HIGH = 2,
  URGENT = 3,
}

/**
 * Message types for inter-agent communication
 */
export enum MessageType {
  // Task-related messages
  TASK_ASSIGN = 'task_assign',
  TASK_ACCEPT = 'task_accept',
  TASK_REJECT = 'task_reject',
  TASK_COMPLETE = 'task_complete',
  TASK_FAIL = 'task_fail',

  // Progress reporting
  PROGRESS_REPORT = 'progress_report',
  STATUS_QUERY = 'status_query',
  STATUS_REPORT = 'status_report',

  // Decision-related messages
  DECISION_PROPOSE = 'decision_propose',
  SIGNATURE_REQUEST = 'signature_request',
  SIGNATURE_APPROVE = 'signature_approve',
  SIGNATURE_VETO = 'signature_veto',
  APPEAL_REQUEST = 'appeal_request',
  APPEAL_RESULT = 'appeal_result',

  // Coordination messages
  PEER_COORDINATION = 'peer_coordination',
  PEER_COORDINATION_RESPONSE = 'peer_coordination_response',
  PEER_HELP_REQUEST = 'peer_help_request',
  PEER_HELP_RESPONSE = 'peer_help_response',

  // Conflict and arbitration
  CONFLICT_REPORT = 'conflict_report',
  ARBITRATION_REQUEST = 'arbitration_request',
  ARBITRATION_RESULT = 'arbitration_result',
  VOTE_REQUEST = 'vote_request',
  VOTE_RESPONSE = 'vote_response',

  // Error and recovery
  ERROR_REPORT = 'error_report',
  ISSUE_ESCALATION = 'issue_escalation',
  RECOVERY_COMMAND = 'recovery_command',

  // Governance messages
  WARNING_ISSUE = 'warning_issue',
  DEMOTION_NOTICE = 'demotion_notice',
  DISMISSAL_NOTICE = 'dismissal_notice',
  PROMOTION_NOTICE = 'promotion_notice',
  ELECTION_START = 'election_start',
  ELECTION_VOTE = 'election_vote',
  ELECTION_RESULT = 'election_result',

  // System messages
  HEARTBEAT_ACK = 'heartbeat_ack',
  AGENT_REGISTER = 'agent_register',
  AGENT_UNREGISTER = 'agent_unregister',
  SYSTEM_COMMAND = 'system_command',
}

/**
 * Message structure for inter-agent communication
 */
export interface Message {
  id: string
  taskId: string
  from: string
  to: string
  type: MessageType
  content: Record<string, unknown>
  timestamp: number
  priority?: MessagePriority
  replyTo?: string
  heartbeatNumber?: number
}

/**
 * Decision types requiring signatures
 */
export enum DecisionType {
  TECHNICAL_PROPOSAL = 'technical_proposal',
  TASK_ALLOCATION = 'task_allocation',
  RESOURCE_ADJUSTMENT = 'resource_adjustment',
  MILESTONE_CONFIRMATION = 'milestone_confirmation',
}

/**
 * Decision status in the governance workflow
 */
export type DecisionStatus = 'pending' | 'approved' | 'rejected' | 'appealing'

/**
 * Decision structure for governance mechanisms
 */
export interface Decision {
  id: string
  taskId: string
  proposerId: string
  type: string
  content: Record<string, unknown>
  requireSigners: string[]
  signers: string[]
  vetoers: string[]
  status: 'pending' | 'approved' | 'rejected'
  createdAt: number
  approvedAt?: number
  rejectedAt?: number
}

/**
 * Task execution mode
 */
export type ExecutionMode = 'auto' | 'semi-auto'

/**
 * Task status in the lifecycle
 */
export type TaskStatus = 'pending' | 'running' | 'paused' | 'completed' | 'cancelled' | 'failed'

/**
 * Task configuration and state
 */
export interface Task {
  id: string
  description: string
  status: TaskStatus
  mode: ExecutionMode
  createdAt: number
  completedAt?: number
}

/**
 * Audit event for governance tracking
 */
export interface AuditEvent {
  id: string
  taskId: string
  agentId: string
  eventType: string
  reason: string
  metadata?: Record<string, unknown>
  timestamp: number
}

/**
 * Election result for performance-based governance
 */
export interface ElectionResult {
  id: string
  taskId: string
  round: number
  action: string
  targetAgentId: string
  votes: Record<string, string>
  result: string
  timestamp: number
}

/**
 * Appeal vote type
 */
export type AppealVote = 'support' | 'oppose'

/**
 * Appeal result
 */
export type AppealResult = 'success' | 'failed'

/**
 * Appeal structure for challenging vetoed decisions
 */
export interface Appeal {
  id: string
  decisionId: string
  appealerId: string
  arguments: string
  votes: Array<{
    agentId: string
    vote: AppealVote
  }>
  result?: AppealResult
  createdAt: number
  resolvedAt?: number
}

/**
 * Performance score for agent evaluation
 */
export interface PerformanceScore {
  agentId: string
  tasksCompleted: number
  tasksFailed: number
  successRate: number
  averageResponseTime: number
  collaborationScore: number
  overallScore: number
}

/**
 * Election action type
 */
export type ElectionAction = 'promote' | 'demote' | 'dismiss' | 'maintain'

/**
 * Audit event type
 */
export type AuditEventType =
  | 'warning'
  | 'demotion'
  | 'dismissal'
  | 'promotion'
  | 'decision'
  | 'veto'
  | 'appeal'
