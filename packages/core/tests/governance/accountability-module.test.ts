/**
 * Tests for AccountabilityModule
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { AccountabilityModule } from '../../src/governance/accountability-module.js'
import { AuditRepository } from '../../src/persistence/repositories/audit-repository.js'
import { AgentRepository } from '../../src/persistence/repositories/agent-repository.js'
import { TaskRepository } from '../../src/persistence/repositories/task-repository.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { createSchema } from '../../src/persistence/schema.js'
import { LoggerFactory } from '../../src/logging/index.js'
import { AgentStatus } from '../../src/types/index.js'

describe('AccountabilityModule', () => {
  let db: Database.Database
  let accountabilityModule: AccountabilityModule
  let auditRepo: AuditRepository
  let agentRepo: AgentRepository
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
    auditRepo = new AuditRepository(db)
    agentRepo = new AgentRepository(db)

    // Initialize accountability module
    accountabilityModule = new AccountabilityModule(
      db,
      auditRepo,
      messageBus,
      loggerFactory.createLogger('accountability'),
      taskId
    )
  })

  describe('issueWarning', () => {
    it('should issue warning to agent', async () => {
      // Create agent
      const agentId = 'agent-1'
      agentRepo.insert(
        {
          id: agentId,
          name: 'Test Agent',
          layer: 'bottom',
          role: 'executor',
          status: AgentStatus.IDLE,
          supervisor: null,
          subordinates: [],
          capabilities: ['task_execution'],
          config: {},
        },
        taskId
      )

      await accountabilityModule.issueWarning(agentId, 'Task failed')

      // Check audit record
      const audits = auditRepo.getByAgent(taskId, agentId)
      expect(audits).toHaveLength(1)
      expect(audits[0].eventType).toBe('warning')
      expect(audits[0].reason).toBe('Task failed')
    })

    it('should increment warning count', async () => {
      const agentId = 'agent-1'
      agentRepo.insert(
        {
          id: agentId,
          name: 'Test Agent',
          layer: 'bottom',
          role: 'executor',
          status: AgentStatus.IDLE,
          supervisor: null,
          subordinates: [],
          capabilities: ['task_execution'],
          config: {},
        },
        taskId
      )

      await accountabilityModule.issueWarning(agentId, 'First warning')
      await accountabilityModule.issueWarning(agentId, 'Second warning')

      const audits = auditRepo.getByAgent(taskId, agentId)
      expect(audits).toHaveLength(2)
    })

    it('should dismiss agent after 3 warnings', async () => {
      const agentId = 'agent-1'
      agentRepo.insert(
        {
          id: agentId,
          name: 'Test Agent',
          layer: 'bottom',
          role: 'executor',
          status: AgentStatus.IDLE,
          supervisor: null,
          subordinates: [],
          capabilities: ['task_execution'],
          config: {},
        },
        taskId
      )

      // Issue 3 warnings
      await accountabilityModule.issueWarning(agentId, 'Warning 1')
      await accountabilityModule.issueWarning(agentId, 'Warning 2')
      await accountabilityModule.issueWarning(agentId, 'Warning 3')

      // Check agent status
      const updatedAgent = agentRepo.get(agentId)
      expect(updatedAgent?.status).toBe(AgentStatus.TERMINATED)

      // Check audit records
      const audits = auditRepo.getByAgent(taskId, agentId)
      const dismissalAudit = audits.find((a) => a.eventType === 'dismissal')
      expect(dismissalAudit).toBeDefined()
    })
  })

  describe('dismissAgent', () => {
    it('should dismiss agent and create audit record', async () => {
      const agentId = 'agent-1'
      agentRepo.insert(
        {
          id: agentId,
          name: 'Test Agent',
          layer: 'bottom',
          role: 'executor',
          status: AgentStatus.IDLE,
          supervisor: 'supervisor-1',
          subordinates: [],
          capabilities: ['task_execution'],
          config: {},
        },
        taskId
      )

      await accountabilityModule.dismissAgent(agentId, 'Critical failure')

      // Check agent status
      const updatedAgent = agentRepo.get(agentId)
      expect(updatedAgent?.status).toBe(AgentStatus.TERMINATED)

      // Check audit record
      const audits = auditRepo.getByAgent(taskId, agentId)
      const dismissalAudit = audits.find((a) => a.eventType === 'dismissal')
      expect(dismissalAudit).toBeDefined()
      expect(dismissalAudit?.reason).toBe('Critical failure')
    })
  })

  describe('demoteAgent', () => {
    it('should create audit record for demotion', async () => {
      const agentId = 'agent-1'
      agentRepo.insert(
        {
          id: agentId,
          name: 'Test Agent',
          layer: 'mid',
          role: 'coordinator',
          status: AgentStatus.IDLE,
          supervisor: null,
          subordinates: [],
          capabilities: ['coordination'],
          config: {},
        },
        taskId
      )

      await accountabilityModule.demoteAgent(agentId, 'Poor performance')

      // Check audit record
      const audits = auditRepo.getByAgent(taskId, agentId)
      const demotionAudit = audits.find((a) => a.eventType === 'demotion')
      expect(demotionAudit).toBeDefined()
      expect(demotionAudit?.reason).toBe('Poor performance')
    })

    it('should issue warning if agent already at bottom layer', async () => {
      const agentId = 'agent-1'
      agentRepo.insert(
        {
          id: agentId,
          name: 'Test Agent',
          layer: 'bottom',
          role: 'executor',
          status: AgentStatus.IDLE,
          supervisor: null,
          subordinates: [],
          capabilities: ['task_execution'],
          config: {},
        },
        taskId
      )

      await accountabilityModule.demoteAgent(agentId, 'Poor performance')

      // Should issue warning instead
      const audits = auditRepo.getByAgent(taskId, agentId)
      const warningAudit = audits.find((a) => a.eventType === 'warning')
      expect(warningAudit).toBeDefined()
    })
  })
})
