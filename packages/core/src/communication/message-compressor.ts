/**
 * Message compression utilities
 *
 * Provides optional compression for large message payloads to reduce
 * memory usage and improve performance when dealing with large content.
 */

import { gzipSync, gunzipSync } from 'node:zlib'
import { Message } from '../types/index.js'

/**
 * Extended message type with compression metadata
 */
export interface CompressedMessage extends Message {
  _compressed?: boolean
  _originalSize?: number
}

/**
 * Message compressor configuration
 */
export interface MessageCompressorConfig {
  compressionThreshold?: number // Minimum size in bytes to trigger compression (default: 1024)
}

/**
 * Message compressor class
 */
export class MessageCompressor {
  private compressionThreshold: number

  constructor(config: MessageCompressorConfig = {}) {
    this.compressionThreshold = config.compressionThreshold ?? 1024 // Default: 1KB
  }

  /**
   * Compress a message if its content exceeds the threshold
   *
   * @param message - Message to compress
   * @returns Compressed message or original if below threshold
   */
  compress(message: Message): CompressedMessage {
    // Only compress string content
    const contentStr = JSON.stringify(message.content)

    if (contentStr.length < this.compressionThreshold) {
      return message
    }

    try {
      const compressed = gzipSync(contentStr)
      const compressedBase64 = compressed.toString('base64')

      return {
        ...message,
        content: { _data: compressedBase64 },
        _compressed: true,
        _originalSize: contentStr.length,
      }
    } catch (error) {
      // If compression fails, return original message
      console.error('Message compression failed:', error)
      return message
    }
  }

  /**
   * Decompress a message if it was compressed
   *
   * @param message - Message to decompress
   * @returns Decompressed message or original if not compressed
   */
  decompress(message: CompressedMessage): Message {
    if (!message._compressed) {
      return message
    }

    try {
      const compressedData = (message.content as { _data: string })._data
      const buffer = Buffer.from(compressedData, 'base64')
      const decompressed = gunzipSync(buffer)
      const contentStr = decompressed.toString('utf-8')
      const content = JSON.parse(contentStr) as Record<string, unknown>

      // Remove compression metadata
      const { _compressed, _originalSize, ...cleanMessage } = message

      return {
        ...cleanMessage,
        content,
      }
    } catch (error) {
      console.error('Message decompression failed:', error)
      throw new Error('Failed to decompress message')
    }
  }

  /**
   * Check if a message is compressed
   *
   * @param message - Message to check
   * @returns True if compressed, false otherwise
   */
  isCompressed(message: Message): boolean {
    return (message as CompressedMessage)._compressed === true
  }

  /**
   * Get compression ratio for a compressed message
   *
   * @param message - Compressed message
   * @returns Compression ratio (0-1) or undefined if not compressed
   */
  getCompressionRatio(message: CompressedMessage): number | undefined {
    if (!message._compressed || !message._originalSize) {
      return undefined
    }

    const compressedSize = JSON.stringify(message.content).length
    return compressedSize / message._originalSize
  }
}
