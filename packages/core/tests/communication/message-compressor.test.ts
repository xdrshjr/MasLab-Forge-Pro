/**
 * Tests for MessageCompressor
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { MessageCompressor } from '../../src/communication/message-compressor.js'
import { MessageFactory } from '../../src/communication/message-factory.js'
import { MessageType } from '../../src/types/index.js'

describe('MessageCompressor', () => {
  let compressor: MessageCompressor

  beforeEach(() => {
    compressor = new MessageCompressor()
  })

  describe('constructor', () => {
    it('should create compressor with default threshold', () => {
      const comp = new MessageCompressor()
      const smallMessage = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(500) }
      )

      const result = comp.compress(smallMessage)
      expect(comp.isCompressed(result)).toBe(false)
    })

    it('should create compressor with custom threshold', () => {
      const comp = new MessageCompressor({ compressionThreshold: 100 })
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(200) }
      )

      const result = comp.compress(message)
      expect(comp.isCompressed(result)).toBe(true)
    })
  })

  describe('compress', () => {
    it('should not compress small messages', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'small' }
      )

      const compressed = compressor.compress(message)

      expect(compressor.isCompressed(compressed)).toBe(false)
      expect(compressed).toEqual(message)
    })

    it('should compress large messages', () => {
      const largeContent = { data: 'x'.repeat(2000) }
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        largeContent
      )

      const compressed = compressor.compress(message)

      expect(compressor.isCompressed(compressed)).toBe(true)
      expect(compressed._compressed).toBe(true)
      expect(compressed._originalSize).toBeGreaterThan(0)
    })

    it('should reduce message size for compressible content', () => {
      const largeContent = { data: 'a'.repeat(5000) } // Highly compressible
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        largeContent
      )

      const compressed = compressor.compress(message)
      const originalSize = JSON.stringify(message.content).length
      const compressedSize = JSON.stringify(compressed.content).length

      expect(compressedSize).toBeLessThan(originalSize)
    })

    it('should preserve message metadata', () => {
      const largeContent = { data: 'x'.repeat(2000) }
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        largeContent
      )

      const compressed = compressor.compress(message)

      expect(compressed.id).toBe(message.id)
      expect(compressed.from).toBe(message.from)
      expect(compressed.to).toBe(message.to)
      expect(compressed.type).toBe(message.type)
      expect(compressed.taskId).toBe(message.taskId)
      expect(compressed.timestamp).toBe(message.timestamp)
    })

    it('should handle compression errors gracefully', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(2000) }
      )

      // Mock console.error to suppress error output
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const result = compressor.compress(message)

      // Should return original message on error
      expect(result).toBeDefined()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('decompress', () => {
    it('should return uncompressed message as-is', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'small' }
      )

      const decompressed = compressor.decompress(message)

      expect(decompressed).toEqual(message)
    })

    it('should decompress compressed message', () => {
      const originalContent = { data: 'x'.repeat(2000), nested: { value: 123 } }
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        originalContent
      )

      const compressed = compressor.compress(message)
      const decompressed = compressor.decompress(compressed)

      expect(decompressed.content).toEqual(originalContent)
      expect(decompressed._compressed).toBeUndefined()
      expect(decompressed._originalSize).toBeUndefined()
    })

    it('should preserve message metadata after decompression', () => {
      const largeContent = { data: 'x'.repeat(2000) }
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        largeContent
      )

      const compressed = compressor.compress(message)
      const decompressed = compressor.decompress(compressed)

      expect(decompressed.id).toBe(message.id)
      expect(decompressed.from).toBe(message.from)
      expect(decompressed.to).toBe(message.to)
      expect(decompressed.type).toBe(message.type)
      expect(decompressed.taskId).toBe(message.taskId)
      expect(decompressed.timestamp).toBe(message.timestamp)
    })

    it('should handle complex nested objects', () => {
      const complexContent = {
        level1: {
          level2: {
            level3: {
              data: 'x'.repeat(2000),
              array: [1, 2, 3, 4, 5],
              boolean: true,
              null: null,
            },
          },
        },
      }
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        complexContent
      )

      const compressed = compressor.compress(message)
      const decompressed = compressor.decompress(compressed)

      expect(decompressed.content).toEqual(complexContent)
    })

    it('should throw error for corrupted compressed data', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'test' }
      )

      // Create fake compressed message with invalid data
      const fakeCompressed = {
        ...message,
        content: { _data: 'invalid-base64-data!!!' },
        _compressed: true,
        _originalSize: 100,
      }

      expect(() => compressor.decompress(fakeCompressed)).toThrow(
        'Failed to decompress message'
      )
    })
  })

  describe('isCompressed', () => {
    it('should return false for uncompressed message', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'small' }
      )

      expect(compressor.isCompressed(message)).toBe(false)
    })

    it('should return true for compressed message', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(2000) }
      )

      const compressed = compressor.compress(message)

      expect(compressor.isCompressed(compressed)).toBe(true)
    })
  })

  describe('getCompressionRatio', () => {
    it('should return undefined for uncompressed message', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'small' }
      )

      expect(compressor.getCompressionRatio(message)).toBeUndefined()
    })

    it('should return compression ratio for compressed message', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'a'.repeat(5000) } // Highly compressible
      )

      const compressed = compressor.compress(message)
      const ratio = compressor.getCompressionRatio(compressed)

      expect(ratio).toBeDefined()
      expect(ratio).toBeGreaterThan(0)
      expect(ratio).toBeLessThan(1) // Compressed size should be smaller
    })

    it('should calculate correct ratio', () => {
      const message = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(3000) }
      )

      const compressed = compressor.compress(message)
      const ratio = compressor.getCompressionRatio(compressed)

      const compressedSize = JSON.stringify(compressed.content).length
      const originalSize = compressed._originalSize!

      expect(ratio).toBeCloseTo(compressedSize / originalSize, 2)
    })
  })

  describe('round-trip compression', () => {
    it('should preserve data through compress-decompress cycle', () => {
      const testCases = [
        { simple: 'x'.repeat(2000) },
        { nested: { deep: { value: 'y'.repeat(2000) } } },
        { array: Array(100).fill('data') },
        { mixed: { str: 'test', num: 123, bool: true, arr: [1, 2, 3] } },
      ]

      for (const content of testCases) {
        const message = MessageFactory.createMessage(
          'a1',
          'a2',
          'task-1',
          MessageType.TASK_ASSIGN,
          content
        )

        const compressed = compressor.compress(message)
        const decompressed = compressor.decompress(compressed)

        expect(decompressed.content).toEqual(content)
      }
    })
  })

  describe('threshold behavior', () => {
    it('should respect custom threshold', () => {
      const comp = new MessageCompressor({ compressionThreshold: 500 })

      const smallMessage = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(400) }
      )

      const largeMessage = MessageFactory.createMessage(
        'a1',
        'a2',
        'task-1',
        MessageType.TASK_ASSIGN,
        { data: 'x'.repeat(600) }
      )

      expect(comp.isCompressed(comp.compress(smallMessage))).toBe(false)
      expect(comp.isCompressed(comp.compress(largeMessage))).toBe(true)
    })
  })
})
