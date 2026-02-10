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
  protected messageBus: any
  protected whiteboardSystem: any
  protected database: any
  protected governanceEngine?: any

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
  }

  // ===== Public Lifecycle Methods =====

  /**
   * Initialize the agent
   */
  async initialize(): Promise<void> {
    console.log(`[${this.config.name}] Initializing...`)

    // Register with message bus
    this.messageBus.registerAgent(this.config.id)

    // Create whiteboard
    await this.whiteboardSystem.createWhiteboard(this.config.layer, this.config.id)

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
  sendMessage(to: string, type: MessageType, content: any): void {
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
  broadcastMessage(type: MessageType, content: any): void {
    this.sendMessage('broadcast', type, content)
  }

  // ===== Whiteboard Operations =====

  /**
   * Read whiteboard content
   */
  async readWhiteboard(layer: string, agentId?: string): Promise<string> {
    return await this.whiteboardSystem.read(layer, agentId)
  }

  /**
   * Write to whiteboard
   */
  async writeWhiteboard(content: string): Promise<void> {
    await this.whiteboardSystem.write(this.config.layer, content, this.config.id)
  }

  /**
   * Append to global whiteboard
   */
  async appendToGlobalWhiteboard(content: string): Promise<void> {
    await this.whiteboardSystem.append('global', content, this.config.id)
  }

  // ===== Decision Operations (will be implemented in Task 06) =====

  /**
   * Propose a decision (placeholder for governance integration)
   */
  async proposeDecision(_content: any, _requireSigners: string[]): Promise<any> {
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
   * Handle errors with retry logic
   */
  protected async handleError(error: Error): Promise<void> {
    console.error(`[${this.config.name}] Error:`, error)

    // Retry logic
    if (this.retryCount < this.config.config.maxRetries) {
      this.retryCount++
      console.log(`[${this.config.name}] Retry ${this.retryCount}/${this.config.config.maxRetries}`)
      return
    }

    // Exceeded retries, report failure
    // Ensure we're in a state that can transition to FAILED
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
