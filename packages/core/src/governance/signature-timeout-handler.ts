/**
 * Signature Timeout Handler - Manages automatic timeout for pending signatures
 *
 * Automatically rejects decisions that don't receive required signatures
 * within the timeout period.
 */

import { randomUUID } from 'node:crypto'
import type { DecisionRepository } from '../persistence/repositories/decision-repository.js'
import type { MessageBus } from '../communication/message-bus.js'
import { MessageType } from '../types/index.js'
import type { Logger } from 'pino'

/**
 * Signature Timeout Handler class
 */
export class SignatureTimeoutHandler {
  private timeouts: Map<string, NodeJS.Timeout> = new Map()
  private defaultTimeout: number = 300000 // 5 minutes

  constructor(
    private decisionRepo: DecisionRepository,
    private messageBus: MessageBus,
    private logger: Logger,
    private taskId: string
  ) {}

  /**
   * Schedules a timeout for a decision
   *
   * @param decisionId - Decision ID
   * @param callback - Callback to execute on timeout
   * @param timeoutMs - Timeout duration in milliseconds (optional)
   */
  scheduleTimeout(decisionId: string, callback: () => void, timeoutMs?: number): void {
    const timeout = setTimeout(() => {
      this.handleTimeout(decisionId)
      callback()
    }, timeoutMs ?? this.defaultTimeout)

    this.timeouts.set(decisionId, timeout)
  }

  /**
   * Cancels a scheduled timeout
   *
   * @param decisionId - Decision ID
   */
  cancelTimeout(decisionId: string): void {
    const timeout = this.timeouts.get(decisionId)
    if (timeout) {
      clearTimeout(timeout)
      this.timeouts.delete(decisionId)
    }
  }

  /**
   * Handles timeout for a decision
   *
   * @param decisionId - Decision ID that timed out
   */
  private handleTimeout(decisionId: string): void {
    const decision = this.decisionRepo.get(decisionId)

    if (decision && decision.status === 'pending') {
      this.logger.warn({ decisionId }, 'Decision timed out')

      // Auto-reject the decision
      this.decisionRepo.updateStatus(decisionId, 'rejected')

      // Notify proposer
      this.messageBus.sendMessage({
        id: randomUUID(),
        taskId: this.taskId,
        from: 'system',
        to: decision.proposerId,
        type: MessageType.SIGNATURE_VETO,
        content: {
          decisionId,
          reason: 'Signature timeout',
        },
        timestamp: Date.now(),
      })
    }
  }

  /**
   * Cleans up all timeouts (call on shutdown)
   */
  cleanup(): void {
    for (const timeout of this.timeouts.values()) {
      clearTimeout(timeout)
    }
    this.timeouts.clear()
  }
}
