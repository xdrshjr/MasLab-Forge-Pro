/**
 * Team Validator
 *
 * Validates generated team structures to ensure they meet
 * framework constraints and governance requirements.
 */

import type { TeamStructure, ValidationResult } from './types.js'

/**
 * Validates team structure constraints
 */
export class TeamValidator {
  /**
   * Validate a complete team structure
   */
  validate(teamStructure: TeamStructure): ValidationResult {
    const errors: string[] = []

    // Validate top layer
    this.validateTopLayer(teamStructure, errors)

    // Validate mid layer
    this.validateMidLayer(teamStructure, errors)

    // Validate bottom layer
    this.validateBottomLayer(teamStructure, errors)

    // Validate capabilities
    this.validateCapabilities(teamStructure, errors)

    return {
      valid: errors.length === 0,
      errors,
    }
  }

  /**
   * Validate top layer constraints
   */
  private validateTopLayer(teamStructure: TeamStructure, errors: string[]): void {
    const topLayer = teamStructure.topLayer

    // Must have exactly 3 roles
    if (topLayer.length !== 3) {
      errors.push(`Top layer must have exactly 3 roles, found ${topLayer.length}`)
    }

    // Check for unique names
    const names = topLayer.map((r) => r.name)
    const uniqueNames = new Set(names)
    if (uniqueNames.size !== names.length) {
      errors.push('Top layer roles must have unique names')
    }

    // Check for signature authority
    for (const role of topLayer) {
      if (!role.signatureAuthority || role.signatureAuthority.length === 0) {
        errors.push(`Top layer role "${role.name}" must have signature authority`)
      }

      // Must have arbitrate capability
      if (!role.capabilities.includes('arbitrate')) {
        errors.push(`Top layer role "${role.name}" must have arbitrate capability`)
      }
    }
  }

  /**
   * Validate mid layer constraints
   */
  private validateMidLayer(teamStructure: TeamStructure, errors: string[]): void {
    const midLayer = teamStructure.midLayer

    // Must have 2-5 roles
    if (midLayer.length < 2) {
      errors.push(`Mid layer must have at least 2 roles, found ${midLayer.length}`)
    }
    if (midLayer.length > 5) {
      errors.push(`Mid layer must have at most 5 roles, found ${midLayer.length}`)
    }

    // Check for unique domains
    const domains = midLayer.map((r) => r.domain).filter((d) => d !== undefined)
    const uniqueDomains = new Set(domains)
    if (uniqueDomains.size !== domains.length) {
      errors.push('Mid layer roles must have unique domains')
    }

    // Check for domain assignment
    for (const role of midLayer) {
      if (!role.domain) {
        errors.push(`Mid layer role "${role.name}" must have a domain`)
      }

      // Must have delegate capability
      if (!role.capabilities.includes('delegate')) {
        errors.push(`Mid layer role "${role.name}" must have delegate capability`)
      }
    }
  }

  /**
   * Validate bottom layer constraints
   */
  private validateBottomLayer(teamStructure: TeamStructure, errors: string[]): void {
    const bottomLayer = teamStructure.bottomLayer

    // Must have at least 1 agent
    if (bottomLayer.length === 0) {
      errors.push('Bottom layer must have at least 1 agent')
    }

    // Must not exceed 50 agents
    if (bottomLayer.length > 50) {
      errors.push(`Bottom layer exceeds maximum 50 agents (${bottomLayer.length})`)
    }

    // Check for tools
    for (const role of bottomLayer) {
      if (!role.tools || role.tools.length === 0) {
        errors.push(`Bottom layer role "${role.name}" must have tools`)
      }

      // Must have execute capability
      if (!role.capabilities.includes('execute')) {
        errors.push(`Bottom layer role "${role.name}" must have execute capability`)
      }
    }
  }

  /**
   * Validate capabilities across all layers
   */
  private validateCapabilities(teamStructure: TeamStructure, errors: string[]): void {
    const allRoles = [
      ...teamStructure.topLayer,
      ...teamStructure.midLayer,
      ...teamStructure.bottomLayer,
    ]

    for (const role of allRoles) {
      // Must have at least one capability
      if (!role.capabilities || role.capabilities.length === 0) {
        errors.push(`Role "${role.name}" has no capabilities`)
      }

      // Must have responsibilities
      if (!role.responsibilities || role.responsibilities.length === 0) {
        errors.push(`Role "${role.name}" has no responsibilities`)
      }

      // Layer must be valid
      if (!['top', 'mid', 'bottom'].includes(role.layer)) {
        errors.push(`Role "${role.name}" has invalid layer: ${role.layer}`)
      }
    }
  }
}
