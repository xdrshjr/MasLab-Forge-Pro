/**
 * Governance module exports
 *
 * Provides signature, veto, appeal, accountability, and election mechanisms.
 */

export { GovernanceEngine, type GovernanceConfig } from './governance-engine.js'
export { SignatureModule, type ProposeDecisionInput } from './signature-module.js'
export { VetoModule } from './veto-module.js'
export { AppealModule, type AppealConfig } from './appeal-module.js'
export { AccountabilityModule, type AccountabilityConfig } from './accountability-module.js'
export { PerformanceEvaluator } from './performance-evaluator.js'
export { ElectionModule, type ElectionConfig } from './election-module.js'
export { DecisionValidator, type DecisionValidationResult } from './decision-validator.js'
export { SignatureTimeoutHandler } from './signature-timeout-handler.js'
export { SignatureReminderSystem } from './signature-reminder-system.js'
export { DecisionQueryHelper, type DecisionStats } from './decision-query-helper.js'
export { createDefaultSignatureConfig, type SignatureConfig } from './signature-config.js'
