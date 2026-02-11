/**
 * Tests for TeamValidator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TeamValidator } from '../../src/team/team-validator.js'
import type { TeamStructure, RoleDefinition } from '../../src/team/types.js'

describe('TeamValidator', () => {
  let validator: TeamValidator

  beforeEach(() => {
    validator = new TeamValidator()
  })

  const createValidTopRole = (name: string): RoleDefinition => ({
    name,
    layer: 'top',
    responsibilities: ['Responsibility 1', 'Responsibility 2'],
    capabilities: ['plan', 'reflect', 'arbitrate'],
    signatureAuthority: ['technical_proposal'],
  })

  const createValidMidRole = (name: string, domain: string): RoleDefinition => ({
    name,
    layer: 'mid',
    responsibilities: ['Responsibility 1'],
    capabilities: ['plan', 'delegate'],
    domain,
  })

  const createValidBottomRole = (name: string): RoleDefinition => ({
    name,
    layer: 'bottom',
    responsibilities: ['Execute tasks'],
    capabilities: ['execute', 'tool_call'],
    tools: ['file_read', 'file_write'],
  })

  describe('validate', () => {
    it('should validate a correct team structure', () => {
      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1'), createValidBottomRole('Bot-2')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject team with wrong number of top-layer roles', () => {
      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2')], // Only 2
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Top layer must have exactly 3 roles'))).toBe(true)
    })

    it('should reject team with too few mid-layer roles', () => {
      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend')], // Only 1
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Mid layer must have at least 2 roles'))).toBe(true)
    })

    it('should reject team with too many mid-layer roles', () => {
      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [
          createValidMidRole('Mid-1', 'backend'),
          createValidMidRole('Mid-2', 'frontend'),
          createValidMidRole('Mid-3', 'testing'),
          createValidMidRole('Mid-4', 'docs'),
          createValidMidRole('Mid-5', 'infra'),
          createValidMidRole('Mid-6', 'extra'), // 6 roles
        ],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Mid layer must have at most 5 roles'))).toBe(true)
    })

    it('should reject team with no bottom-layer agents', () => {
      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [], // Empty
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('Bottom layer must have at least 1 agent'))).toBe(true)
    })

    it('should reject team with duplicate mid-layer domains', () => {
      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [
          createValidMidRole('Mid-1', 'backend'),
          createValidMidRole('Mid-2', 'backend'), // Duplicate domain
        ],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('unique domains'))).toBe(true)
    })

    it('should reject top-layer role without signature authority', () => {
      const invalidTopRole: RoleDefinition = {
        name: 'Top-1',
        layer: 'top',
        responsibilities: ['Responsibility'],
        capabilities: ['plan', 'arbitrate'],
        // Missing signatureAuthority
      }

      const structure: TeamStructure = {
        topLayer: [invalidTopRole, createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('must have signature authority'))).toBe(true)
    })

    it('should reject top-layer role without arbitrate capability', () => {
      const invalidTopRole: RoleDefinition = {
        name: 'Top-1',
        layer: 'top',
        responsibilities: ['Responsibility'],
        capabilities: ['plan', 'reflect'], // Missing arbitrate
        signatureAuthority: ['technical_proposal'],
      }

      const structure: TeamStructure = {
        topLayer: [invalidTopRole, createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('must have arbitrate capability'))).toBe(true)
    })

    it('should reject mid-layer role without delegate capability', () => {
      const invalidMidRole: RoleDefinition = {
        name: 'Mid-1',
        layer: 'mid',
        responsibilities: ['Responsibility'],
        capabilities: ['plan', 'execute'], // Missing delegate
        domain: 'backend',
      }

      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [invalidMidRole, createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('must have delegate capability'))).toBe(true)
    })

    it('should reject bottom-layer role without tools', () => {
      const invalidBottomRole: RoleDefinition = {
        name: 'Bot-1',
        layer: 'bottom',
        responsibilities: ['Execute tasks'],
        capabilities: ['execute'],
        // Missing tools
      }

      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [invalidBottomRole],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('must have tools'))).toBe(true)
    })

    it('should reject bottom-layer role without execute capability', () => {
      const invalidBottomRole: RoleDefinition = {
        name: 'Bot-1',
        layer: 'bottom',
        responsibilities: ['Execute tasks'],
        capabilities: ['plan'], // Missing execute
        tools: ['file_read'],
      }

      const structure: TeamStructure = {
        topLayer: [createValidTopRole('Top-1'), createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [invalidBottomRole],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('must have execute capability'))).toBe(true)
    })

    it('should reject role without capabilities', () => {
      const invalidRole: RoleDefinition = {
        name: 'Top-1',
        layer: 'top',
        responsibilities: ['Responsibility'],
        capabilities: [], // Empty
        signatureAuthority: ['technical_proposal'],
      }

      const structure: TeamStructure = {
        topLayer: [invalidRole, createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('has no capabilities'))).toBe(true)
    })

    it('should reject role without responsibilities', () => {
      const invalidRole: RoleDefinition = {
        name: 'Top-1',
        layer: 'top',
        responsibilities: [], // Empty
        capabilities: ['plan', 'arbitrate'],
        signatureAuthority: ['technical_proposal'],
      }

      const structure: TeamStructure = {
        topLayer: [invalidRole, createValidTopRole('Top-2'), createValidTopRole('Top-3')],
        midLayer: [createValidMidRole('Mid-1', 'backend'), createValidMidRole('Mid-2', 'frontend')],
        bottomLayer: [createValidBottomRole('Bot-1')],
      }

      const result = validator.validate(structure)

      expect(result.valid).toBe(false)
      expect(result.errors.some((e) => e.includes('has no responsibilities'))).toBe(true)
    })
  })
})
