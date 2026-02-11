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
import { AppealModule, type AppealConfig } from './appeal-module.js'
import { AccountabilityModule, type AccountabilityConfig } from './accountability-module.js'
import { PerformanceEvaluator } from './performance-evaluator.js'
import { ElectionModule, type ElectionConfig } from './election-module.js'
import type { Decision, Appeal, AppealVote } from '../types/index.js'

/**
 * Governance engine configuration
 */
export interface GovernanceConfig {
  signatureConfig?: SignatureConfig
  appealConfig?: AppealConfig
  accountabilityConfig?: AccountabilityConfig
  electionConfig?: ElectionConfig
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
  private appealModule: AppealModule
  private accountabilityModule: AccountabilityModule
  private performanceEvaluator: PerformanceEvaluator
  private electionModule: ElectionModule
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
      appealConfig: config.appealConfig ?? { votingThreshold: 2 / 3, votingTimeout: 300000 },
      accountabilityConfig: config.accountabilityConfig ?? {
        warningThreshold: 3,
        failureThreshold: 1,
      },
      electionConfig: config.electionConfig ?? {
        interval: 50,
        performanceThresholds: { excellent: 80, good: 60, poor: 40, failing: 20 },
      },
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

    this.appealModule = new AppealModule(
      database,
      this.decisionRepo,
      messageBus,
      logger,
      taskId,
      this.config.appealConfig
    )

    this.accountabilityModule = new AccountabilityModule(
      database,
      auditRepo,
      messageBus,
      logger,
      taskId,
      this.config.accountabilityConfig
    )

    this.performanceEvaluator = new PerformanceEvaluator()

    this.electionModule = new ElectionModule(
      database,
      this.performanceEvaluator,
      this.accountabilityModule,
      messageBus,
      logger,
      taskId,
      this.config.electionConfig
    )

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
   * Creates an appeal for a vetoed decision
   *
   * @param decisionId - Decision ID
   * @param appealerId - Appealer agent ID
   * @param appealArguments - Arguments for the appeal
   * @returns Created appeal
   */
  appealDecision(decisionId: string, appealerId: string, appealArguments: string): Appeal {
    return this.appealModule.createAppeal(decisionId, appealerId, appealArguments)
  }

  /**
   * Votes on an appeal
   *
   * @param appealId - Appeal ID
   * @param voterId - Voter agent ID
   * @param vote - Vote (support or oppose)
   */
  voteOnAppeal(appealId: string, voterId: string, vote: AppealVote): void {
    this.appealModule.voteOnAppeal(appealId, voterId, vote)
  }

  /**
   * Gets an appeal by ID
   *
   * @param appealId - Appeal ID
   * @returns Appeal or undefined
   */
  getAppeal(appealId: string): Appeal | undefined {
    return this.appealModule.getAppeal(appealId)
  }

  /**
   * Reports a task failure and issues warnings
   *
   * @param taskId - Task ID
   * @param reason - Failure reason
   */
  reportFailure(taskId: string, reason: string): void {
    this.accountabilityModule.reportFailure(taskId, reason)
  }

  /**
   * Issues a warning to an agent
   *
   * @param agentId - Agent ID
   * @param reason - Warning reason
   */
  issueWarning(agentId: string, reason: string): void {
    this.accountabilityModule.issueWarning(agentId, reason)
  }

  /**
   * Dismisses an agent
   *
   * @param agentId - Agent ID
   * @param reason - Dismissal reason
   */
  dismissAgent(agentId: string, reason: string): void {
    this.accountabilityModule.dismissAgent(agentId, reason)
  }

  /**
   * Triggers an election for a specific layer
   *
   * @param layer - Agent layer
   * @param round - Election round number
   */
  triggerElection(layer: 'top' | 'mid' | 'bottom', round: number): void {
    this.electionModule.triggerElection(layer, round)
  }

  /**
   * Cleans up resources (call on shutdown)
   */
  cleanup(): void {
    this.timeoutHandler.cleanup()
    this.reminderSystem.cleanup()
  }
}
