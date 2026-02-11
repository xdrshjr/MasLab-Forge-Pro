/**
 * Signature Module - Handles decision proposals and signature collection
 *
 * Implements the signature mechanism for multi-party decision approval.
 * Manages the lifecycle of decisions from proposal to approval.
 */

import { randomUUID } from 'node:crypto'
import type { Decision } from '../types/index.js'
import { DecisionType, MessageType, MessagePriority } from '../types/index.js'
import type { DecisionRepository } from '../persistence/repositories/decision-repository.js'
import type { MessageBus } from '../communication/message-bus.js'
import type { WhiteboardSystem } from '../whiteboard/index.js'
import type { SignatureConfig } from './signature-config.js'
import type { Logger } from 'pino'

/**
 * Input for proposing a new decision
 */
export interface ProposeDecisionInput {
  proposerId: string
  type: DecisionType
  content: Record<string, unknown>
  requireSigners: string[]
}

/**
 * Signature Module class
 */
export class SignatureModule {
  constructor(
    private decisionRepo: DecisionRepository,
    private messageBus: MessageBus,
    private whiteboardSystem: WhiteboardSystem | null,
    private config: SignatureConfig,
    private logger: Logger,
    private taskId: string
  ) {}

  /**
   * Proposes a new decision and requests signatures
   *
   * @param input - Decision proposal input
   * @returns Created decision
   */
  proposeDecision(input: ProposeDecisionInput): Decision {
    const newDecision: Decision = {
      id: randomUUID(),
      taskId: this.taskId,
      proposerId: input.proposerId,
      type: input.type,
      content: input.content,
      requireSigners: input.requireSigners,
      signers: [],
      vetoers: [],
      status: 'pending',
      createdAt: Date.now(),
    }

    // Save to database
    this.decisionRepo.insert(newDecision, this.taskId)

    // Send signature requests to all required signers
    for (const signerId of input.requireSigners) {
      this.messageBus.sendMessage({
        id: randomUUID(),
        taskId: this.taskId,
        from: 'system',
        to: signerId,
        type: MessageType.SIGNATURE_REQUEST,
        content: { decision: newDecision },
        timestamp: Date.now(),
        priority: MessagePriority.HIGH,
      })
    }

    this.logger.info(
      { decisionId: newDecision.id, proposerId: input.proposerId, type: input.type },
      'Decision proposed'
    )

    return newDecision
  }

  /**
   * Signs a decision with the given signer's approval
   *
   * @param decisionId - Decision ID to sign
   * @param signerId - Agent ID of the signer
   * @throws Error if signer is not authorized or decision is not pending
   */
  async signDecision(decisionId: string, signerId: string): Promise<void> {
    const decision = this.decisionRepo.get(decisionId)

    if (!decision) {
      throw new Error(`Decision ${decisionId} not found`)
    }

    // Validate signer authority
    if (!decision.requireSigners.includes(signerId)) {
      throw new Error(`${signerId} is not a required signer for decision ${decisionId}`)
    }

    if (decision.signers.includes(signerId)) {
      throw new Error(`${signerId} has already signed decision ${decisionId}`)
    }

    if (decision.status !== 'pending') {
      throw new Error(`Cannot sign decision ${decisionId} with status ${decision.status}`)
    }

    // Add signature
    this.decisionRepo.addSigner(decisionId, signerId)

    // Reload decision to get updated signers
    const updatedDecision = this.decisionRepo.get(decisionId)
    if (!updatedDecision) {
      throw new Error(`Decision ${decisionId} not found after update`)
    }

    // Check if threshold reached
    const threshold = this.getSignatureThreshold(decision.type as DecisionType)
    const signatureCount = updatedDecision.signers.length

    if (signatureCount >= threshold) {
      // Approve the decision
      this.decisionRepo.approve(decisionId)

      // Notify proposer of approval
      this.messageBus.sendMessage({
        id: randomUUID(),
        taskId: this.taskId,
        from: 'system',
        to: decision.proposerId,
        type: MessageType.SIGNATURE_APPROVE,
        content: { decisionId },
        timestamp: Date.now(),
        priority: MessagePriority.HIGH,
      })

      // Record to global whiteboard
      await this.recordDecisionToWhiteboard(updatedDecision)

      this.logger.info({ decisionId, signerId, signatureCount, threshold }, 'Decision APPROVED')
    } else {
      this.logger.info({ decisionId, signerId, signatureCount, threshold }, 'Decision signed')
    }
  }

  /**
   * Gets the signature threshold for a decision type
   *
   * @param type - Decision type
   * @returns Required number of signatures
   */
  private getSignatureThreshold(type: DecisionType): number {
    return this.config.thresholds.get(type) ?? this.config.defaultThreshold
  }

  /**
   * Records an approved decision to the global whiteboard
   *
   * @param decision - Approved decision
   */
  private async recordDecisionToWhiteboard(decision: Decision): Promise<void> {
    if (!this.whiteboardSystem) {
      return
    }

    const whiteboard = this.whiteboardSystem

    const content = `
### Decision #${decision.id.slice(0, 8)}
- **Type**: ${decision.type}
- **Proposer**: ${decision.proposerId}
- **Status**: ${decision.status}
- **Signers**: ${decision.signers.join(', ')}
- **Approved**: ${decision.approvedAt ? new Date(decision.approvedAt).toISOString() : 'N/A'}

**Content**:
\`\`\`json
${JSON.stringify(decision.content, null, 2)}
\`\`\`
`

    await whiteboard.append('global', content, 'system')
  }
}
