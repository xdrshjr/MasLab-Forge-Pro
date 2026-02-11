/**
 * Tests for AppealModule
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { AppealModule } from '../../src/governance/appeal-module.js'
import { DecisionRepository } from '../../src/persistence/repositories/decision-repository.js'
import { TaskRepository } from '../../src/persistence/repositories/task-repository.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { createSchema } from '../../src/persistence/schema.js'
import { LoggerFactory } from '../../src/logging/index.js'
import { DecisionType } from '../../src/types/index.js'

describe('AppealModule', () => {
  let db: Database.Database
  let appealModule: AppealModule
  let decisionRepo: DecisionRepository
  let messageBus: MessageBus
  let taskId: string
  let loggerFactory: LoggerFactory

  beforeEach(() => {
    // Create in-memory database
    db = new Database(':memory:')
    createSchema(db)

    // Create task
    const taskRepo = new TaskRepository(db)
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
    decisionRepo = new DecisionRepository(db)

    // Initialize appeal module
    appealModule = new AppealModule(
      db,
      decisionRepo,
      messageBus,
      loggerFactory.createLogger('appeal'),
      taskId
    )
  })

  describe('createAppeal', () => {
    it('should create appeal for rejected decision', () => {
      // Create a rejected decision
      const decisionId = 'decision-1'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      const appeal = appealModule.createAppeal(decisionId, 'agent-1', 'Addressed concerns')

      expect(appeal.id).toBeDefined()
      expect(appeal.decisionId).toBe(decisionId)
      expect(appeal.appealerId).toBe('agent-1')
      expect(appeal.arguments).toBe('Addressed concerns')
      expect(appeal.votes).toHaveLength(0)
      expect(appeal.result).toBeUndefined()
    })

    it('should throw error if decision not found', () => {
      expect(() => {
        appealModule.createAppeal('non-existent', 'agent-1', 'Arguments')
      }).toThrow('Decision non-existent not found')
    })

    it('should throw error if not proposer', () => {
      const decisionId = 'decision-2'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      expect(() => {
        appealModule.createAppeal(decisionId, 'agent-2', 'Arguments')
      }).toThrow('Only proposer can appeal')
    })

    it('should throw error if decision not rejected', () => {
      const decisionId = 'decision-3'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2'],
          signers: [],
          vetoers: [],
          status: 'pending',
          createdAt: Date.now(),
        },
        taskId
      )

      expect(() => {
        appealModule.createAppeal(decisionId, 'agent-1', 'Arguments')
      }).toThrow('Can only appeal rejected decisions')
    })
  })

  describe('voteOnAppeal', () => {
    it('should record vote on appeal', () => {
      // Create rejected decision and appeal
      const decisionId = 'decision-4'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2', 'top-3'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      const appeal = appealModule.createAppeal(decisionId, 'agent-1', 'Addressed concerns')

      // Vote on appeal
      appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')

      const updatedAppeal = appealModule.getAppeal(appeal.id)
      expect(updatedAppeal?.votes).toHaveLength(1)
      expect(updatedAppeal?.votes[0]).toEqual({ agentId: 'top-1', vote: 'support' })
    })

    it('should throw error if appeal not found', () => {
      expect(() => {
        appealModule.voteOnAppeal('non-existent', 'top-1', 'support')
      }).toThrow('Appeal non-existent not found')
    })

    it('should throw error if already voted', () => {
      const decisionId = 'decision-5'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2', 'top-3'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      const appeal = appealModule.createAppeal(decisionId, 'agent-1', 'Addressed concerns')
      appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')

      expect(() => {
        appealModule.voteOnAppeal(appeal.id, 'top-1', 'oppose')
      }).toThrow('top-1 has already voted')
    })

    it('should resolve appeal with success when 2/3 votes support', () => {
      const decisionId = 'decision-6'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2', 'top-3'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      const appeal = appealModule.createAppeal(decisionId, 'agent-1', 'Addressed concerns')

      // Cast 3 votes: 2 support, 1 oppose (2/3 threshold met)
      appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')
      appealModule.voteOnAppeal(appeal.id, 'top-2', 'support')
      appealModule.voteOnAppeal(appeal.id, 'top-3', 'oppose')

      const resolvedAppeal = appealModule.getAppeal(appeal.id)
      expect(resolvedAppeal?.result).toBe('success')
      expect(resolvedAppeal?.resolvedAt).toBeDefined()

      // Decision should be approved
      const updatedDecision = decisionRepo.get(decisionId)
      expect(updatedDecision?.status).toBe('approved')
    })

    it('should resolve appeal with failure when less than 2/3 votes support', () => {
      const decisionId = 'decision-7'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2', 'top-3'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      const appeal = appealModule.createAppeal(decisionId, 'agent-1', 'Addressed concerns')

      // Cast 3 votes: 1 support, 2 oppose (2/3 threshold not met)
      appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')
      appealModule.voteOnAppeal(appeal.id, 'top-2', 'oppose')
      appealModule.voteOnAppeal(appeal.id, 'top-3', 'oppose')

      const resolvedAppeal = appealModule.getAppeal(appeal.id)
      expect(resolvedAppeal?.result).toBe('failed')
      expect(resolvedAppeal?.resolvedAt).toBeDefined()

      // Decision should remain rejected
      const updatedDecision = decisionRepo.get(decisionId)
      expect(updatedDecision?.status).toBe('rejected')
    })

    it('should throw error if appeal already resolved', () => {
      const decisionId = 'decision-8'
      decisionRepo.insert(
        {
          id: decisionId,
          proposerId: 'agent-1',
          type: DecisionType.TECHNICAL_PROPOSAL,
          content: { proposal: 'Use React' },
          requireSigners: ['top-1', 'top-2', 'top-3'],
          signers: [],
          vetoers: ['top-1'],
          status: 'rejected',
          createdAt: Date.now(),
          rejectedAt: Date.now(),
        },
        taskId
      )

      const appeal = appealModule.createAppeal(decisionId, 'agent-1', 'Addressed concerns')

      // Resolve appeal
      appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')
      appealModule.voteOnAppeal(appeal.id, 'top-2', 'support')
      appealModule.voteOnAppeal(appeal.id, 'top-3', 'oppose')

      // Try to vote again
      expect(() => {
        appealModule.voteOnAppeal(appeal.id, 'top-1', 'oppose')
      }).toThrow('Appeal already resolved')
    })
  })
})