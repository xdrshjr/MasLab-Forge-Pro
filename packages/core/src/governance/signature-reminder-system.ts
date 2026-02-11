/**
 * Signature Reminder System - Sends periodic reminders to pending signers
 *
 * Reminds agents who haven't signed pending decisions to take action.
 */

import { randomUUID } from 'node:crypto'
import type { DecisionRepository } from '../persistence/repositories/decision-repository.js'
import type { MessageBus } from '../communication/message-bus.js'
import { MessageType, MessagePriority } from '../types/index.js'
import type { Logger } from 'pino'

/**
 * Signature Reminder System class
 */
export class SignatureReminderSystem {
  private reminderInterval: number = 60000 // 1 minute
  private intervals: Map<string, NodeJS.Timeout> = new Map()

  constructor(
    private decisionRepo: DecisionRepository,
    private messageBus: MessageBus,
    private logger: Logger,
    private taskId: string
  ) {}

  /**
   * Starts sending reminders for a decision
   *
   * @param decisionId - Decision ID
   */
  startReminders(decisionId: string): void {
    const interval = setInterval(() => {
      this.sendReminders(decisionId)
    }, this.reminderInterval)

    this.intervals.set(decisionId, interval)
  }

  /**
   * Stops sending reminders for a decision
   *
   * @param decisionId - Decision ID
   */
  stopReminders(decisionId: string): void {
    const interval = this.intervals.get(decisionId)
    if (interval) {
      clearInterval(interval)
      this.intervals.delete(decisionId)
    }
  }

  /**
   * Sends reminders to pending signers
   *
   * @param decisionId - Decision ID
   */
  private sendReminders(decisionId: string): void {
    const decision = this.decisionRepo.get(decisionId)

    if (!decision || decision.status !== 'pending') {
      this.stopReminders(decisionId)
      return
    }

    // Find agents who haven't signed
    const pendingSigners = decision.requireSigners.filter(
      (id) => !decision.signers.includes(id) && !decision.vetoers.includes(id)
    )

    // Send reminders
    for (const signerId of pendingSigners) {
      this.messageBus.sendMessage({
        id: randomUUID(),
        taskId: this.taskId,
        from: 'system',
        to: signerId,
        type: MessageType.SIGNATURE_REQUEST,
        content: {
          decision,
          reminder: true,
          waitingFor: pendingSigners.length,
        },
        timestamp: Date.now(),
        priority: MessagePriority.HIGH,
      })
    }

    this.logger.debug(
      { decisionId, pendingSigners: pendingSigners.length },
      'Sent signature reminders'
    )
  }

  /**
   * Cleans up all reminder intervals (call on shutdown)
   */
  cleanup(): void {
    for (const interval of this.intervals.values()) {
      clearInterval(interval)
    }
    this.intervals.clear()
  }
}
