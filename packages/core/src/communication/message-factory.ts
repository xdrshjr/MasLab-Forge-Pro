/**
 * Factory for creating standardized message objects
 *
 * Provides convenient methods for creating common message types
 * with proper structure and default values.
 */

import { randomUUID } from 'node:crypto'
import { Message, MessageType, MessagePriority } from '../types/index.js'

/**
 * Task assignment content structure
 */
export interface TaskAssignContent {
  task: {
    id: string
    description: string
    deadline?: number
    dependencies?: string[]
    context?: Record<string, unknown>
  }
}

/**
 * Progress report content structure
 */
export interface ProgressReportContent {
  taskId: string
  status: 'in_progress' | 'completed' | 'failed'
  percentage: number
  description: string
  result?: unknown
  blockers?: string[]
}

/**
 * Signature request content structure
 */
export interface SignatureRequestContent {
  decision: {
    id: string
    type: string
    description: string
    proposer: string
    content: Record<string, unknown>
    requireSigners: string[]
  }
}

/**
 * Factory class for creating message objects
 */
export class MessageFactory {
  /**
   * Create a task assignment message
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param taskId - Task ID for tracking
   * @param task - Task details
   * @returns Task assignment message
   */
  static createTaskAssign(
    from: string,
    to: string,
    taskId: string,
    task: TaskAssignContent['task']
  ): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to,
      type: MessageType.TASK_ASSIGN,
      content: { task },
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL,
    }
  }

  /**
   * Create a progress report message
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param taskId - Task ID for tracking
   * @param report - Progress report details
   * @returns Progress report message
   */
  static createProgressReport(
    from: string,
    to: string,
    taskId: string,
    report: ProgressReportContent
  ): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to,
      type: MessageType.PROGRESS_REPORT,
      content: report as unknown as Record<string, unknown>,
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL,
    }
  }

  /**
   * Create a signature request message
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param taskId - Task ID for tracking
   * @param decision - Decision requiring signature
   * @returns Signature request message
   */
  static createSignatureRequest(
    from: string,
    to: string,
    taskId: string,
    decision: SignatureRequestContent['decision']
  ): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to,
      type: MessageType.SIGNATURE_REQUEST,
      content: { decision },
      timestamp: Date.now(),
      priority: MessagePriority.HIGH,
    }
  }

  /**
   * Create a broadcast message
   *
   * @param from - Sender agent ID
   * @param taskId - Task ID for tracking
   * @param type - Message type
   * @param content - Message content
   * @returns Broadcast message
   */
  static createBroadcast(
    from: string,
    taskId: string,
    type: MessageType,
    content: Record<string, unknown>
  ): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to: 'broadcast',
      type,
      content,
      timestamp: Date.now(),
      priority: MessagePriority.NORMAL,
    }
  }

  /**
   * Create a heartbeat acknowledgment message
   *
   * @param from - Sender agent ID
   * @param taskId - Task ID for tracking
   * @param heartbeatNumber - Current heartbeat number
   * @returns Heartbeat ACK message
   */
  static createHeartbeatAck(from: string, taskId: string, heartbeatNumber: number): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to: 'system',
      type: MessageType.HEARTBEAT_ACK,
      content: { heartbeatNumber },
      timestamp: Date.now(),
      priority: MessagePriority.LOW,
      heartbeatNumber,
    }
  }

  /**
   * Create an error report message
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param taskId - Task ID for tracking
   * @param error - Error details
   * @returns Error report message
   */
  static createErrorReport(
    from: string,
    to: string,
    taskId: string,
    error: { code: string; message: string; details?: Record<string, unknown> }
  ): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to,
      type: MessageType.ERROR_REPORT,
      content: error,
      timestamp: Date.now(),
      priority: MessagePriority.URGENT,
    }
  }

  /**
   * Create a generic message with custom content
   *
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param taskId - Task ID for tracking
   * @param type - Message type
   * @param content - Message content
   * @param priority - Message priority (default: NORMAL)
   * @returns Generic message
   */
  static createMessage(
    from: string,
    to: string,
    taskId: string,
    type: MessageType,
    content: Record<string, unknown>,
    priority: MessagePriority = MessagePriority.NORMAL
  ): Message {
    return {
      id: randomUUID(),
      taskId,
      from,
      to,
      type,
      content,
      timestamp: Date.now(),
      priority,
    }
  }
}
