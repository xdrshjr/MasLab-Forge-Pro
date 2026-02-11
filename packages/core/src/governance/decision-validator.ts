/**
 * Decision Validator - Validates decision proposals
 *
 * Ensures decision proposals meet all requirements before being submitted.
 */

import { DecisionType } from '../types/index.js'
import type { ProposeDecisionInput } from './signature-module.js'

/**
 * Decision validation result
 */
export interface DecisionValidationResult {
  valid: boolean
  errors: string[]
}

/**
 * Decision Validator class
 */
export class DecisionValidator {
  /**
   * Validates a decision proposal
   *
   * @param decision - Decision to validate
   * @returns Validation result with errors if invalid
   */
  validate(decision: Partial<ProposeDecisionInput>): DecisionValidationResult {
    const errors: string[] = []

    // Basic field validation
    if (!decision.proposerId) {
      errors.push('Proposer ID is required')
    }

    if (!decision.type) {
      errors.push('Decision type is required')
    }

    if (decision.type && !Object.values(DecisionType).includes(decision.type)) {
      errors.push(`Invalid decision type: ${decision.type}`)
    }

    if (!decision.content) {
      errors.push('Decision content is required')
    }

    if (!decision.requireSigners || decision.requireSigners.length === 0) {
      errors.push('At least one required signer must be specified')
    }

    // Type-specific validation
    if (decision.type && decision.content) {
      this.validateTypeSpecificContent(decision.type, decision.content, errors)
    }

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validates type-specific decision content
   *
   * @param type - Decision type
   * @param content - Decision content
   * @param errors - Array to collect errors
   */
  private validateTypeSpecificContent(
    type: DecisionType,
    content: Record<string, unknown>,
    errors: string[]
  ): void {
    switch (type) {
      case DecisionType.TECHNICAL_PROPOSAL:
        if (!content.proposal) {
          errors.push('Technical proposal content is required')
        }
        break

      case DecisionType.TASK_ALLOCATION:
        if (!content.taskId || !content.assignee) {
          errors.push('Task ID and assignee are required for task allocation')
        }
        break

      case DecisionType.RESOURCE_ADJUSTMENT:
        if (!content.adjustment) {
          errors.push('Resource adjustment details are required')
        }
        break

      case DecisionType.MILESTONE_CONFIRMATION:
        if (!content.milestone) {
          errors.push('Milestone information is required')
        }
        break
    }
  }
}
