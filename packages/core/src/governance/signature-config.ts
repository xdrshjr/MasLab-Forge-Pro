/**
 * Signature configuration for decision approval thresholds
 *
 * Defines how many signatures are required for different decision types.
 */

import { DecisionType } from '../types/index.js'

/**
 * Configuration for signature thresholds
 */
export interface SignatureConfig {
  thresholds: Map<DecisionType, number>
  defaultThreshold: number
}

/**
 * Creates default signature configuration
 *
 * @returns Default signature configuration with standard thresholds
 */
export function createDefaultSignatureConfig(): SignatureConfig {
  const thresholds = new Map<DecisionType, number>([
    [DecisionType.TECHNICAL_PROPOSAL, 2], // Requires 2/3 top-layer signatures
    [DecisionType.TASK_ALLOCATION, 2], // Requires proposer + assignee
    [DecisionType.RESOURCE_ADJUSTMENT, 2], // Requires 2/3 top-layer signatures
    [DecisionType.MILESTONE_CONFIRMATION, 3], // Requires all 3 top-layer signatures
  ])

  return {
    thresholds,
    defaultThreshold: 2,
  }
}
