/**
 * Tests for RequirementManager
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RequirementManager } from '../../src/team/requirement-manager.js'

describe('RequirementManager', () => {
  let manager: RequirementManager

  beforeEach(() => {
    manager = new RequirementManager()
  })

  describe('clarify', () => {
    it('should clarify task requirements in auto mode', async () => {
      const context = await manager.clarify('Create a TODO application', 'auto')

      expect(context.id).toBeDefined()
      expect(context.description).toBe('Create a TODO application')
      expect(context.type).toBeDefined()
      expect(context.mode).toBe('auto')
      expect(context.requirements).toBeInstanceOf(Array)
      expect(context.clarificationHistory).toBeInstanceOf(Array)
      expect(context.clarificationHistory.length).toBeGreaterThan(0)
    })

    it('should infer task type correctly', async () => {
      const devContext = await manager.clarify('Build a web application', 'auto')
      expect(devContext.type).toBe('development')

      const researchContext = await manager.clarify('Research machine learning algorithms', 'auto')
      expect(researchContext.type).toBe('research')

      const testContext = await manager.clarify('Test the authentication system', 'auto')
      expect(testContext.type).toBe('testing')
    })

    it('should conduct multiple rounds of Q&A', async () => {
      const context = await manager.clarify('Create a TODO app', 'auto')

      // Default is 3 rounds with 10 questions each
      expect(context.clarificationHistory.length).toBe(30)
    })

    it('should extract requirements from Q&A', async () => {
      const context = await manager.clarify('Create a TODO app', 'auto')

      expect(context.requirements.length).toBeGreaterThan(0)
      // Requirements should be strings
      context.requirements.forEach((req) => {
        expect(typeof req).toBe('string')
      })
    })

    it('should generate unique task IDs', async () => {
      const context1 = await manager.clarify('Task 1', 'auto')
      const context2 = await manager.clarify('Task 2', 'auto')

      expect(context1.id).not.toBe(context2.id)
    })
  })

  describe('custom configuration', () => {
    it('should respect custom rounds and questions', async () => {
      const customManager = new RequirementManager({
        maxRounds: 2,
        questionsPerRound: 5,
      })

      const context = await customManager.clarify('Test task', 'auto')

      expect(context.clarificationHistory.length).toBe(10) // 2 rounds * 5 questions
    })
  })
})
