/**
 * Message Bus - Central nervous system for agent communication
 *
 * Implements a heartbeat-driven synchronous message bus that coordinates
 * all inter-agent communication. Uses a von Neumann architecture style
 * where all agents process messages at synchronized heartbeat moments.
 */

import { EventEmitter } from 'node:events'
import { Message } from '../types/index.js'
import { HeartbeatClock } from './heartbeat-clock.js'
import { MessageRouter } from './message-router.js'
import { PriorityQueue } from './priority-queue.js'
import { MessageValidator } from './message-validator.js'
import { MessageStatsCollector } from './message-stats.js'
import { MessageCompressor } from './message-compressor.js'
import type { Database } from 'better-sqlite3'
import type { Logger } from 'pino'

/**
 * Message bus configuration
 */
export interface MessageBusConfig {
  heartbeatInterval?: number // Heartbeat interval in milliseconds (default: 4000)
  maxQueueSize?: number // Maximum messages per agent queue (default: 1000)
  timeoutThreshold?: number // Agent timeout threshold in heartbeats (default: 3)
  enableCompression?: boolean // Enable message compression (default: false)
  compressionThreshold?: number // Compression threshold in bytes (default: 1024)
}

/**
 * Message bus statistics
 */
export interface MessageBusStats {
  currentHeartbeat: number
  totalAgents: number
  totalQueuedMessages: number
  healthyAgents: number
  messageStats: {
    totalMessages: number
    messagesByType: Record<string, number>
    messagesByAgent: Record<string, { sent: number; received: number }>
  }
}

/**
 * Main message bus class
 */
export class MessageBus extends EventEmitter {
  private config: Required<MessageBusConfig>
  private clock: HeartbeatClock
  private router: MessageRouter
  private agentQueues: Map<string, PriorityQueue>
  private agentLastSeen: Map<string, number>
  private database: Database
  private logger: Logger
  private statsCollector: MessageStatsCollector
  private compressor: MessageCompressor | null
  private taskId: string

  constructor(config: MessageBusConfig, database: Database, logger: Logger, taskId: string) {
    super()

    // Set defaults for all config values to ensure they're never undefined
    this.config = {
      heartbeatInterval: config.heartbeatInterval ?? 4000,
      maxQueueSize: config.maxQueueSize ?? 1000,
      timeoutThreshold: config.timeoutThreshold ?? 3,
      enableCompression: config.enableCompression ?? false,
      compressionThreshold: config.compressionThreshold ?? 1024,
    } as Required<MessageBusConfig>

    this.database = database
    this.logger = logger
    this.taskId = taskId
    this.agentQueues = new Map()
    this.agentLastSeen = new Map()
    this.statsCollector = new MessageStatsCollector()

    // Initialize compressor if enabled
    this.compressor = this.config.enableCompression
      ? new MessageCompressor({ compressionThreshold: this.config.compressionThreshold })
      : null

    // Initialize heartbeat clock
    this.clock = new HeartbeatClock({ interval: this.config.heartbeatInterval })

    // Initialize message router
    this.router = new MessageRouter(this.agentQueues, this.logger, {
      maxQueueSize: this.config.maxQueueSize,
    })

    // Register heartbeat handler
    this.clock.onHeartbeat((heartbeat) => {
      this.onHeartbeatTick(heartbeat)
    })
  }

  // === Lifecycle Management ===

  /**
   * Start the message bus
   */
  start(): void {
    this.clock.start()
    this.logger.info('MessageBus started', {
      heartbeatInterval: this.config.heartbeatInterval,
      maxQueueSize: this.config.maxQueueSize,
      timeoutThreshold: this.config.timeoutThreshold,
    })
  }

  /**
   * Stop the message bus
   */
  stop(): void {
    this.clock.stop()
    this.logger.info('MessageBus stopped')
  }

  /**
   * Check if the message bus is currently running
   *
   * @returns True if running, false otherwise
   */
  isRunning(): boolean {
    return this.clock.getIsRunning()
  }

  // === Agent Management ===

  /**
   * Register an agent with the message bus
   *
   * @param agentId - Unique agent identifier
   * @throws Error if agent is already registered
   */
  registerAgent(agentId: string): void {
    if (this.agentQueues.has(agentId)) {
      throw new Error(`Agent ${agentId} is already registered`)
    }

    this.agentQueues.set(agentId, new PriorityQueue())
    this.agentLastSeen.set(agentId, this.clock.getCurrentHeartbeat())
    this.logger.info(`Agent ${agentId} registered`)
  }

  /**
   * Unregister an agent from the message bus
   *
   * @param agentId - Agent identifier to unregister
   */
  unregisterAgent(agentId: string): void {
    this.agentQueues.delete(agentId)
    this.agentLastSeen.delete(agentId)
    this.logger.info(`Agent ${agentId} unregistered`)
  }

  /**
   * Check if an agent is registered
   *
   * @param agentId - Agent identifier to check
   * @returns True if registered, false otherwise
   */
  isAgentRegistered(agentId: string): boolean {
    return this.agentQueues.has(agentId)
  }

  /**
   * Get list of all registered agent IDs
   *
   * @returns Array of agent IDs
   */
  getRegisteredAgents(): string[] {
    return Array.from(this.agentQueues.keys())
  }

  // === Message Operations ===

  /**
   * Send a message through the bus
   *
   * @param message - Message to send
   * @throws Error if message is invalid
   */
  sendMessage(message: Message): void {
    // Validate message
    MessageValidator.validateOrThrow(message)

    // Validate that message belongs to this task
    if (message.taskId !== this.taskId) {
      throw new Error(`Message taskId mismatch: expected ${this.taskId}, got ${message.taskId}`)
    }

    // Compress if enabled
    let processedMessage = message
    if (this.compressor) {
      processedMessage = this.compressor.compress(message)
    }

    // Route message
    this.router.routeMessage(processedMessage)

    // Record statistics
    this.statsCollector.recordMessage(message)

    // Persist to database
    this.persistMessage(message)

    this.logger.debug(`Message sent: ${message.id} (${message.from} -> ${message.to})`)
  }

  /**
   * Get messages for a specific agent
   *
   * @param agentId - Agent identifier
   * @returns Array of messages for the agent
   */
  getMessages(agentId: string): Message[] {
    const queue = this.agentQueues.get(agentId)
    if (!queue) {
      this.logger.warn(`Attempted to get messages for unregistered agent: ${agentId}`)
      return []
    }

    const messages = queue.dequeueAll()

    // Decompress if needed
    if (this.compressor) {
      const compressor = this.compressor
      return messages.map((msg) => compressor.decompress(msg))
    }

    return messages
  }

  /**
   * Update agent's last seen timestamp
   *
   * @param agentId - Agent identifier
   */
  updateAgentLastSeen(agentId: string): void {
    this.agentLastSeen.set(agentId, this.clock.getCurrentHeartbeat())
  }

  // === Heartbeat Handling ===

  /**
   * Internal heartbeat tick handler
   *
   * @param heartbeat - Current heartbeat number
   */
  private onHeartbeatTick(heartbeat: number): void {
    this.logger.debug(`Heartbeat #${heartbeat}`)

    // Check for timeout agents
    this.checkTimeouts(heartbeat)

    // Log heartbeat stats
    this.logHeartbeatStats(heartbeat)

    // Emit heartbeat event
    this.emit('heartbeat', heartbeat)
  }

  /**
   * Check for agents that have timed out
   *
   * @param currentHeartbeat - Current heartbeat number
   */
  private checkTimeouts(currentHeartbeat: number): void {
    const timeoutThreshold = this.config.timeoutThreshold
    const timeoutAgents: string[] = []

    for (const [agentId, lastSeen] of this.agentLastSeen) {
      const missedHeartbeats = currentHeartbeat - lastSeen

      if (missedHeartbeats > timeoutThreshold) {
        timeoutAgents.push(agentId)
        this.logger.warn(
          `Agent ${agentId} timeout (missed ${missedHeartbeats} heartbeats, threshold: ${timeoutThreshold})`
        )
      }
    }

    if (timeoutAgents.length > 0) {
      this.emit('agents_timeout', timeoutAgents)
    }
  }

  /**
   * Log heartbeat statistics
   *
   * @param heartbeat - Current heartbeat number
   */
  private logHeartbeatStats(heartbeat: number): void {
    const stats = this.getStats()

    this.logger.debug('Heartbeat stats', {
      heartbeat,
      agents: stats.totalAgents,
      queuedMessages: stats.totalQueuedMessages,
      healthyAgents: stats.healthyAgents,
    })
  }

  // === Health Check ===

  /**
   * Check if an agent is healthy (responding to heartbeats)
   *
   * @param agentId - Agent identifier
   * @returns True if healthy, false otherwise
   */
  checkAgentHealth(agentId: string): boolean {
    const lastSeen = this.agentLastSeen.get(agentId)
    if (lastSeen === undefined) {
      return false
    }

    const currentHeartbeat = this.clock.getCurrentHeartbeat()
    const missedHeartbeats = currentHeartbeat - lastSeen
    return missedHeartbeats <= this.config.timeoutThreshold
  }

  /**
   * Get the number of healthy agents
   *
   * @returns Count of healthy agents
   */
  private getHealthyAgentCount(): number {
    let count = 0
    for (const agentId of this.agentQueues.keys()) {
      if (this.checkAgentHealth(agentId)) {
        count++
      }
    }
    return count
  }

  // === Stats & Monitoring ===

  /**
   * Get current message bus statistics
   *
   * @returns Message bus statistics
   */
  getStats(): MessageBusStats {
    return {
      currentHeartbeat: this.clock.getCurrentHeartbeat(),
      totalAgents: this.agentQueues.size,
      totalQueuedMessages: this.getTotalQueuedMessages(),
      healthyAgents: this.getHealthyAgentCount(),
      messageStats: this.statsCollector.getStats(),
    }
  }

  /**
   * Get the total number of queued messages across all agents
   *
   * @returns Total queued message count
   */
  private getTotalQueuedMessages(): number {
    let total = 0
    for (const queue of this.agentQueues.values()) {
      total += queue.size()
    }
    return total
  }

  /**
   * Get the current heartbeat number
   *
   * @returns Current heartbeat count
   */
  getCurrentHeartbeat(): number {
    return this.clock.getCurrentHeartbeat()
  }

  /**
   * Get the elapsed time since bus started
   *
   * @returns Elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return this.clock.getElapsedTime()
  }

  // === Database Persistence ===

  /**
   * Persist a message to the database
   *
   * @param message - Message to persist
   */
  private persistMessage(message: Message): void {
    try {
      const stmt = this.database.prepare(`
        INSERT INTO messages (id, task_id, from_agent, to_agent, type, content, timestamp, heartbeat_number)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)

      stmt.run(
        message.id,
        message.taskId,
        message.from,
        message.to,
        message.type,
        JSON.stringify(message.content),
        message.timestamp,
        this.clock.getCurrentHeartbeat()
      )
    } catch (error) {
      this.logger.error('Failed to persist message to database', { error, messageId: message.id })
    }
  }
}
