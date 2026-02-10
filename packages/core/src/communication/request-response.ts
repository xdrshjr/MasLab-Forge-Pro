/**
 * Request-response helper for async communication patterns
 *
 * Enables agents to send requests and wait for responses with timeout handling,
 * simplifying common request-response communication patterns.
 */

import { randomUUID } from 'node:crypto'
import { Message, MessageType } from '../types/index.js'

/**
 * Pending request context
 */
interface PendingRequest {
  resolve: (response: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

/**
 * Request-response helper class
 */
export class RequestResponseHelper {
  private pendingRequests: Map<string, PendingRequest>

  constructor() {
    this.pendingRequests = new Map()
  }

  /**
   * Send a request and wait for a response
   *
   * @param sendMessage - Function to send the message
   * @param from - Sender agent ID
   * @param to - Recipient agent ID
   * @param taskId - Task ID for tracking
   * @param type - Message type
   * @param content - Message content
   * @param timeoutMs - Timeout in milliseconds (default: 10000)
   * @returns Promise that resolves with the response content
   */
  async sendRequest(
    sendMessage: (message: Message) => void,
    from: string,
    to: string,
    taskId: string,
    type: MessageType,
    content: Record<string, unknown>,
    timeoutMs: number = 10000
  ): Promise<unknown> {
    const requestId = randomUUID()

    return new Promise((resolve, reject) => {
      // Set timeout
      const timeout = setTimeout(() => {
        this.pendingRequests.delete(requestId)
        reject(new Error(`Request timeout: ${to} did not respond within ${timeoutMs}ms`))
      }, timeoutMs)

      // Store request context
      this.pendingRequests.set(requestId, { resolve, reject, timeout })

      // Send request message with embedded requestId
      const message: Message = {
        id: randomUUID(),
        taskId,
        from,
        to,
        type,
        content: { ...content, requestId },
        timestamp: Date.now(),
      }

      sendMessage(message)
    })
  }

  /**
   * Handle a response message
   *
   * @param message - Response message
   */
  handleResponse(message: Message): void {
    const requestId = (message.content as { requestId?: string }).requestId

    if (!requestId) {
      console.warn('Received response without requestId')
      return
    }

    const pending = this.pendingRequests.get(requestId)

    if (!pending) {
      console.warn(`Received response for unknown request: ${requestId}`)
      return
    }

    // Clear timeout and resolve promise
    clearTimeout(pending.timeout)
    this.pendingRequests.delete(requestId)
    pending.resolve(message.content)
  }

  /**
   * Cancel a pending request
   *
   * @param requestId - Request ID to cancel
   */
  cancelRequest(requestId: string): void {
    const pending = this.pendingRequests.get(requestId)

    if (pending) {
      clearTimeout(pending.timeout)
      this.pendingRequests.delete(requestId)
      pending.reject(new Error('Request cancelled'))
    }
  }

  /**
   * Cancel all pending requests
   */
  cancelAllRequests(): void {
    for (const [_requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout)
      pending.reject(new Error('All requests cancelled'))
    }
    this.pendingRequests.clear()
  }

  /**
   * Get the number of pending requests
   *
   * @returns Number of pending requests
   */
  getPendingCount(): number {
    return this.pendingRequests.size
  }
}
