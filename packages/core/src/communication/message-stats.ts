/**
 * Message statistics collector
 *
 * Tracks message flow metrics for monitoring and debugging,
 * including counts by type, agent, and overall throughput.
 */

import { Message, MessageType } from '../types/index.js'

/**
 * Agent message statistics
 */
export interface AgentMessageStats {
  sent: number
  received: number
}

/**
 * Overall message statistics
 */
export interface MessageStats {
  totalMessages: number
  messagesByType: Record<string, number>
  messagesByAgent: Record<string, AgentMessageStats>
}

/**
 * Message statistics collector class
 */
export class MessageStatsCollector {
  private stats: {
    totalMessages: number
    messagesByType: Map<string, number>
    messagesByAgent: Map<string, AgentMessageStats>
  }

  constructor() {
    this.stats = {
      totalMessages: 0,
      messagesByType: new Map(),
      messagesByAgent: new Map(),
    }
  }

  /**
   * Record a message for statistics tracking
   *
   * @param message - Message to record
   */
  recordMessage(message: Message): void {
    this.stats.totalMessages++

    // Track by message type
    const typeCount = this.stats.messagesByType.get(message.type) || 0
    this.stats.messagesByType.set(message.type, typeCount + 1)

    // Track by sender
    if (!this.stats.messagesByAgent.has(message.from)) {
      this.stats.messagesByAgent.set(message.from, { sent: 0, received: 0 })
    }
    const senderStats = this.stats.messagesByAgent.get(message.from)!
    senderStats.sent++

    // Track by receiver (skip broadcast and system)
    if (message.to !== 'broadcast' && message.to !== 'system') {
      if (!this.stats.messagesByAgent.has(message.to)) {
        this.stats.messagesByAgent.set(message.to, { sent: 0, received: 0 })
      }
      const receiverStats = this.stats.messagesByAgent.get(message.to)!
      receiverStats.received++
    }
  }

  /**
   * Get current statistics snapshot
   *
   * @returns Current message statistics
   */
  getStats(): MessageStats {
    return {
      totalMessages: this.stats.totalMessages,
      messagesByType: Object.fromEntries(this.stats.messagesByType),
      messagesByAgent: Object.fromEntries(this.stats.messagesByAgent),
    }
  }

  /**
   * Reset all statistics to zero
   */
  reset(): void {
    this.stats.totalMessages = 0
    this.stats.messagesByType.clear()
    this.stats.messagesByAgent.clear()
  }

  /**
   * Get statistics for a specific agent
   *
   * @param agentId - Agent ID to query
   * @returns Agent statistics or undefined if not found
   */
  getAgentStats(agentId: string): AgentMessageStats | undefined {
    return this.stats.messagesByAgent.get(agentId)
  }

  /**
   * Get count for a specific message type
   *
   * @param type - Message type to query
   * @returns Count of messages of that type
   */
  getTypeCount(type: MessageType): number {
    return this.stats.messagesByType.get(type) || 0
  }
}
