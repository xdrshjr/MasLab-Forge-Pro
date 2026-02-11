/**
 * Governance Engine - Central coordinator for governance mechanisms
 *
 * Integrates signature, veto, and other governance modules into a unified API.
 */

import type Database from 'better-sqlite3'
import type { Logger } from 'pino'
import type { MessageBus } from '../communication/message-bus.js'
import type { WhiteboardSystem } from '../whiteboard/index.js'
import { DecisionRepository } from '../persistence/repositories/decision-repository.js'
import { AuditRepository } from '../persistence/repositories/audit-repository.js'
import { SignatureModule, type ProposeDecisionInput } from './signature-module.js'
import { VetoModule } from './veto-module.js'
import { DecisionValidator } from './decision-validator.js'
import { SignatureTimeoutHandler } from './signature-timeout-handler.js'
import { SignatureReminderSystem } from './signature-reminder-system.js'
import { DecisionQueryHelper } from './decision-query-helper.js'
import { createDefaultSignatureConfig, type SignatureConfig } from './signature-config.js'
import type { Decision } from '../types/index.js'

/**
 * Governance engine configuration
 */
export interface GovernanceConfig {
  signatureConfig?: SignatureConfig
  enableReminders?: boolean
  enableTimeouts?: boolean
  timeoutMs?: number
}

/**
 * Governance Engine class
 */
export class GovernanceEngine {
  private signatureModule: SignatureModule
  private vetoModule: VetoModule
  private validator: DecisionValidator
  private timeoutHandler: SignatureTimeoutHandler
  private reminderSystem: SignatureReminderSystem
  private queryHelper: DecisionQueryHelper
  private decisionRepo: DecisionRepository
  private config: Required<GovernanceConfig>

  constructor(
    database: Database.Database,
    messageBus: MessageBus,
    whiteboardSystem: WhiteboardSystem | null,
    logger: Logger,
    taskId: string,
    config: GovernanceConfig = {}
  ) {
    // Set defaults
    this.config = {
      signatureConfig: config.signatureConfig ?? createDefaultSignatureConfig(),
      enableReminders: config.enableReminders ?? true,
      enableTimeouts: config.enableTimeouts ?? true,
      timeoutMs: config.timeoutMs ?? 300000, // 5 minutes
    }

    // Initialize repositories
    this.decisionRepo = new DecisionRepository(database)
    const auditRepo = new AuditRepository(database)

    // Initialize modules
    this.signatureModule = new SignatureModule(
      this.decisionRepo,
      messageBus,
      whiteboardSystem,
      this.config.signatureConfig,
      logger,
      taskId
    )

    this.vetoModule = new VetoModule(this.decisionRepo, auditRepo, messageBus, logger, taskId)

    this.validator = new DecisionValidator()

    this.timeoutHandler = new SignatureTimeoutHandler(this.decisionRepo, messageBus, logger, taskId)

    this.reminderSystem = new SignatureReminderSystem(this.decisionRepo, messageBus, logger, taskId)

    this.queryHelper = new DecisionQueryHelper(this.decisionRepo, taskId)
  }

  /**
   * Submits a new decision for approval
   *
   * @param decision - Decision proposal
   * @returns Created decision
   * @throws Error if validation fails
   */
  submitDecision(decision: ProposeDecisionInput): Decision {
    // Validate decision
    const validation = this.validator.validate(decision)
    if (!validation.valid) {
      throw new Error(`Invalid decision: ${validation.errors.join(', ')}`)
    }

    // Propose decision
    const newDecision = this.signatureModule.proposeDecision(decision)

    // Schedule timeout if enabled
    if (this.config.enableTimeouts) {
      this.timeoutHandler.scheduleTimeout(
        newDecision.id,
        () => {
          // Timeout callback
        },
        this.config.timeoutMs
      )
    }

    // Start reminders if enabled
    if (this.config.enableReminders) {
      this.reminderSystem.startReminders(newDecision.id)
    }

    return newDecision
  }

  /**
   * Signs a decision
   *
   * @param decisionId - Decision ID
   * @param signerId - Signer agent ID
   */
  async signDecision(decisionId: string, signerId: string): Promise<void> {
    await this.signatureModule.signDecision(decisionId, signerId)

    // Check if decision is approved and cancel timeout/reminders
    const decision = this.decisionRepo.get(decisionId)
    if (decision && decision.status === 'approved') {
      this.timeoutHandler.cancelTimeout(decisionId)
      this.reminderSystem.stopReminders(decisionId)
    }
  }

  /**
   * Vetoes a decision
   *
   * @param decisionId - Decision ID
   * @param vetoerId - Vetoer agent ID
   * @param reason - Reason for veto
   */
  vetoDecision(decisionId: string, vetoerId: string, reason: string): void {
    this.vetoModule.vetoDecision(decisionId, vetoerId, reason)

    // Cancel timeout and reminders
    this.timeoutHandler.cancelTimeout(decisionId)
    this.reminderSystem.stopReminders(decisionId)
  }

  /**
   * Gets a decision by ID
   *
   * @param decisionId - Decision ID
   * @returns Decision or undefined
   */
  getDecision(decisionId: string): Decision | undefined {
    return this.decisionRepo.get(decisionId)
  }

  /**
   * Gets pending decisions for an agent
   *
   * @param agentId - Agent ID
   * @returns Array of pending decisions
   */
  getPendingDecisionsForAgent(agentId: string): Decision[] {
    return this.queryHelper.getPendingDecisionsForAgent(agentId)
  }

  /**
   * Gets decision statistics
   *
   * @returns Decision statistics
   */
  getDecisionStats() {
    return this.queryHelper.getDecisionStats()
  }

  /**
   * Cleans up resources (call on shutdown)
   */
  cleanup(): void {
    this.timeoutHandler.cleanup()
    this.reminderSystem.cleanup()
  }
}
