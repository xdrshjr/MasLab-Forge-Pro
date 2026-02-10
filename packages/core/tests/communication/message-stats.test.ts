/**
 * Tests for MessageStatsCollector
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MessageStatsCollector } from '../../src/communication/message-stats.js'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { MessageType } from '../../src/types/index.js'

describe('MessageStatsCollector', () => {
  let collector: MessageStatsCollector

  beforeEach(() => {
    collector = new MessageStatsCollector()
  })

  describe('recordMessage', () => {
    it('should increment total message count', () => {
      const msg = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})

      collector.recordMessage(msg)

      const stats = collector.getStats()
      expect(stats.totalMessages).toBe(1)
    })

    it('should track multiple messages', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a2', 'a3', 'task-1', MessageType.PROGRESS_REPORT, {})
      const msg3 = MessageFactory.createMessage('a3', 'a1', 'task-1', MessageType.TASK_COMPLETE, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)
      collector.recordMessage(msg3)

      const stats = collector.getStats()
      expect(stats.totalMessages).toBe(3)
    })

    it('should track messages by type', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg3 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)
      collector.recordMessage(msg3)

      const stats = collector.getStats()
      expect(stats.messagesByType[MessageType.TASK_ASSIGN]).toBe(2)
      expect(stats.messagesByType[MessageType.PROGRESS_REPORT]).toBe(1)
    })

    it('should track sent messages by agent', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a1', 'a3', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg3 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)
      collector.recordMessage(msg3)

      const stats = collector.getStats()
      expect(stats.messagesByAgent['a1'].sent).toBe(2)
      expect(stats.messagesByAgent['a2'].sent).toBe(1)
    })

    it('should track received messages by agent', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a3', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg3 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)
      collector.recordMessage(msg3)

      const stats = collector.getStats()
      expect(stats.messagesByAgent['a2'].received).toBe(2)
      expect(stats.messagesByAgent['a1'].received).toBe(1)
    })

    it('should initialize agent stats on first message', () => {
      const msg = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})

      collector.recordMessage(msg)

      const stats = collector.getStats()
      expect(stats.messagesByAgent['a1']).toEqual({ sent: 1, received: 0 })
      expect(stats.messagesByAgent['a2']).toEqual({ sent: 0, received: 1 })
    })

    it('should not track broadcast messages as received', () => {
      const msg = MessageFactory.createBroadcast('a1', 'task-1', MessageType.SYSTEM_COMMAND, {})

      collector.recordMessage(msg)

      const stats = collector.getStats()
      expect(stats.messagesByAgent['a1'].sent).toBe(1)
      expect(stats.messagesByAgent['broadcast']).toBeUndefined()
    })

    it('should not track system messages as received', () => {
      const msg = MessageFactory.createHeartbeatAck('a1', 'task-1', 1)

      collector.recordMessage(msg)

      const stats = collector.getStats()
      expect(stats.messagesByAgent['a1'].sent).toBe(1)
      expect(stats.messagesByAgent['system']).toBeUndefined()
    })
  })

  describe('getStats', () => {
    it('should return empty stats initially', () => {
      const stats = collector.getStats()

      expect(stats.totalMessages).toBe(0)
      expect(stats.messagesByType).toEqual({})
      expect(stats.messagesByAgent).toEqual({})
    })

    it('should return snapshot of current stats', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)

      const stats = collector.getStats()

      expect(stats.totalMessages).toBe(2)
      expect(Object.keys(stats.messagesByType)).toHaveLength(2)
      expect(Object.keys(stats.messagesByAgent)).toHaveLength(2)
    })

    it('should return plain objects not Maps', () => {
      const msg = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      collector.recordMessage(msg)

      const stats = collector.getStats()

      expect(stats.messagesByType).toBeInstanceOf(Object)
      expect(stats.messagesByType).not.toBeInstanceOf(Map)
      expect(stats.messagesByAgent).toBeInstanceOf(Object)
      expect(stats.messagesByAgent).not.toBeInstanceOf(Map)
    })
  })

  describe('reset', () => {
    it('should reset all statistics to zero', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)

      collector.reset()

      const stats = collector.getStats()
      expect(stats.totalMessages).toBe(0)
      expect(stats.messagesByType).toEqual({})
      expect(stats.messagesByAgent).toEqual({})
    })

    it('should allow recording after reset', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      collector.recordMessage(msg1)

      collector.reset()

      const msg2 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})
      collector.recordMessage(msg2)

      const stats = collector.getStats()
      expect(stats.totalMessages).toBe(1)
    })
  })

  describe('getAgentStats', () => {
    it('should return undefined for unknown agent', () => {
      const stats = collector.getAgentStats('unknown-agent')
      expect(stats).toBeUndefined()
    })

    it('should return stats for known agent', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a1', 'a3', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg3 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)
      collector.recordMessage(msg3)

      const a1Stats = collector.getAgentStats('a1')
      expect(a1Stats).toEqual({ sent: 2, received: 1 })
    })

    it('should return separate stats for each agent', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a2', 'a1', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)

      const a1Stats = collector.getAgentStats('a1')
      const a2Stats = collector.getAgentStats('a2')

      expect(a1Stats).toEqual({ sent: 1, received: 1 })
      expect(a2Stats).toEqual({ sent: 1, received: 1 })
    })
  })

  describe('getTypeCount', () => {
    it('should return 0 for unknown message type', () => {
      const count = collector.getTypeCount(MessageType.TASK_ASSIGN)
      expect(count).toBe(0)
    })

    it('should return count for known message type', () => {
      const msg1 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg2 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.TASK_ASSIGN, {})
      const msg3 = MessageFactory.createMessage('a1', 'a2', 'task-1', MessageType.PROGRESS_REPORT, {})

      collector.recordMessage(msg1)
      collector.recordMessage(msg2)
      collector.recordMessage(msg3)

      expect(collector.getTypeCount(MessageType.TASK_ASSIGN)).toBe(2)
      expect(collector.getTypeCount(MessageType.PROGRESS_REPORT)).toBe(1)
    })
  })

  describe('complex scenarios', () => {
    it('should handle high volume of messages', () => {
      for (let i = 0; i < 1000; i++) {
        const msg = MessageFactory.createMessage(
          `agent-${i % 10}`,
          `agent-${(i + 1) % 10}`,
          'task-1',
          MessageType.TASK_ASSIGN,
          {}
        )
        collector.recordMessage(msg)
      }

      const stats = collector.getStats()
      expect(stats.totalMessages).toBe(1000)
    })

    it('should track multiple message types correctly', () => {
      const types = [
        MessageType.TASK_ASSIGN,
        MessageType.PROGRESS_REPORT,
        MessageType.TASK_COMPLETE,
        MessageType.ERROR_REPORT,
        MessageType.SIGNATURE_REQUEST,
      ]

      for (const type of types) {
        for (let i = 0; i < 3; i++) {
          const msg = MessageFactory.createMessage('a1', 'a2', 'task-1', type, {})
          collector.recordMessage(msg)
        }
      }

      const stats = collector.getStats()
      expect(stats.totalMessages).toBe(15)
      expect(Object.keys(stats.messagesByType)).toHaveLength(5)

      for (const type of types) {
        expect(stats.messagesByType[type]).toBe(3)
      }
    })

    it('should handle agent sending to itself', () => {
      const msg = MessageFactory.createMessage('a1', 'a1', 'task-1', MessageType.TASK_ASSIGN, {})

      collector.recordMessage(msg)

      const stats = collector.getAgentStats('a1')
      expect(stats).toEqual({ sent: 1, received: 1 })
    })
  })
})
