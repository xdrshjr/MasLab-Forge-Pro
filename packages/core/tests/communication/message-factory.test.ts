/**
 * Tests for MessageFactory
 */

import { describe, it, expect } from 'vitest'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { MessageType, MessagePriority } from '../../src/types/index.js'

describe('MessageFactory', () => {
  const taskId = 'task-123'
  const from = 'agent-1'
  const to = 'agent-2'

  describe('createTaskAssign', () => {
    it('should create a task assignment message', () => {
      const task = {
        id: 'subtask-1',
        description: 'Implement feature X',
        deadline: Date.now() + 3600000,
        dependencies: [],
        context: { priority: 'high' },
      }

      const message = MessageFactory.createTaskAssign(from, to, taskId, task)

      expect(message.id).toBeDefined()
      expect(message.taskId).toBe(taskId)
      expect(message.from).toBe(from)
      expect(message.to).toBe(to)
      expect(message.type).toBe(MessageType.TASK_ASSIGN)
      expect(message.content).toEqual({ task })
      expect(message.priority).toBe(MessagePriority.NORMAL)
      expect(message.timestamp).toBeGreaterThan(0)
    })
  })

  describe('createProgressReport', () => {
    it('should create a progress report message', () => {
      const report = {
        taskId: 'subtask-1',
        status: 'in_progress' as const,
        percentage: 50,
        description: 'Half done',
        blockers: [],
      }

      const message = MessageFactory.createProgressReport(from, to, taskId, report)

      expect(message.id).toBeDefined()
      expect(message.taskId).toBe(taskId)
      expect(message.from).toBe(from)
      expect(message.to).toBe(to)
      expect(message.type).toBe(MessageType.PROGRESS_REPORT)
      expect(message.content).toEqual(report)
      expect(message.priority).toBe(MessagePriority.NORMAL)
    })
  })

  describe('createSignatureRequest', () => {
    it('should create a signature request message with HIGH priority', () => {
      const decision = {
        id: 'decision-1',
        type: 'technical_proposal',
        description: 'Approve architecture change',
        proposer: from,
        content: { details: 'Switch to microservices' },
        requireSigners: ['agent-2', 'agent-3'],
      }

      const message = MessageFactory.createSignatureRequest(from, to, taskId, decision)

      expect(message.id).toBeDefined()
      expect(message.type).toBe(MessageType.SIGNATURE_REQUEST)
      expect(message.content).toEqual({ decision })
      expect(message.priority).toBe(MessagePriority.HIGH)
    })
  })

  describe('createBroadcast', () => {
    it('should create a broadcast message', () => {
      const content = { announcement: 'System maintenance in 1 hour' }

      const message = MessageFactory.createBroadcast(
        from,
        taskId,
        MessageType.SYSTEM_COMMAND,
        content
      )

      expect(message.id).toBeDefined()
      expect(message.from).toBe(from)
      expect(message.to).toBe('broadcast')
      expect(message.type).toBe(MessageType.SYSTEM_COMMAND)
      expect(message.content).toEqual(content)
    })
  })

  describe('createHeartbeatAck', () => {
    it('should create a heartbeat acknowledgment message', () => {
      const heartbeatNumber = 42

      const message = MessageFactory.createHeartbeatAck(from, taskId, heartbeatNumber)

      expect(message.id).toBeDefined()
      expect(message.from).toBe(from)
      expect(message.to).toBe('system')
      expect(message.type).toBe(MessageType.HEARTBEAT_ACK)
      expect(message.content).toEqual({ heartbeatNumber })
      expect(message.priority).toBe(MessagePriority.LOW)
      expect(message.heartbeatNumber).toBe(heartbeatNumber)
    })
  })

  describe('createErrorReport', () => {
    it('should create an error report message with URGENT priority', () => {
      const error = {
        code: 'TASK_FAILED',
        message: 'Failed to execute task',
        details: { reason: 'Timeout' },
      }

      const message = MessageFactory.createErrorReport(from, to, taskId, error)

      expect(message.id).toBeDefined()
      expect(message.type).toBe(MessageType.ERROR_REPORT)
      expect(message.content).toEqual(error)
      expect(message.priority).toBe(MessagePriority.URGENT)
    })
  })

  describe('createMessage', () => {
    it('should create a generic message with default priority', () => {
      const content = { data: 'test' }

      const message = MessageFactory.createMessage(
        from,
        to,
        taskId,
        MessageType.PEER_COORDINATION,
        content
      )

      expect(message.id).toBeDefined()
      expect(message.type).toBe(MessageType.PEER_COORDINATION)
      expect(message.content).toEqual(content)
      expect(message.priority).toBe(MessagePriority.NORMAL)
    })

    it('should create a generic message with custom priority', () => {
      const content = { data: 'urgent' }

      const message = MessageFactory.createMessage(
        from,
        to,
        taskId,
        MessageType.PEER_COORDINATION,
        content,
        MessagePriority.URGENT
      )

      expect(message.priority).toBe(MessagePriority.URGENT)
    })
  })
})
