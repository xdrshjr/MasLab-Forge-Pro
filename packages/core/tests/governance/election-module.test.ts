/**
 * Tests for ElectionModule
 */

import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { ElectionModule } from '../../src/governance/election-module.js'
import { PerformanceEvaluator } from '../../src/governance/performance-evaluator.js'
import { AccountabilityModule } from '../../src/governance/accountability-module.js'
import { AuditRepository } from '../../src/persistence/repositories/audit-repository.js'
import { AgentRepository } from '../../src/persistence/repositories/agent-repository.js'
import { TaskRepository } from '../../src/persistence/repositories/task-repository.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { createSchema } from '../../src/persistence/schema.js'
import { LoggerFactory } from '../../src/logging/index.js'
import { AgentStatus } from '../../src/types/index.js'

describe('ElectionModule', () => {
  let db: Database.Database
  let electionModule: ElectionModule
  let evaluator: PerformanceEvaluator
  let accountabilityModule: AccountabilityModule
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
    const auditRepo = new AuditRepository(db)
    agentRepo = new AgentRepository(db)

    // Initialize modules
    evaluator = new PerformanceEvaluator()
    accountabilityModule = new AccountabilityModule(
      db,
      auditRepo,
      messageBus,
      loggerFactory.createLogger('accountability'),
      taskId
    )

    electionModule = new ElectionModule(
      db,
      evaluator,
      accountabilityModule,
      messageBus,
      loggerFactory.createLogger('election'),
      taskId
    )
  })

  describe('triggerElection', () => {
    it('should skip election if no agents in layer', async () => {
      await electionModule.triggerElection('bottom', 1)
      // Should complete without errors
    })

    it('should evaluate agents and record results', async () => {
      // Create agents
      agentRepo.insert(
        {
          id: 'agent-1',
          name: 'Test Agent 1',
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

      agentRepo.insert(
        {
          id: 'agent-2',
          name: 'Test Agent 2',
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

      await electionModule.triggerElection('bottom', 1)

      // Check election records
      const stmt = db.prepare('SELECT * FROM elections WHERE task_id = ?')
      const elections = stmt.all(taskId)
      expect(elections.length).toBeGreaterThan(0)
    })
  })
})
