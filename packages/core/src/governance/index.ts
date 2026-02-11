/**
 * Governance module exports
 *
 * Provides signature, veto, and decision management mechanisms.
 */

export { GovernanceEngine, type GovernanceConfig } from './governance-engine.js'
export { SignatureModule, type ProposeDecisionInput } from './signature-module.js'
export { VetoModule } from './veto-module.js'
export { DecisionValidator, type ValidationResult } from './decision-validator.js'
export { SignatureTimeoutHandler } from './signature-timeout-handler.js'
export { SignatureReminderSystem } from './signature-reminder-system.js'
export { DecisionQueryHelper, type DecisionStats } from './decision-query-helper.js'
export { createDefaultSignatureConfig, type SignatureConfig } from './signature-config.js'
