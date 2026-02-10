/**
 * Tests for MessageValidator
 */

import { describe, it, expect } from 'vitest'
import { MessageValidator } from '../../src/communication/message-validator.js'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { MessageType, MessagePriority } from '../../src/types/index.js'

describe('MessageValidator', () => {
  const validMessage = MessageFactory.createMessage(
    'agent-1',
    'agent-2',
    'task-123',
    MessageType.TASK_ASSIGN,
    { data: 'test' }
  )

  describe('validate', () => {
    it('should validate a correct message', () => {
      const result = MessageValidator.validate(validMessage)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject message without id', () => {
      const message = { ...validMessage, id: '' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message ID is required')
    })

    it('should reject message without from', () => {
      const message = { ...validMessage, from: '' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message sender (from) is required')
    })

    it('should reject message without to', () => {
      const message = { ...validMessage, to: '' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message recipient (to) is required')
    })

    it('should reject message without type', () => {
      const message = { ...validMessage, type: '' as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message type is required')
    })

    it('should reject message without taskId', () => {
      const message = { ...validMessage, taskId: '' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message taskId is required')
    })

    it('should reject message with invalid type', () => {
      const message = { ...validMessage, type: 'INVALID_TYPE' as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid message type: INVALID_TYPE')
    })

    it('should reject message without timestamp', () => {
      const message = { ...validMessage, timestamp: undefined as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message timestamp is required')
    })

    it('should reject message with non-numeric timestamp', () => {
      const message = { ...validMessage, timestamp: 'not-a-number' as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message timestamp must be a number')
    })

    it('should reject message with future timestamp', () => {
      const message = { ...validMessage, timestamp: Date.now() + 2000 }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message timestamp is in the future')
    })

    it('should reject message with negative timestamp', () => {
      const message = { ...validMessage, timestamp: -1 }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message timestamp cannot be negative')
    })

    it('should reject message with invalid priority', () => {
      const message = { ...validMessage, priority: 999 as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid priority: 999')
    })

    it('should accept message with valid priority', () => {
      const message = { ...validMessage, priority: MessagePriority.HIGH }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })

    it('should accept message without priority (optional field)', () => {
      const message = { ...validMessage }
      delete (message as any).priority
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })

    it('should reject message without content', () => {
      const message = { ...validMessage, content: undefined as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message content is required')
    })

    it('should reject message with null content', () => {
      const message = { ...validMessage, content: null as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message content is required')
    })

    it('should reject message with non-object content', () => {
      const message = { ...validMessage, content: 'string-content' as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message content must be an object')
    })

    it('should accept message with empty object content', () => {
      const message = { ...validMessage, content: {} }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })

    it('should reject message with non-string replyTo', () => {
      const message = { ...validMessage, replyTo: 123 as any }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Message replyTo must be a string')
    })

    it('should accept message with valid replyTo', () => {
      const message = { ...validMessage, replyTo: 'msg-123' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })

    it('should accept message without replyTo (optional field)', () => {
      const message = { ...validMessage }
      delete (message as any).replyTo
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })

    it('should collect multiple errors', () => {
      const message = {
        ...validMessage,
        id: '',
        from: '',
        to: '',
        type: 'INVALID' as any,
        timestamp: -1,
      }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
    })
  })

  describe('validateOrThrow', () => {
    it('should not throw for valid message', () => {
      expect(() => MessageValidator.validateOrThrow(validMessage)).not.toThrow()
    })

    it('should throw for invalid message', () => {
      const message = { ...validMessage, id: '' }

      expect(() => MessageValidator.validateOrThrow(message)).toThrow('Invalid message')
    })

    it('should include all errors in thrown message', () => {
      const message = {
        ...validMessage,
        id: '',
        from: '',
        to: '',
      }

      expect(() => MessageValidator.validateOrThrow(message)).toThrow(
        /Message ID is required.*Message sender.*Message recipient/
      )
    })
  })

  describe('edge cases', () => {
    it('should handle all valid MessageType values', () => {
      const types = Object.values(MessageType)

      for (const type of types) {
        const message = { ...validMessage, type }
        const result = MessageValidator.validate(message)
        expect(result.valid).toBe(true)
      }
    })

    it('should handle all valid MessagePriority values', () => {
      const priorities = [
        MessagePriority.LOW,
        MessagePriority.NORMAL,
        MessagePriority.HIGH,
        MessagePriority.URGENT,
      ]

      for (const priority of priorities) {
        const message = { ...validMessage, priority }
        const result = MessageValidator.validate(message)
        expect(result.valid).toBe(true)
      }
    })

    it('should accept broadcast recipient', () => {
      const message = { ...validMessage, to: 'broadcast' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })

    it('should accept system recipient', () => {
      const message = { ...validMessage, to: 'system' }
      const result = MessageValidator.validate(message)

      expect(result.valid).toBe(true)
    })
  })
})
