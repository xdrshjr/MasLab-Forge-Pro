/**
 * Tests for GovernanceEngine integration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import Database from 'better-sqlite3'
import { GovernanceEngine } from '../../src/governance/governance-engine.js'
import { TaskRepository } from '../../src/persistence/repositories/task-repository.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { createSchema } from '../../src/persistence/schema.js'
import { DecisionType } from '../../src/types/index.js'
import { LoggerFactory } from '../../src/logging/index.js'

describe('GovernanceEngine', () => {
  let db: Database.Database
  let taskRepo: TaskRepository
  let messageBus: MessageBus
  let governanceEngine: GovernanceEngine
  let taskId: string
  let loggerFactory: LoggerFactory

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:')
    createSchema(db)

    // Create task
    taskRepo = new TaskRepository(db)
    taskId = 'test-task-1'
    taskRepo.insert({
      id: taskId,
      description: 'Test task',
      status: 'running',
      mode: 'auto',
      createdAt: Date.now(),
    })

    // Initialize loggers
    loggerFactory = new LoggerFactory({
      workspacePath: '.agent-workspace',
      enableConsole: false,
      enableFile: false,
    })

    // Initialize systems
    messageBus = new MessageBus({}, db, loggerFactory.createLogger('message-bus'), taskId)

    // Initialize governance engine (whiteboard system is optional for tests)
    governanceEngine = new GovernanceEngine(
      db,
      messageBus,
      null,
      loggerFactory.createLogger('governance'),
      taskId,
      {
        enableReminders: false, // Disable for tests
        enableTimeouts: false, // Disable for tests
      }
    )
  })

  afterEach(() => {
    governanceEngine.cleanup()
  })

  describe('submitDecision', () => {
    it('should validate and submit a decision', async () => {
      const decision = await governanceEngine.submitDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      expect(decision.id).toBeDefined()
      expect(decision.status).toBe('pending')
    })

    it('should reject invalid decisions', async () => {
      await expect(
        governanceEngine.submitDecision({
          proposerId: '',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: {},
          requireSigners: [],
        })
      ).rejects.toThrow('Invalid decision')
    })
  })

  describe('signDecision', () => {
    it('should sign and approve decision', async () => {
      const decision = await governanceEngine.submitDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await governanceEngine.signDecision(decision.id, 'top-1')
      await governanceEngine.signDecision(decision.id, 'top-2')

      const updated = governanceEngine.getDecision(decision.id)
      expect(updated?.status).toBe('approved')
    })
  })

  describe('vetoDecision', () => {
    it('should veto a pending decision', async () => {
      const decision = await governanceEngine.submitDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await governanceEngine.vetoDecision(decision.id, 'top-1', 'Technical concerns')

      const updated = governanceEngine.getDecision(decision.id)
      expect(updated?.status).toBe('rejected')
    })
  })

  describe('Query methods', () => {
    it('should get pending decisions for agent', async () => {
      await governanceEngine.submitDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      const pending = governanceEngine.getPendingDecisionsForAgent('top-1')
      expect(pending).toHaveLength(1)
    })

    it('should get decision statistics', async () => {
      await governanceEngine.submitDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      const stats = governanceEngine.getDecisionStats()
      expect(stats.total).toBe(1)
      expect(stats.pending).toBe(1)
    })
  })
})
