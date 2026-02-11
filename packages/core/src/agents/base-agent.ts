/**
 * Base Agent Class
 *
 * Abstract base class for all agents in the multi-agent system.
 * Provides core lifecycle management, message handling, whiteboard
 * operations, and state management.
 */

import { AgentStatus, MessageType } from '../types/index.js'
import type { AgentConfig, AgentMetrics, Message } from '../types/index.js'
import type { AgentDependencies } from './types.js'
import { AgentStateMachine } from './state-machine.js'
import { v4 as uuidv4 } from 'uuid'
import type { MessageBus } from '../communication/index.js'
import type { WhiteboardSystem } from '../whiteboard/index.js'
import { WhiteboardType } from '../whiteboard/index.js'
import type { DatabaseManager } from '../persistence/index.js'
import type {
  ErrorRecoveryManager,
  PeerTakeoverCoordinator,
  SupervisorEscalationHandler,
  ExecutionMonitor,
} from '../recovery/index.js'
import { ErrorSeverity } from '../recovery/index.js'

/**
 * Abstract base class for all agents
 */
export abstract class BaseAgent {
  protected config: AgentConfig
  protected status: AgentStatus
  protected metrics: AgentMetrics
  protected stateMachine: AgentStateMachine
  protected messageQueue: Message[] = []
  private retryCount: number = 0

  // Dependencies
  protected messageBus: MessageBus
  protected whiteboardSystem: WhiteboardSystem
  protected database: DatabaseManager
  protected governanceEngine?: unknown // Will be typed in Task 06
  protected errorRecoveryManager?: ErrorRecoveryManager
  protected peerTakeoverCoordinator?: PeerTakeoverCoordinator
  protected supervisorEscalationHandler?: SupervisorEscalationHandler
  protected executionMonitor?: ExecutionMonitor

  constructor(config: AgentConfig, dependencies: AgentDependencies) {
    this.config = config
    this.status = AgentStatus.INITIALIZING
    this.metrics = this.initializeMetrics()
    this.stateMachine = new AgentStateMachine()

    // Inject dependencies
    this.messageBus = dependencies.messageBus
    this.whiteboardSystem = dependencies.whiteboardSystem
    this.database = dependencies.database
    this.governanceEngine = dependencies.governanceEngine
    this.errorRecoveryManager = dependencies.errorRecoveryManager
    this.peerTakeoverCoordinator = dependencies.peerTakeoverCoordinator
    this.supervisorEscalationHandler = dependencies.supervisorEscalationHandler
    this.executionMonitor = dependencies.executionMonitor
  }

  // ===== Public Lifecycle Methods =====

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    console.log(`[${this.config.name}] Initializing...`)

    // Register with message bus
    this.messageBus.registerAgent(this.config.id)

    // Note: Whiteboards are created automatically by the system
    // No explicit creation needed here

    // Subclass-specific initialization
    await this.onInitialize()

    // Transition to idle state
    this.stateMachine.transition(this, AgentStatus.IDLE, 'initialization complete')
    this.metrics.lastActiveTimestamp = Date.now()

    console.log(`[${this.config.name}] Initialized successfully`)
  }

  /**
   * Process heartbeat event
   */
  async onHeartbeat(heartbeatNumber: number): Promise<void> {
    try {
      // 1. Read messages from the bus
      const messages = this.messageBus.getMessages(this.config.id)
      this.messageQueue.push(...messages)

      // 2. Update status if there are messages to process
      if (this.messageQueue.length > 0 && this.status === AgentStatus.IDLE) {
        this.stateMachine.transition(this, AgentStatus.WORKING, 'processing messages')
      }

      // 3. Read whiteboard content
      const whiteboardContent = await this.readWhiteboard(this.config.layer)

      // 4. Subclass-specific processing
      await this.onProcess(this.messageQueue, whiteboardContent)

      // 5. Clear processed messages
      this.messageQueue = []

      // 6. Update metrics
      this.metrics.heartbeatsResponded++
      this.metrics.lastActiveTimestamp = Date.now()
      this.metrics.messagesProcessed += messages.length

      // 7. Send heartbeat acknowledgment
      this.sendMessage('system', MessageType.HEARTBEAT_ACK, {
        heartbeatNumber,
      })

      // 8. Return to idle if no more work
      if (this.status === AgentStatus.WORKING) {
        this.stateMachine.transition(this, AgentStatus.IDLE, 'work complete')
      }

      // Reset retry count on successful heartbeat
      this.retryCount = 0
    } catch (error) {
      console.error(`[${this.config.name}] Heartbeat error:`, error)
      this.metrics.heartbeatsMissed++
      await this.handleError(error as Error)
    }
  }

  /**
   * Shutdown the agent
   */
  async shutdown(): Promise<void> {
    console.log(`[${this.config.name}] Shutting down...`)
    this.stateMachine.transition(this, AgentStatus.SHUTTING_DOWN, 'shutdown requested')

    // Subclass-specific cleanup
    await this.onShutdown()

    // Unregister from message bus
    this.messageBus.unregisterAgent(this.config.id)

    this.stateMachine.transition(this, AgentStatus.TERMINATED, 'shutdown complete')
    console.log(`[${this.config.name}] Shutdown complete`)
  }

  // ===== Message Operations =====

  /**
   * Send a message to another agent
   */
  sendMessage(to: string, type: MessageType, content: Record<string, unknown>): void {
    const message: Message = {
      id: uuidv4(),
      from: this.config.id,
      to,
      type,
      content,
      timestamp: Date.now(),
      taskId: 'current-task', // Will be properly set when task management is implemented
    }

    this.messageBus.sendMessage(message)
  }

  /**
   * Broadcast a message to all agents
   */
  broadcastMessage(type: MessageType, content: Record<string, unknown>): void {
    this.sendMessage('broadcast', type, content)
  }

  // ===== Whiteboard Operations =====

  /**
   * Read whiteboard content
   */
  async readWhiteboard(layer: string, agentId?: string): Promise<string> {
    const whiteboardType = this.layerToWhiteboardType(layer)
    return await this.whiteboardSystem.read(whiteboardType, agentId || this.config.id)
  }

  /**
   * Write to whiteboard
   */
  async writeWhiteboard(content: string): Promise<void> {
    const whiteboardType = this.layerToWhiteboardType(this.config.layer)
    await this.whiteboardSystem.write(whiteboardType, content, this.config.id)
  }

  /**
   * Append to global whiteboard
   */
  async appendToGlobalWhiteboard(content: string): Promise<void> {
    await this.whiteboardSystem.append(WhiteboardType.GLOBAL, content, this.config.id)
  }

  /**
   * Convert agent layer to whiteboard type
   */
  private layerToWhiteboardType(layer: string): WhiteboardType {
    switch (layer) {
      case 'top':
        return WhiteboardType.TOP_LAYER
      case 'mid':
        return WhiteboardType.MID_LAYER
      case 'bottom':
        return WhiteboardType.BOTTOM_LAYER
      case 'global':
        return WhiteboardType.GLOBAL
      default:
        throw new Error(`Unknown layer: ${layer}`)
    }
  }

  // ===== Decision Operations (will be implemented in Task 06) =====

  /**
   * Propose a decision (placeholder for governance integration)
   */
  async proposeDecision(
    _content: Record<string, unknown>,
    _requireSigners: string[]
  ): Promise<unknown> {
    if (!this.governanceEngine) {
      throw new Error('Governance engine not available')
    }
    // Will be implemented in Task 06
    return null
  }

  /**
   * Sign a decision (placeholder for governance integration)
   */
  async signDecision(_decisionId: string): Promise<void> {
    if (!this.governanceEngine) {
      throw new Error('Governance engine not available')
    }
    // Will be implemented in Task 06
  }

  /**
   * Veto a decision (placeholder for governance integration)
   */
  async vetoDecision(_decisionId: string, _reason: string): Promise<void> {
    if (!this.governanceEngine) {
      throw new Error('Governance engine not available')
    }
    // Will be implemented in Task 06
  }

  // ===== State Query =====

  /**
   * Get current agent status
   */
  getStatus(): AgentStatus {
    return this.status
  }

  /**
   * Get agent metrics
   */
  getMetrics(): AgentMetrics {
    return { ...this.metrics }
  }

  /**
   * Get agent configuration
   */
  getConfig(): AgentConfig {
    return { ...this.config }
  }

  /**
   * Get agent ID
   */
  getId(): string {
    return this.config.id
  }

  /**
   * Get agent layer
   */
  getLayer(): string {
    return this.config.layer
  }

  // ===== Internal Methods =====

  /**
   * Set agent status (internal use only)
   */
  setStatus(status: AgentStatus): void {
    this.status = status
  }

  /**
   * Log state transition to database
   */
  logStateTransition(from: AgentStatus, to: AgentStatus, reason: string): void {
    // Log to database (will be implemented with proper audit logging)
    console.log(`[${this.config.name}] State transition logged: ${from} -> ${to} (${reason})`)
  }

  /**
   * Handle state change event
   */
  onStateChange(_from: AgentStatus, _to: AgentStatus): void {
    // Hook for subclasses to react to state changes
  }

  /**
   * Handle errors with comprehensive recovery strategy
   */
  protected async handleError(error: Error): Promise<void> {
    console.error(`[${this.config.name}] Error:`, error)

    // Use error recovery manager if available
    if (this.errorRecoveryManager) {
      const errorContext = {
        error,
        agentId: this.config.id,
        taskId: 'current-task', // Will be properly set when task management is implemented
        attemptCount: this.retryCount,
        severity: ErrorSeverity.LOW, // Will be classified by manager
      }

      const recoveryAction = await this.errorRecoveryManager.handleError(errorContext)

      switch (recoveryAction.type) {
        case 'retry':
          this.retryCount++
          console.log(`[${this.config.name}] Retrying after ${recoveryAction.delay}ms`)
          return // Will retry on next heartbeat

        case 'peer_takeover':
          console.log(`[${this.config.name}] Requesting peer takeover`)
          if (this.peerTakeoverCoordinator) {
            const success = await this.peerTakeoverCoordinator.initiateTakeover(
              this.config.id,
              errorContext.taskId
            )

            if (success) {
              // Peer accepted, transition to idle
              this.stateMachine.transition(this, AgentStatus.IDLE, 'peer takeover')
              return
            }
          }
          // Peer unavailable, escalate to supervisor
          if (this.supervisorEscalationHandler) {
            this.supervisorEscalationHandler.escalateToSupervisor(this.config.id, error)
          }
          this.stateMachine.transition(this, AgentStatus.BLOCKED, 'awaiting supervisor')
          return

        case 'escalate_to_supervisor':
          if (this.supervisorEscalationHandler) {
            this.supervisorEscalationHandler.escalateToSupervisor(this.config.id, error)
          }
          this.stateMachine.transition(this, AgentStatus.BLOCKED, 'awaiting supervisor')
          return

        case 'escalate_to_top':
          if (this.supervisorEscalationHandler) {
            this.supervisorEscalationHandler.escalateToTopLayer(this.config.id, error)
          }
          this.stateMachine.transition(this, AgentStatus.BLOCKED, 'awaiting top layer')
          return
      }
    } else {
      // Fallback to simple retry logic if error recovery manager not available
      if (this.retryCount < this.config.config.maxRetries) {
        this.retryCount++
        console.log(
          `[${this.config.name}] Retry ${this.retryCount}/${this.config.config.maxRetries}`
        )
        return
      }

      // Exceeded retries, report failure
      if (this.status === AgentStatus.IDLE) {
        this.stateMachine.transition(this, AgentStatus.WORKING, 'preparing to fail')
      }

      this.stateMachine.transition(this, AgentStatus.FAILED, 'retry limit exceeded')
      this.metrics.tasksFailed++

      // Report to supervisor if available
      if (this.config.supervisor) {
        this.sendMessage(this.config.supervisor, MessageType.ERROR_REPORT, {
          error: error.message,
          stack: error.stack,
          metrics: this.metrics,
        })
      }
    }
  }

  /**
   * Generate system prompt for LLM integration
   */
  protected generateSystemPrompt(): string {
    return `
You are ${this.config.name}, a ${this.config.layer}-layer agent.
Role: ${this.config.role}
Capabilities: ${this.config.capabilities.join(', ')}

Responsibilities:
${this.getResponsibilitiesDescription()}

Collaboration rules:
- Communicate via message bus
- Share information via whiteboards
- Major decisions require signatures
- Report issues to supervisor
- Respond to heartbeats every 4 seconds
    `.trim()
  }

  /**
   * Initialize agent metrics
   */
  private initializeMetrics(): AgentMetrics {
    return {
      tasksCompleted: 0,
      tasksFailed: 0,
      averageTaskDuration: 0,
      messagesProcessed: 0,
      heartbeatsResponded: 0,
      heartbeatsMissed: 0,
      warningsReceived: 0,
      lastActiveTimestamp: Date.now(),
      performanceScore: 100,
    }
  }

  // ===== Abstract Methods (Subclasses Must Implement) =====

  /**
   * Subclass-specific initialization
   */
  protected abstract onInitialize(): Promise<void>

  /**
   * Process messages and whiteboard content
   */
  protected abstract onProcess(messages: Message[], whiteboardContent: string): Promise<void>

  /**
   * Subclass-specific cleanup
   */
  protected abstract onShutdown(): Promise<void>

  /**
   * Get description of agent responsibilities
   */
  protected abstract getResponsibilitiesDescription(): string
}
