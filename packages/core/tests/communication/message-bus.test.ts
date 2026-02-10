/**
 * Integration tests for MessageBus
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { MessageBus } from '../../src/communication/message-bus.js'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { MessageType, MessagePriority } from '../../src/types/index.js'
import { DatabaseManager } from '../../src/persistence/database.js'
import type { Database } from 'better-sqlite3'
import type { Logger } from 'pino'

describe('MessageBus', () => {
  let bus: MessageBus
  let database: Database
  let dbManager: DatabaseManager
  let mockLogger: Logger
  const taskId = 'test-task-123'

  beforeEach(() => {
    vi.useFakeTimers()

    dbManager = new DatabaseManager({ path: ':memory:' })
    dbManager.initialize()
    database = dbManager.getDatabase()

    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn(() => mockLogger),
    } as any

    bus = new MessageBus(
      {
        heartbeatInterval: 1000,
        maxQueueSize: 100,
        timeoutThreshold: 3,
        enableCompression: false,
      },
      database,
      mockLogger,
      taskId
    )
  })

  afterEach(() => {
    if (bus) {
      bus.stop()
    }
    if (dbManager) {
      dbManager.close()
    }
    vi.restoreAllMocks()
  })

  describe('lifecycle management', () => {
    it('should start the message bus', () => {
      bus.start()

      expect(mockLogger.info).toHaveBeenCalledWith(
        'MessageBus started',
        expect.objectContaining({
          heartbeatInterval: 1000,
          maxQueueSize: 100,
          timeoutThreshold: 3,
        })
      )
    })

    it('should stop the message bus', () => {
      bus.start()
      bus.stop()

      expect(mockLogger.info).toHaveBeenCalledWith('MessageBus stopped')
    })

    it('should emit heartbeat events', () => {
      const heartbeatListener = vi.fn()
      bus.on('heartbeat', heartbeatListener)

      bus.start()

      vi.advanceTimersByTime(1000)
      expect(heartbeatListener).toHaveBeenCalledWith(1)

      vi.advanceTimersByTime(1000)
      expect(heartbeatListener).toHaveBeenCalledWith(2)
    })

    it('should track elapsed time', () => {
      bus.start()

      expect(bus.getElapsedTime()).toBe(0)

      vi.advanceTimersByTime(3000)
      expect(bus.getElapsedTime()).toBe(3000)
    })

    it('should track current heartbeat', () => {
      bus.start()

      expect(bus.getCurrentHeartbeat()).toBe(0)

      vi.advanceTimersByTime(2000)
      expect(bus.getCurrentHeartbeat()).toBe(2)
    })
  })

  describe('agent management', () => {
    it('should register an agent', () => {
      bus.registerAgent('agent-1')

      expect(bus.isAgentRegistered('agent-1')).toBe(true)
      expect(mockLogger.info).toHaveBeenCalledWith('Agent agent-1 registered')
    })

    it('should throw error when registering duplicate agent', () => {
      bus.registerAgent('agent-1')

      expect(() => bus.registerAgent('agent-1')).toThrow(
        'Agent agent-1 is already registered'
      )
    })

    it('should unregister an agent', () => {
      bus.registerAgent('agent-1')
      bus.unregisterAgent('agent-1')

      expect(bus.isAgentRegistered('agent-1')).toBe(false)
      expect(mockLogger.info).toHaveBeenCalledWith('Agent agent-1 unregistered')
    })

    it('should get list of registered agents', () => {
      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.registerAgent('agent-3')

      const agents = bus.getRegisteredAgents()
      expect(agents).toHaveLength(3)
      expect(agents).toContain('agent-1')
      expect(agents).toContain('agent-2')
      expect(agents).toContain('agent-3')
    })

    it('should handle unregistering non-existent agent', () => {
      expect(() => bus.unregisterAgent('non-existent')).not.toThrow()
    })
  })

  describe('message operations', () => {
    beforeEach(() => {
      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.registerAgent('agent-3')
    })

    it('should send and receive point-to-point message', () => {
      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      bus.sendMessage(message)

      const messages = bus.getMessages('agent-2')
      expect(messages).toHaveLength(1)
      expect(messages[0].id).toBe(message.id)
      expect(messages[0].from).toBe('agent-1')
    })

    it('should send broadcast message to all agents except sender', () => {
      const message = MessageFactory.createBroadcast(
        'agent-1',
        taskId,
        MessageType.SYSTEM_COMMAND,
        { announcement: 'test' }
      )

      bus.sendMessage(message)

      expect(bus.getMessages('agent-1')).toHaveLength(0) // Sender
      expect(bus.getMessages('agent-2')).toHaveLength(1)
      expect(bus.getMessages('agent-3')).toHaveLength(1)
    })

    it('should validate messages before sending', () => {
      const invalidMessage = {
        id: '',
        from: 'agent-1',
        to: 'agent-2',
        type: MessageType.TASK_ASSIGN,
        content: { data: 'test' },
        timestamp: Date.now(),
        taskId,
      }

      expect(() => bus.sendMessage(invalidMessage as any)).toThrow('Invalid message')
    })

    it('should persist messages to database', () => {
      // Create task first (required by foreign key constraint)
      database
        .prepare(
          'INSERT INTO tasks (id, description, status, mode, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(taskId, 'Test task', 'running', 'auto', Date.now())

      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      bus.sendMessage(message)

      const stmt = database.prepare('SELECT * FROM messages WHERE id = ?')
      const row = stmt.get(message.id) as any

      expect(row).toBeDefined()
      expect(row.from_agent).toBe('agent-1')
      expect(row.to_agent).toBe('agent-2')
      expect(row.task_id).toBe(taskId)
      expect(row.type).toBe(MessageType.TASK_ASSIGN)
    })

    it('should clear queue after getting messages', () => {
      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: '2' }
      )

      bus.sendMessage(msg1)
      bus.sendMessage(msg2)

      const messages = bus.getMessages('agent-2')
      expect(messages).toHaveLength(2)

      const messagesAgain = bus.getMessages('agent-2')
      expect(messagesAgain).toHaveLength(0) // Queue cleared
    })

    it('should return empty array for unregistered agent', () => {
      const messages = bus.getMessages('non-existent')
      expect(messages).toHaveLength(0)
      expect(mockLogger.warn).toHaveBeenCalledWith(
        expect.stringContaining('unregistered agent')
      )
    })

    it('should respect message priority', () => {
      const normalMsg = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: 'normal' },
        MessagePriority.NORMAL
      )
      const urgentMsg = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.ERROR_REPORT,
        { data: 'urgent' },
        MessagePriority.URGENT
      )

      bus.sendMessage(normalMsg)
      bus.sendMessage(urgentMsg)

      const messages = bus.getMessages('agent-2')
      expect(messages[0].id).toBe(urgentMsg.id) // Urgent first
      expect(messages[1].id).toBe(normalMsg.id)
    })
  })

  describe('heartbeat and timeout detection', () => {
    beforeEach(() => {
      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.start()
    })

    it('should update agent last seen on updateAgentLastSeen', () => {
      vi.advanceTimersByTime(2000) // 2 heartbeats

      bus.updateAgentLastSeen('agent-1')

      expect(bus.checkAgentHealth('agent-1')).toBe(true)
    })

    it('should detect agent timeout', (done) => {
      bus.on('agents_timeout', (agents: string[]) => {
        expect(agents).toContain('agent-1')
        done()
      })

      // Don't update agent-1, let it timeout
      vi.advanceTimersByTime(4000) // 4 heartbeats > threshold of 3
    })

    it('should not timeout agents that respond', () => {
      const timeoutListener = vi.fn()
      bus.on('agents_timeout', timeoutListener)

      vi.advanceTimersByTime(1000)
      bus.updateAgentLastSeen('agent-1')

      vi.advanceTimersByTime(1000)
      bus.updateAgentLastSeen('agent-1')

      vi.advanceTimersByTime(1000)
      bus.updateAgentLastSeen('agent-1')

      expect(timeoutListener).not.toHaveBeenCalled()
    })

    it('should check agent health correctly', () => {
      expect(bus.checkAgentHealth('agent-1')).toBe(true) // Just registered

      vi.advanceTimersByTime(4000) // 4 heartbeats

      expect(bus.checkAgentHealth('agent-1')).toBe(false) // Timed out
    })

    it('should return false for non-existent agent health check', () => {
      expect(bus.checkAgentHealth('non-existent')).toBe(false)
    })
  })

  describe('statistics and monitoring', () => {
    beforeEach(() => {
      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.start()
    })

    it('should track message statistics', () => {
      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-2',
        'agent-1',
        taskId,
        MessageType.PROGRESS_REPORT,
        { data: '2' }
      )

      bus.sendMessage(msg1)
      bus.sendMessage(msg2)

      const stats = bus.getStats()
      expect(stats.messageStats.totalMessages).toBe(2)
      expect(stats.messageStats.messagesByType[MessageType.TASK_ASSIGN]).toBe(1)
      expect(stats.messageStats.messagesByType[MessageType.PROGRESS_REPORT]).toBe(1)
    })

    it('should track agent statistics', () => {
      const msg = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      bus.sendMessage(msg)

      const stats = bus.getStats()
      expect(stats.messageStats.messagesByAgent['agent-1'].sent).toBe(1)
      expect(stats.messageStats.messagesByAgent['agent-2'].received).toBe(1)
    })

    it('should track total agents', () => {
      const stats = bus.getStats()
      expect(stats.totalAgents).toBe(2)
    })

    it('should track queued messages', () => {
      const msg1 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: '1' }
      )
      const msg2 = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: '2' }
      )

      bus.sendMessage(msg1)
      bus.sendMessage(msg2)

      const stats = bus.getStats()
      expect(stats.totalQueuedMessages).toBe(2)

      bus.getMessages('agent-2') // Clear queue

      const statsAfter = bus.getStats()
      expect(statsAfter.totalQueuedMessages).toBe(0)
    })

    it('should track healthy agents', () => {
      bus.updateAgentLastSeen('agent-1')
      bus.updateAgentLastSeen('agent-2')

      const stats = bus.getStats()
      expect(stats.healthyAgents).toBe(2)

      vi.advanceTimersByTime(4000) // Timeout both

      const statsAfter = bus.getStats()
      expect(statsAfter.healthyAgents).toBe(0)
    })

    it('should track current heartbeat in stats', () => {
      vi.advanceTimersByTime(3000)

      const stats = bus.getStats()
      expect(stats.currentHeartbeat).toBe(3)
    })
  })

  describe('message compression', () => {
    it('should compress large messages when enabled', () => {
      const compressingBus = new MessageBus(
        {
          heartbeatInterval: 1000,
          maxQueueSize: 100,
          timeoutThreshold: 3,
          enableCompression: true,
          compressionThreshold: 100,
        },
        database,
        mockLogger,
        taskId
      )

      compressingBus.registerAgent('agent-1')
      compressingBus.registerAgent('agent-2')

      const largeContent = { data: 'x'.repeat(500) }
      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        largeContent
      )

      compressingBus.sendMessage(message)

      const messages = compressingBus.getMessages('agent-2')
      expect(messages).toHaveLength(1)
      expect(messages[0].content).toEqual(largeContent) // Decompressed automatically

      compressingBus.stop()
    })

    it('should not compress when disabled', () => {
      const msg = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(500) }
      )

      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.sendMessage(msg)

      const messages = bus.getMessages('agent-2')
      expect(messages[0].content).toEqual({ data: 'x'.repeat(500) })
    })
  })

  describe('error handling', () => {
    it('should handle database persistence errors gracefully', () => {
      // Close database to cause error
      dbManager.close()

      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')

      const message = MessageFactory.createMessage(
        'agent-1',
        'agent-2',
        taskId,
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      // Should not throw, just log error
      expect(() => bus.sendMessage(message)).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist message'),
        expect.any(Object)
      )
    })
  })

  describe('integration scenarios', () => {
    it('should handle complete message flow', () => {
      // Create task first (required by foreign key constraint)
      database
        .prepare(
          'INSERT INTO tasks (id, description, status, mode, created_at) VALUES (?, ?, ?, ?, ?)'
        )
        .run(taskId, 'Test task', 'running', 'auto', Date.now())

      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')
      bus.start()

      // Agent 1 sends task to Agent 2
      const taskMsg = MessageFactory.createTaskAssign('agent-1', 'agent-2', taskId, {
        id: 'subtask-1',
        description: 'Do something',
      })
      bus.sendMessage(taskMsg)

      // Agent 2 receives and processes
      const receivedTasks = bus.getMessages('agent-2')
      expect(receivedTasks).toHaveLength(1)

      // Advance time and update agent-2's last seen to keep it healthy
      vi.advanceTimersByTime(1000)
      bus.updateAgentLastSeen('agent-2')

      // Agent 2 sends progress report back
      const progressMsg = MessageFactory.createProgressReport('agent-2', 'agent-1', taskId, {
        taskId: 'subtask-1',
        status: 'in_progress',
        percentage: 50,
        description: 'Working on it',
      })
      bus.sendMessage(progressMsg)

      // Agent 1 receives progress
      const receivedProgress = bus.getMessages('agent-1')
      expect(receivedProgress).toHaveLength(1)
      expect(receivedProgress[0].type).toBe(MessageType.PROGRESS_REPORT)

      // Advance time to timeout agent-1 (which hasn't updated last seen)
      vi.advanceTimersByTime(3000) // Total 4 heartbeats > threshold of 3

      // Check statistics
      const stats = bus.getStats()
      expect(stats.messageStats.totalMessages).toBe(2)
      expect(stats.healthyAgents).toBe(1) // Only agent-2 is healthy (agent-1 timed out)
    })

    it('should handle high message volume', () => {
      bus.registerAgent('agent-1')
      bus.registerAgent('agent-2')

      for (let i = 0; i < 100; i++) {
        const msg = MessageFactory.createMessage(
          'agent-1',
          'agent-2',
          taskId,
          MessageType.TASK_ASSIGN,
          { index: i }
        )
        bus.sendMessage(msg)
      }

      const messages = bus.getMessages('agent-2')
      expect(messages).toHaveLength(100)

      const stats = bus.getStats()
      expect(stats.messageStats.totalMessages).toBe(100)
    })

    it('should handle multiple agents communicating', () => {
      const agents = ['agent-1', 'agent-2', 'agent-3', 'agent-4']
      agents.forEach((agent) => bus.registerAgent(agent))

      // Each agent sends to every other agent
      for (const from of agents) {
        for (const to of agents) {
          if (from !== to) {
            const msg = MessageFactory.createMessage(
              from,
              to,
              taskId,
              MessageType.PEER_COORDINATION,
              { from, to }
            )
            bus.sendMessage(msg)
          }
        }
      }

      // Each agent should receive 3 messages (from 3 other agents)
      for (const agent of agents) {
        const messages = bus.getMessages(agent)
        expect(messages).toHaveLength(3)
      }
    })
  })
})
