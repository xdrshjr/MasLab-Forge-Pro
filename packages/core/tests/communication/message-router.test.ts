/**
 * Tests for MessageRouter
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { MessageRouter } from '../../src/communication/message-router.js'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { PriorityQueue } from '../../src/communication/priority-queue.js'
import { MessageType, MessagePriority } from '../../src/types/index.js'
import type { Logger } from 'pino'

describe('MessageRouter', () => {
  let router: MessageRouter
  let agentQueues: Map<string, PriorityQueue>
  let mockLogger: Logger

  beforeEach(() => {
    agentQueues = new Map()
    agentQueues.set('agent-1', new PriorityQueue())
    agentQueues.set('agent-2', new PriorityQueue())
    agentQueues.set('agent-3', new PriorityQueue())

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any

    router = new MessageRouter(agentQueues, mockLogger, { maxQueueSize: 10 })
  })

  describe('routeMessage', () => {
    it('should route point-to-point message to target agent', () => {
      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      router.routeMessage(message)

      const queue = agentQueues.get('agent-2')!
      expect(queue.size()).toBe(1)
      expect(queue.peek()?.id).toBe(message.id)
    })

    it('should route broadcast message to all agents except sender', () => {
      const message = MessageFactory.createBroadcast(
        'agent-1',
        'task-1',
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )

      router.routeMessage(message)

      expect(agentQueues.get('agent-1')!.size()).toBe(0) // Sender doesn't receive
      expect(agentQueues.get('agent-2')!.size()).toBe(1)
      expect(agentQueues.get('agent-3')!.size()).toBe(1)
    })

    it('should route system message to system handler', () => {
      const message = MessageFactory.createHeartbeatAck('agent-1', 'task-1', 1)

      router.routeMessage(message)

      // System messages are logged but not queued
      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('System message received')
      )
    })

    it('should log warning for non-existent target agent', () => {
      const message = MessageFactory.createMessage(
        'agent-1',
        'non-existent-agent',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      router.routeMessage(message)

      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Target agent non-existent-agent not found')
      )
    })

    it('should handle queue overflow gracefully', () => {
      const smallRouter = new MessageRouter(agentQueues, mockLogger, { maxQueueSize: 2 })

      // Fill queue to capacity
      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '2' }
      )
      const msg3 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '3' }
      )

      smallRouter.routeMessage(msg1)
      smallRouter.routeMessage(msg2)
      smallRouter.routeMessage(msg3) // Should be dropped

      const queue = agentQueues.get('agent-2')!
      expect(queue.size()).toBe(2)
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Queue full for agent agent-2')
      )
    })
  })

  describe('point-to-point routing', () => {
    it('should preserve message priority', () => {
      const urgentMsg = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.ERROR_REPORT,
        { error: 'critical' },
        MessagePriority.URGENT
      )

      router.routeMessage(urgentMsg)

      const queue = agentQueues.get('agent-2')!
      const peeked = queue.peek()
      expect(peeked?.priority).toBe(MessagePriority.URGENT)
    })

    it('should route multiple messages to same agent', () => {
      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.PROGRESS_REPORT,
        { data: '2' }
      )

      router.routeMessage(msg1)
      router.routeMessage(msg2)

      const queue = agentQueues.get('agent-2')!
      expect(queue.size()).toBe(2)
    })

    it('should route messages from multiple senders', () => {
      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-3',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-2',
        'agent-3',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '2' }
      )

      router.routeMessage(msg1)
      router.routeMessage(msg2)

      const queue = agentQueues.get('agent-3')!
      expect(queue.size()).toBe(2)
    })

    it('should log routing details', () => {
      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      router.routeMessage(message)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Message routed: agent-1 -> agent-2')
      )
    })
  })

  describe('broadcast routing', () => {
    it('should create separate message copy for each recipient', () => {
      const message = MessageFactory.createBroadcast(
        'agent-1',
        'task-1',
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )

      router.routeMessage(message)

      const msg2 = agentQueues.get('agent-2')!.peek()!
      const msg3 = agentQueues.get('agent-3')!.peek()!

      expect(msg2.to).toBe('agent-2')
      expect(msg3.to).toBe('agent-3')
      expect(msg2.id).toBe(msg3.id) // Same original message
    })

    it('should not send broadcast to sender', () => {
      const message = MessageFactory.createBroadcast(
        'agent-2',
        'task-1',
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )

      router.routeMessage(message)

      expect(agentQueues.get('agent-1')!.size()).toBe(1)
      expect(agentQueues.get('agent-2')!.size()).toBe(0) // Sender
      expect(agentQueues.get('agent-3')!.size()).toBe(1)
    })

    it('should skip agents with full queues during broadcast', () => {
      const smallRouter = new MessageRouter(agentQueues, mockLogger, { maxQueueSize: 1 })

      // Fill agent-2 queue
      const fillMsg = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'fill' }
      )
      smallRouter.routeMessage(fillMsg)

      // Broadcast
      const broadcast = MessageFactory.createBroadcast(
        'agent-1',
        'task-1',
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )
      smallRouter.routeMessage(broadcast)

      expect(agentQueues.get('agent-2')!.size()).toBe(1) // Still just the fill message
      expect(agentQueues.get('agent-3')!.size()).toBe(1) // Got broadcast
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('Queue full for agent agent-2')
      )
    })

    it('should log broadcast delivery count', () => {
      const message = MessageFactory.createBroadcast(
        'agent-1',
        'task-1',
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )

      router.routeMessage(message)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('Broadcast message')
      )
      expect(mockLogger.debug).toHaveBeenCalledWith(expect.stringContaining('delivered to 2 agents'))
    })

    it('should handle broadcast with no recipients', () => {
      const emptyQueues = new Map<string, PriorityQueue>()
      emptyQueues.set('agent-1', new PriorityQueue())

      const emptyRouter = new MessageRouter(emptyQueues, mockLogger, { maxQueueSize: 10 })

      const message = MessageFactory.createBroadcast(
        'agent-1',
        'task-1',
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )

      emptyRouter.routeMessage(message)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('delivered to 0 agents')
      )
    })
  })

  describe('system message handling', () => {
    it('should handle heartbeat acknowledgment', () => {
      const message = MessageFactory.createHeartbeatAck('agent-1', 'task-1', 5)

      router.routeMessage(message)

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.stringContaining('System message received: heartbeat_ack from agent-1')
      )
    })

    it('should not queue system messages', () => {
      const message = MessageFactory.createHeartbeatAck('agent-1', 'task-1', 1)

      router.routeMessage(message)

      // No agent should have received this
      for (const queue of agentQueues.values()) {
        expect(queue.size()).toBe(0)
      }
    })
  })

  describe('queue overflow handling', () => {
    it('should log overflow event with details', () => {
      const smallRouter = new MessageRouter(agentQueues, mockLogger, { maxQueueSize: 0 })

      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      smallRouter.routeMessage(message)

      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          event: 'queue_overflow',
          targetAgent: 'agent-2',
          messageId: message.id,
          messageType: MessageType.TASK_ASSIGN,
          from: 'agent-1',
        })
      )
    })

    it('should drop message when queue is full', () => {
      const smallRouter = new MessageRouter(agentQueues, mockLogger, { maxQueueSize: 1 })

      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: '2' }
      )

      smallRouter.routeMessage(msg1)
      smallRouter.routeMessage(msg2)

      const queue = agentQueues.get('agent-2')!
      expect(queue.size()).toBe(1)
      expect(queue.peek()?.id).toBe(msg1.id) // Only first message
    })
  })

  describe('edge cases', () => {
    it('should handle routing to agent with empty queue', () => {
      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      router.routeMessage(message)

      expect(agentQueues.get('agent-2')!.size()).toBe(1)
    })

    it('should handle multiple message types', () => {
      const types = [
        MessageType.TASK_ASSIGN,
        MessageType.PROGRESS_REPORT,
        MessageType.SIGNATURE_REQUEST,
        MessageType.ERROR_REPORT,
      ]

      for (const type of types) {
        const msg = MessageFactory.createMessage('agent-1', 'agent-2', 'task-1', type, {})
        router.routeMessage(msg)
      }

      expect(agentQueues.get('agent-2')!.size()).toBe(4)
    })

    it('should handle agent sending to itself', () => {
      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-1',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'self' }
      )

      router.routeMessage(message)

      expect(agentQueues.get('agent-1')!.size()).toBe(1)
    })
  })
})
