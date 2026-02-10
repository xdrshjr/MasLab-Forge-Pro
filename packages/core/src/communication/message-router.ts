/**
 * Message router for directing messages to appropriate agent queues
 *
 * Handles point-to-point, broadcast, and system message routing
 * with queue overflow protection and delivery tracking.
 */

import { Message } from '../types/index.js'
import { PriorityQueue } from './priority-queue.js'
import type { Logger } from 'pino'

/**
 * Message router configuration
 */
export interface MessageRouterConfig {
  maxQueueSize: number // Maximum messages per agent queue
}

/**
 * Message router class
 */
export class MessageRouter {
  private agentQueues: Map<string, PriorityQueue>
  private logger: Logger
  private config: MessageRouterConfig

  constructor(
    agentQueues: Map<string, PriorityQueue>,
    logger: Logger,
    config: MessageRouterConfig
  ) {
    this.agentQueues = agentQueues
    this.logger = logger
    this.config = config
  }

  /**
   * Route a message to its destination
   *
   * @param message - Message to route
   */
  routeMessage(message: Message): void {
    if (message.to === 'broadcast') {
      this.broadcastMessage(message)
    } else if (message.to === 'system') {
      this.handleSystemMessage(message)
    } else {
      this.routeToAgent(message)
    }
  }

  /**
   * Route a message to a specific agent
   *
   * @param message - Message to route
   */
  private routeToAgent(message: Message): void {
    const queue = this.agentQueues.get(message.to)

    if (!queue) {
      this.logger.warn(`Target agent ${message.to} not found, dropping message ${message.id}`)
      return
    }

    if (queue.size() >= this.config.maxQueueSize) {
      this.logger.error(
        `Queue full for agent ${message.to} (${queue.size()}/${this.config.maxQueueSize}), dropping message ${message.id}`
      )
      this.handleQueueOverflow(message)
      return
    }

    queue.enqueue(message)
    this.logger.debug(
      `Message routed: ${message.from} -> ${message.to} (type: ${message.type}, id: ${message.id})`
    )
  }

  /**
   * Broadcast a message to all agents except the sender
   *
   * @param message - Message to broadcast
   */
  private broadcastMessage(message: Message): void {
    let deliveredCount = 0
    let droppedCount = 0

    for (const [agentId, queue] of this.agentQueues) {
      // Don't send to self
      if (agentId === message.from) {
        continue
      }

      // Check queue capacity
      if (queue.size() < this.config.maxQueueSize) {
        const broadcastCopy = { ...message, to: agentId }
        queue.enqueue(broadcastCopy)
        deliveredCount++
      } else {
        droppedCount++
        this.logger.warn(
          `Queue full for agent ${agentId}, dropping broadcast message ${message.id}`
        )
      }
    }

    this.logger.debug(
      `Broadcast message ${message.id} delivered to ${deliveredCount} agents (${droppedCount} dropped)`
    )
  }

  /**
   * Handle system messages (e.g., heartbeat acknowledgments)
   *
   * @param message - System message to handle
   */
  private handleSystemMessage(message: Message): void {
    this.logger.debug(`System message received: ${message.type} from ${message.from}`)
    // System messages are handled by the message bus directly
    // This method is a placeholder for future system message handling
  }

  /**
   * Handle queue overflow situation
   *
   * @param message - Message that couldn't be delivered
   */
  private handleQueueOverflow(message: Message): void {
    // Log the overflow event
    this.logger.error({
      event: 'queue_overflow',
      targetAgent: message.to,
      messageId: message.id,
      messageType: message.type,
      from: message.from,
    })

    // In a production system, this could trigger:
    // - Alerting to system administrators
    // - Automatic scaling of agent capacity
    // - Message persistence to disk for later retry
    // - Backpressure signals to sending agents
  }
}
