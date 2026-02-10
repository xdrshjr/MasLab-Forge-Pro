/**
 * Message validation utilities
 *
 * Ensures messages conform to the expected structure and contain
 * valid data before being processed by the message bus.
 */

import { Message, MessageType, MessagePriority } from '../types/index.js'

/**
 * Validation result structure
 */
export interface ValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Message validator class
 */
export class MessageValidator {
  /**
   * Validate a message object
   *
   * @param message - Message to validate
   * @returns Validation result with any errors found
   */
  static validate(message: Message): ValidationResult {
    const errors: string[] = []

    // Check required fields
    if (!message.id) {
      errors.push('Message ID is required')
    }

    if (!message.from) {
      errors.push('Message sender (from) is required')
    }

    if (!message.to) {
      errors.push('Message recipient (to) is required')
    }

    if (!message.type) {
      errors.push('Message type is required')
    }

    if (!message.taskId) {
      errors.push('Message taskId is required')
    }

    // Validate message type
    if (message.type && !Object.values(MessageType).includes(message.type as MessageType)) {
      errors.push(`Invalid message type: ${message.type}`)
    }

    // Validate timestamp
    if (message.timestamp) {
      if (typeof message.timestamp !== 'number') {
        errors.push('Message timestamp must be a number')
      } else if (message.timestamp > Date.now() + 1000) {
        errors.push('Message timestamp is in the future')
      } else if (message.timestamp < 0) {
        errors.push('Message timestamp cannot be negative')
      }
    } else {
      errors.push('Message timestamp is required')
    }

    // Validate priority if present
    if (message.priority !== undefined) {
      const validPriorities = Object.values(MessagePriority).filter(
        (v) => typeof v === 'number'
      ) as number[]

      if (!validPriorities.includes(message.priority)) {
        errors.push(`Invalid priority: ${message.priority}`)
      }
    }

    // Validate content
    if (message.content === undefined || message.content === null) {
      errors.push('Message content is required')
    } else if (typeof message.content !== 'object') {
      errors.push('Message content must be an object')
    }

    // Validate replyTo if present
    if (message.replyTo !== undefined && typeof message.replyTo !== 'string') {
      errors.push('Message replyTo must be a string')
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate and throw if invalid
   *
   * @param message - Message to validate
   * @throws Error if message is invalid
   */
  static validateOrThrow(message: Message): void {
    const result = this.validate(message)

    if (!result.valid) {
      throw new Error(`Invalid message: ${result.errors.join(', ')}`)
    }
  }
}
