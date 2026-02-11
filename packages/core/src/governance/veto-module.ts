/**
 * Veto Module - Handles decision rejection through veto mechanism
 *
 * Implements the veto mechanism allowing authorized agents to reject
 * pending decisions with a reason.
 */

import { randomUUID } from 'node:crypto'
import type { DecisionRepository } from '../persistence/repositories/decision-repository.js'
import type { AuditRepository } from '../persistence/repositories/audit-repository.js'
import type { MessageBus } from '../communication/message-bus.js'
import { MessageType, MessagePriority } from '../types/index.js'
import type { Logger } from 'pino'

/**
 * Veto Module class
 */
export class VetoModule {
  constructor(
    private decisionRepo: DecisionRepository,
    private auditRepo: AuditRepository,
    private messageBus: MessageBus,
    private logger: Logger,
    private taskId: string
  ) {}

  /**
   * Vetoes a pending decision
   *
   * @param decisionId - Decision ID to veto
   * @param vetoerId - Agent ID of the vetoer
   * @param reason - Reason for the veto
   * @throws Error if vetoer is not authorized or decision is not pending
   */
  vetoDecision(decisionId: string, vetoerId: string, reason: string): void {
    const decision = this.decisionRepo.get(decisionId)

    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`)
    }

    // Validate veto authority
    if (!decision.requireSigners.includes(vetoerId)) {
      throw new Error(`${vetoerId} is not authorized to veto decision ${decisionId}`)
    }

    if (decision.status !== 'pending') {
      throw new Error(`Cannot veto decision ${decisionId} with status ${decision.status}`)
    }

    // Record veto
    this.decisionRepo.addVetoer(decisionId, vetoerId)
    this.decisionRepo.updateStatus(decisionId, 'rejected')

    // Log to audit trail
    this.auditRepo.insert({
      id: randomUUID(),
      taskId: this.taskId,
      agentId: vetoerId,
      eventType: 'veto',
      reason: reason,
      metadata: { decisionId },
      timestamp: Date.now(),
    })

    // Notify proposer of veto
    this.messageBus.sendMessage({
      id: randomUUID(),
      taskId: this.taskId,
      from: 'system',
      to: decision.proposerId,
      type: MessageType.SIGNATURE_VETO,
      content: {
        decisionId,
        vetoer: vetoerId,
        reason,
      },
      timestamp: Date.now(),
      priority: MessagePriority.HIGH,
    })

    this.logger.info({ decisionId, vetoerId, reason }, 'Decision VETOED')
  }
}
