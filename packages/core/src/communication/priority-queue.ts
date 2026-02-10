/**
 * Priority-based message queue implementation
 *
 * Messages are organized by priority levels (URGENT > HIGH > NORMAL > LOW)
 * and dequeued in priority order to ensure critical messages are processed first.
 */

import { Message, MessagePriority } from '../types/index.js'

/**
 * Priority queue for managing messages with different urgency levels
 */
export class PriorityQueue {
  private queues: Map<MessagePriority, Message[]>

  constructor() {
    this.queues = new Map()

    // Initialize a queue for each priority level
    for (const priority of Object.values(MessagePriority)) {
      if (typeof priority === 'number') {
        this.queues.set(priority, [])
      }
    }
  }

  /**
   * Add a message to the appropriate priority queue
   *
   * @param message - Message to enqueue
   */
  enqueue(message: Message): void {
    const priority = message.priority ?? MessagePriority.NORMAL
    const queue = this.queues.get(priority)

    if (!queue) {
      throw new Error(`Invalid priority: ${priority}`)
    }

    queue.push(message)
  }

  /**
   * Dequeue all messages in priority order (URGENT -> HIGH -> NORMAL -> LOW)
   *
   * @returns Array of messages sorted by priority
   */
  dequeueAll(): Message[] {
    const result: Message[] = []

    // Process in priority order: highest to lowest
    const priorities = [
      MessagePriority.URGENT,
      MessagePriority.HIGH,
      MessagePriority.NORMAL,
      MessagePriority.LOW,
    ]

    for (const priority of priorities) {
      const queue = this.queues.get(priority)
      if (queue) {
        result.push(...queue)
        queue.length = 0 // Clear the queue
      }
    }

    return result
  }

  /**
   * Get the total number of messages across all priority levels
   *
   * @returns Total message count
   */
  size(): number {
    let total = 0
    for (const queue of this.queues.values()) {
      total += queue.length
    }
    return total
  }

  /**
   * Peek at the highest priority message without removing it
   *
   * @returns The highest priority message or undefined if empty
   */
  peek(): Message | undefined {
    const priorities = [
      MessagePriority.URGENT,
      MessagePriority.HIGH,
      MessagePriority.NORMAL,
      MessagePriority.LOW,
    ]

    for (const priority of priorities) {
      const queue = this.queues.get(priority)
      if (queue && queue.length > 0) {
        return queue[0]
      }
    }

    return undefined
  }

  /**
   * Clear all messages from all priority queues
   */
  clear(): void {
    for (const queue of this.queues.values()) {
      queue.length = 0
    }
  }

  /**
   * Get the number of messages at a specific priority level
   *
   * @param priority - Priority level to check
   * @returns Number of messages at that priority
   */
  sizeAtPriority(priority: MessagePriority): number {
    const queue = this.queues.get(priority)
    return queue ? queue.length : 0
  }
}
