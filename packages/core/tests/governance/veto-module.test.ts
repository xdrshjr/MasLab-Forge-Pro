/**
 * Tests for VetoModule
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { VetoModule } from '../../src/governance/veto-module.js'
import { SignatureModule } from '../../src/governance/signature-module.js'
import { DecisionRepository } from '../../src/persistence/repositories/decision-repository.js'
import { AuditRepository } from '../../src/persistence/repositories/audit-repository.js'
import { TaskRepository } from '../../src/persistence/repositories/task-repository.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { createDefaultSignatureConfig } from '../../src/governance/signature-config.js'
import { createSchema } from '../../src/persistence/schema.js'
import { DecisionType, MessageType } from '../../src/types/index.js'
import { LoggerFactory } from '../../src/logging/index.js'

describe('VetoModule', () => {
  let db: Database.Database
  let decisionRepo: DecisionRepository
  let auditRepo: AuditRepository
  let taskRepo: TaskRepository
  let messageBus: MessageBus
  let signatureModule: SignatureModule
  let vetoModule: VetoModule
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
    auditRepo = new AuditRepository(db)
    messageBus = new MessageBus({}, db, loggerFactory.createLogger('message-bus'), taskId)

    // Initialize modules (whiteboard system is optional for tests)
    signatureModule = new SignatureModule(
      decisionRepo,
      messageBus,
      null,
      createDefaultSignatureConfig(),
      loggerFactory.createLogger('governance'),
      taskId
    )

    vetoModule = new VetoModule(decisionRepo, auditRepo, messageBus, loggerFactory.createLogger('governance'), taskId)
  })

  describe('vetoDecision', () => {
    it('should veto a pending decision', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await vetoModule.vetoDecision(decision.id, 'top-1', 'Technical concerns')

      const updated = decisionRepo.get(decision.id)
      expect(updated?.status).toBe('rejected')
      expect(updated?.vetoers).toContain('top-1')
    })

    it('should record veto in audit log', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await vetoModule.vetoDecision(decision.id, 'top-1', 'Risk too high')

      const audits = auditRepo.getByType(taskId, 'veto')
      expect(audits).toHaveLength(1)
      expect(audits[0].agentId).toBe('top-1')
      expect(audits[0].reason).toBe('Risk too high')
      expect(audits[0].metadata?.decisionId).toBe(decision.id)
    })

    it('should notify proposer of veto', async () => {
      messageBus.registerAgent('agent-1')

      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await vetoModule.vetoDecision(decision.id, 'top-1', 'Not ready')

      const messages = messageBus.getMessages('agent-1')
      const vetoMessage = messages.find((m) => m.type === MessageType.SIGNATURE_VETO)

      expect(vetoMessage).toBeDefined()
      expect(vetoMessage?.content.vetoer).toBe('top-1')
      expect(vetoMessage?.content.reason).toBe('Not ready')
    })

    it('should reject veto from unauthorized agent', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      await expect(
        vetoModule.vetoDecision(decision.id, 'top-3', 'Unauthorized veto')
      ).rejects.toThrow('not authorized to veto')
    })

    it('should reject veto of non-pending decision', async () => {
      const decision = await signatureModule.proposeDecision({
        proposerId: 'agent-1',
        type: DecisionType.TECHNICAL_PROPOSAL,
        content: { proposal: 'Use React' },
        requireSigners: ['top-1', 'top-2'],
      })

      // Approve the decision first
      await signatureModule.signDecision(decision.id, 'top-1')
      await signatureModule.signDecision(decision.id, 'top-2')

      await expect(
        vetoModule.vetoDecision(decision.id, 'top-1', 'Too late')
      ).rejects.toThrow('Cannot veto decision')
    })

    it('should reject veto of non-existent decision', async () => {
      await expect(
        vetoModule.vetoDecision('non-existent-id', 'top-1', 'Does not exist')
      ).rejects.toThrow('not found')
    })
  })
})
