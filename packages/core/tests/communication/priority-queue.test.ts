/**
 * Tests for PriorityQueue
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { PriorityQueue } from '../../src/communication/priority-queue.js'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { MessageType, MessagePriority } from '../../src/types/index.js'

describe('PriorityQueue', () => {
  let queue: PriorityQueue

  beforeEach(() => {
    queue = new PriorityQueue()
  })

  describe('enqueue and dequeueAll', () => {
    it('should enqueue and dequeue messages in priority order', () => {
      const msg1 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        {},
        MessagePriority.NORMAL
      )
      const msg2 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.ERROR_REPORT,
        {},
        MessagePriority.URGENT
      )
      const msg3 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.PROGRESS_REPORT,
        {},
        MessagePriority.LOW
      )
      const msg4 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        {},
        MessagePriority.HIGH
      )

      queue.enqueue(msg1)
      queue.enqueue(msg2)
      queue.enqueue(msg3)
      queue.enqueue(msg4)

      const messages = queue.dequeueAll()

      expect(messages).toHaveLength(4)
      expect(messages[0].id).toBe(msg2.id) // URGENT first
      expect(messages[1].id).toBe(msg4.id) // HIGH second
      expect(messages[2].id).toBe(msg1.id) // NORMAL third
      expect(messages[3].id).toBe(msg3.id) // LOW last
    })

    it('should handle messages with default priority', () => {
      const msg = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      // Remove priority to test default
      delete (msg as any).priority

      queue.enqueue(msg)

      const messages = queue.dequeueAll()
      expect(messages).toHaveLength(1)
      expect(messages[0].id).toBe(msg.id)
    })

    it('should clear queue after dequeueAll', () => {
      const msg = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      queue.enqueue(msg)

      queue.dequeueAll()

      expect(queue.size()).toBe(0)
    })
  })

  describe('size', () => {
    it('should return 0 for empty queue', () => {
      expect(queue.size()).toBe(0)
    })

    it('should return correct size after enqueuing messages', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_COMPLETE, {})

      queue.enqueue(msg1)
      expect(queue.size()).toBe(1)

      queue.enqueue(msg2)
      expect(queue.size()).toBe(2)
    })
  })

  describe('peek', () => {
    it('should return undefined for empty queue', () => {
      expect(queue.peek()).toBeUndefined()
    })

    it('should return highest priority message without removing it', () => {
      const msg1 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        {},
        MessagePriority.NORMAL
      )
      const msg2 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.ERROR_REPORT,
        {},
        MessagePriority.URGENT
      )

      queue.enqueue(msg1)
      queue.enqueue(msg2)

      const peeked = queue.peek()
      expect(peeked?.id).toBe(msg2.id) // URGENT message
      expect(queue.size()).toBe(2) // Size unchanged
    })
  })

  describe('clear', () => {
    it('should clear all messages from queue', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_COMPLETE, {})

      queue.enqueue(msg1)
      queue.enqueue(msg2)

      queue.clear()

      expect(queue.size()).toBe(0)
      expect(queue.peek()).toBeUndefined()
    })
  })

  describe('sizeAtPriority', () => {
    it('should return correct count for specific priority level', () => {
      const msg1 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        {},
        MessagePriority.NORMAL
      )
      const msg2 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_COMPLETE,
        {},
        MessagePriority.NORMAL
      )
      const msg3 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.ERROR_REPORT,
        {},
        MessagePriority.URGENT
      )

      queue.enqueue(msg1)
      queue.enqueue(msg2)
      queue.enqueue(msg3)

      expect(queue.sizeAtPriority(MessagePriority.NORMAL)).toBe(2)
      expect(queue.sizeAtPriority(MessagePriority.URGENT)).toBe(1)
      expect(queue.sizeAtPriority(MessagePriority.LOW)).toBe(0)
    })
  })

  describe('FIFO within same priority', () => {
    it('should maintain FIFO order for messages with same priority', () => {
      const msg1 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { order: 1 },
        MessagePriority.NORMAL
      )
      const msg2 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_COMPLETE,
        { order: 2 },
        MessagePriority.NORMAL
      )
      const msg3 = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.PROGRESS_REPORT,
        { order: 3 },
        MessagePriority.NORMAL
      )

      queue.enqueue(msg1)
      queue.enqueue(msg2)
      queue.enqueue(msg3)

      const messages = queue.dequeueAll()

      expect(messages[0].id).toBe(msg1.id)
      expect(messages[1].id).toBe(msg2.id)
      expect(messages[2].id).toBe(msg3.id)
    })
  })
})
