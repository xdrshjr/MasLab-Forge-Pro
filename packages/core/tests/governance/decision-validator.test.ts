/**
 * Tests for DecisionValidator
 */

import { describe, it, expect } from 'vitest'
import { DecisionValidator } from '../../src/governance/decision-validator.js'
import { DecisionType } from '../../src/types/index.js'

describe('DecisionValidator', () => {
  const validator = new DecisionValidator()

  describe('Basic validation', () => {
    it('should validate a complete valid decision', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React for frontend' },
        requireSigners: ['top-1', 'top-2'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject decision without proposer ID', () => {
      const decision = {
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Proposer ID is required')
    })

    it('should reject decision without type', () => {
      const decision = {
        proposerId: 'agent-1',
        content: { proposal: 'Use React' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Decision type is required')
    })

    it('should reject decision with invalid type', () => {
      const decision = {
        proposerId: 'agent-1',
        type: 'invalid_type' as DecisionType,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Invalid decision type: invalid_type')
    })

    it('should reject decision without content', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Decision content is required')
    })

    it('should reject decision without required signers', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: [],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('At least one required signer must be specified')
    })
  })

  describe('Type-specific validation', () => {
    it('should validate technical proposal with proposal content', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use TypeScript' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(true)
    })

    it('should reject technical proposal without proposal content', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { other: 'data' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Technical proposal content is required')
    })

    it('should validate task allocation with taskId and assignee', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TASK_ALLOCATION,
        content: { taskId: 'task-1', assignee: 'bot-1' },
        requireSigners: ['mid-1', 'bot-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(true)
    })

    it('should reject task allocation without taskId or assignee', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.TASK_ALLOCATION,
        content: { taskId: 'task-1' },
        requireSigners: ['mid-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Task ID and assignee are required for task allocation')
    })

    it('should validate resource adjustment with adjustment details', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.RESOURCE_ADJUSTMENT,
        content: { adjustment: 'Add 2 more agents' },
        requireSigners: ['top-1', 'top-2'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(true)
    })

    it('should reject resource adjustment without adjustment details', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.RESOURCE_ADJUSTMENT,
        content: { other: 'data' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Resource adjustment details are required')
    })

    it('should validate milestone confirmation with milestone info', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.MILESTONE_CONFIRMATION,
        content: { milestone: 'Phase 1 complete' },
        requireSigners: ['top-1', 'top-2', 'top-3'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(true)
    })

    it('should reject milestone confirmation without milestone info', () => {
      const decision = {
        proposerId: 'agent-1',
        type: DecisionType.MILESTONE_CONFIRMATION,
        content: { other: 'data' },
        requireSigners: ['top-1'],
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Milestone information is required')
    })
  })

  describe('Multiple errors', () => {
    it('should collect all validation errors', () => {
      const decision = {
        content: { other: 'data' },
      }

      const result = validator.validate(decision)

      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(1)
      expect(result.errors).toContain('Proposer ID is required')
      expect(result.errors).toContain('Decision type is required')
    })
  })
})
