/**
 * Tests for SignatureModule
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { SignatureModule } from '../../src/governance/signature-module.js'
import { DecisionRepository } from '../../src/persistence/repositories/decision-repository.js'
import { TaskRepository } from '../../src/persistence/repositories/task-repository.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { createDefaultSignatureConfig } from '../../src/governance/signature-config.js'
import { createSchema } from '../../src/persistence/schema.js'
import { DecisionType, MessageType } from '../../src/types/index.js'
import { LoggerFactory } from '../../src/logging/index.js'
import pino from 'pino'

describe('SignatureModule', () => {
  let db: Database.Database
  let decisionRepo: DecisionRepository
  let taskRepo: TaskRepository
  let messageBus: MessageBus
  let signatureModule: SignatureModule
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

    // Initialize repositories and systems
    decisionRepo = new DecisionRepository(db)
    messageBus = new MessageBus({}, db, loggerFactory.createLogger('message-bus'), taskId)

    // Initialize signature module (whiteboard system is optional for tests)
    signatureModule = new SignatureModule(
      decisionRepo,
      messageBus,
      null,
      createDefaultSignatureConfig(),
      loggerFactory.createLogger('governance'),
      taskId
    )
  })

  describe('proposeDecision', () => {
    it('should create a pending decision', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      expect(decision.id).toBeDefined()
      expect(decision.status).toBe('pending')
      expect(decision.signers).toHaveLength(0)
      expect(decision.vetoers).toHaveLength(0)
      expect(decision.requireSigners).toEqual(['top-1', 'top-2'])
    })

    it('should save decision to database', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      const saved = decisionRepo.get(decision.id)
      expect(saved).toBeDefined()
      expect(saved?.proposerId).toBe('agent-1')
    })

    it('should send signature requests to all required signers', async () => {
      messageBus.registerAgent('top-1')
      messageBus.registerAgent('top-2')

      await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      const top1Messages = messageBus.getMessages('top-1')
      const top2Messages = messageBus.getMessages('top-2')

      expect(top1Messages.some((m) => m.type === MessageType.SIGNATURE_REQUEST)).toBe(true)
      expect(top2Messages.some((m) => m.type === MessageType.SIGNATURE_REQUEST)).toBe(true)
    })
  })

  describe('signDecision', () => {
    it('should add signer to decision', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await signatureModule.signDecision(decision.id, 'top-1')

      const updated = decisionRepo.get(decision.id)
      expect(updated?.signers).toContain('top-1')
    })

    it('should approve decision when threshold reached', async () => {
      messageBus.registerAgent('agent-1')

      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await signatureModule.signDecision(decision.id, 'top-1')
      let updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('pending')

      await signatureModule.signDecision(decision.id, 'top-2')
      updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('approved')
      expect(updated?.approvedAt).toBeDefined()
    })

    it('should notify proposer when decision approved', async () => {
      messageBus.registerAgent('agent-1')

      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await signatureModule.signDecision(decision.id, 'top-1')
      await signatureModule.signDecision(decision.id, 'top-2')

      const messages = messageBus.getMessages('agent-1')
      expect(messages.some((m) => m.type === MessageType.SIGNATURE_APPROVE)).toBe(true)
    })

    it('should reject duplicate signatures', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await signatureModule.signDecision(decision.id, 'top-1')

      await expect(signatureModule.signDecision(decision.id, 'top-1')).rejects.toThrow(
        'has already signed'
      )
    })

    it('should reject unauthorized signers', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await expect(signatureModule.signDecision(decision.id, 'top-3')).rejects.toThrow(
        'not a required signer'
      )
    })

    it('should reject signing non-pending decisions', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2', 'top-3'],
      })

      // Approve the decision (threshold is 2)
      await signatureModule.signDecision(decision.id, 'top-1')
      await signatureModule.signDecision(decision.id, 'top-2')

      // Try to sign after approval with an agent that hasn't signed yet
      await expect(signatureModule.signDecision(decision.id, 'top-3')).rejects.toThrow(
        'Cannot sign decision'
      )
    })
  })

  describe('Signature thresholds', () => {
    it('should require 2 signatures for technical proposals', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2', 'top-3'],
      })

      await signatureModule.signDecision(decision.id, 'top-1')
      let updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('pending')

      await signatureModule.signDecision(decision.id, 'top-2')
      updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('approved')
    })

    it('should require 3 signatures for milestone confirmations', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.MILESTONE_CONFIRMATION,
        content: { milestone: 'Phase 1 complete' },
        requireSigners: ['top-1', 'top-2', 'top-3'],
      })

      await signatureModule.signDecision(decision.id, 'top-1')
      await signatureModule.signDecision(decision.id, 'top-2')
      let updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('pending')

      await signatureModule.signDecision(decision.id, 'top-3')
      updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('approved')
    })
  })
})
