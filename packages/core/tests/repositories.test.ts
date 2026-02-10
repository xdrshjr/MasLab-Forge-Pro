/**
 * Repository tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseManager } from '../src/persistence/database.js'
import { TaskRepository } from '../src/persistence/repositories/task-repository.js'
import { AgentRepository } from '../src/persistence/repositories/agent-repository.js'
import { MessageRepository } from '../src/persistence/repositories/message-repository.js'
import { DecisionRepository } from '../src/persistence/repositories/decision-repository.js'
import { AuditRepository } from '../src/persistence/repositories/audit-repository.js'
import { ElectionRepository } from '../src/persistence/repositories/election-repository.js'
import type { Task, AgentConfig, Message, Decision } from '../src/types/index.js'
import { AgentStatus, MessageType, DecisionType } from '../src/types/index.js'

describe('TaskRepository', () => {
  let dbManager: DatabaseManager
  let taskRepo: TaskRepository

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:' })
    dbManager.initialize()
    taskRepo = new TaskRepository(dbManager.getDatabase())
  })

  afterEach(() => {
    dbManager.close()
  })

  it('should insert and retrieve a task', () => {
    const task: Task = {
      id: 'task-1',
      description: 'Test task',
      status: 'pending',
      mode: 'auto',
      createdAt: Date.now(),
    }

    taskRepo.insert(task)
    const retrieved = taskRepo.get('task-1')

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('task-1')
    expect(retrieved?.description).toBe('Test task')
    expect(retrieved?.status).toBe('pending')
  })

  it('should update a task', () => {
    const task: Task = {
      id: 'task-1',
      description: 'Test task',
      status: 'pending',
      mode: 'auto',
      createdAt: Date.now(),
    }

    taskRepo.insert(task)
    taskRepo.update('task-1', { status: 'running' })

    const updated = taskRepo.get('task-1')
    expect(updated?.status).toBe('running')
  })

  it('should query tasks by status', () => {
    const task1: Task = {
      id: 'task-1',
      description: 'Task 1',
      status: 'pending',
      mode: 'auto',
      createdAt: Date.now(),
    }

    const task2: Task = {
      id: 'task-2',
      description: 'Task 2',
      status: 'running',
      mode: 'auto',
      createdAt: Date.now(),
    }

    taskRepo.insert(task1)
    taskRepo.insert(task2)

    const pendingTasks = taskRepo.query({ status: 'pending' })
    expect(pendingTasks).toHaveLength(1)
    expect(pendingTasks[0].id).toBe('task-1')
  })

  it('should delete a task', () => {
    const task: Task = {
      id: 'task-1',
      description: 'Test task',
      status: 'pending',
      mode: 'auto',
      createdAt: Date.now(),
    }

    taskRepo.insert(task)
    taskRepo.delete('task-1')

    const retrieved = taskRepo.get('task-1')
    expect(retrieved).toBeUndefined()
  })
})

describe('AgentRepository', () => {
  let dbManager: DatabaseManager
  let agentRepo: AgentRepository
  let taskRepo: TaskRepository

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:' })
    dbManager.initialize()
    agentRepo = new AgentRepository(dbManager.getDatabase())
    taskRepo = new TaskRepository(dbManager.getDatabase())

    // Create a task first (foreign key requirement)
    taskRepo.insert({
      id: 'task-1',
      description: 'Test task',
      status: 'running',
      mode: 'auto',
      createdAt: Date.now(),
    })
  })

  afterEach(() => {
    dbManager.close()
  })

  it('should insert and retrieve an agent', () => {
    const agent: AgentConfig = {
      id: 'agent-1',
      name: 'Test Agent',
      layer: 'bottom',
      role: 'executor',
      subordinates: [],
      capabilities: ['execute', 'tool_call'],
      config: {
        maxRetries: 3,
        timeoutMs: 30000,
      },
    }

    agentRepo.insert(agent, 'task-1')
    const retrieved = agentRepo.get('agent-1')

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('agent-1')
    expect(retrieved?.name).toBe('Test Agent')
    expect(retrieved?.layer).toBe('bottom')
  })

  it('should update agent status', () => {
    const agent: AgentConfig = {
      id: 'agent-1',
      name: 'Test Agent',
      layer: 'bottom',
      role: 'executor',
      subordinates: [],
      capabilities: ['execute'],
      config: {
        maxRetries: 3,
        timeoutMs: 30000,
      },
    }

    agentRepo.insert(agent, 'task-1')
    agentRepo.updateStatus('agent-1', AgentStatus.WORKING)

    const updated = agentRepo.get('agent-1')
    expect(updated?.status).toBe('working')
  })

  it('should query agents by layer', () => {
    const agent1: AgentConfig = {
      id: 'agent-1',
      name: 'Top Agent',
      layer: 'top',
      role: 'planner',
      subordinates: [],
      capabilities: ['plan'],
      config: { maxRetries: 3, timeoutMs: 30000 },
    }

    const agent2: AgentConfig = {
      id: 'agent-2',
      name: 'Bottom Agent',
      layer: 'bottom',
      role: 'executor',
      subordinates: [],
      capabilities: ['execute'],
      config: { maxRetries: 3, timeoutMs: 30000 },
    }

    agentRepo.insert(agent1, 'task-1')
    agentRepo.insert(agent2, 'task-1')

    const topAgents = agentRepo.getByLayer('task-1', 'top')
    expect(topAgents).toHaveLength(1)
    expect(topAgents[0].id).toBe('agent-1')
  })
})

describe('MessageRepository', () => {
  let dbManager: DatabaseManager
  let messageRepo: MessageRepository
  let taskRepo: TaskRepository

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:' })
    dbManager.initialize()
    messageRepo = new MessageRepository(dbManager.getDatabase())
    taskRepo = new TaskRepository(dbManager.getDatabase())

    taskRepo.insert({
      id: 'task-1',
      description: 'Test task',
      status: 'running',
      mode: 'auto',
      createdAt: Date.now(),
    })
  })

  afterEach(() => {
    dbManager.close()
  })

  it('should insert and retrieve a message', () => {
    const message: Message = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.TASK_ASSIGN,
      content: { task: 'test' },
      timestamp: Date.now(),
    }

    messageRepo.insert(message, 'task-1', 1)
    const retrieved = messageRepo.get('msg-1')

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('msg-1')
    expect(retrieved?.from).toBe('agent-1')
    expect(retrieved?.to).toBe('agent-2')
  })

  it('should query messages by task', () => {
    const message1: Message = {
      id: 'msg-1',
      from: 'agent-1',
      to: 'agent-2',
      type: MessageType.TASK_ASSIGN,
      content: {},
      timestamp: Date.now(),
    }

    messageRepo.insert(message1, 'task-1', 1)

    const messages = messageRepo.getByTask('task-1')
    expect(messages).toHaveLength(1)
    expect(messages[0].id).toBe('msg-1')
  })
})

describe('DecisionRepository', () => {
  let dbManager: DatabaseManager
  let decisionRepo: DecisionRepository
  let taskRepo: TaskRepository

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:' })
    dbManager.initialize()
    decisionRepo = new DecisionRepository(dbManager.getDatabase())
    taskRepo = new TaskRepository(dbManager.getDatabase())

    taskRepo.insert({
      id: 'task-1',
      description: 'Test task',
      status: 'running',
      mode: 'auto',
      createdAt: Date.now(),
    })
  })

  afterEach(() => {
    dbManager.close()
  })

  it('should insert and retrieve a decision', () => {
    const decision: Decision = {
      id: 'decision-1',
      proposerId: 'agent-1',
      type: DecisionType.TECHNICAL_PROPOSAL,
      content: { proposal: 'test' },
      requireSigners: ['agent-2', 'agent-3'],
      signers: [],
      vetoers: [],
      status: 'pending',
      createdAt: Date.now(),
    }

    decisionRepo.insert(decision, 'task-1')
    const retrieved = decisionRepo.get('decision-1')

    expect(retrieved).toBeDefined()
    expect(retrieved?.id).toBe('decision-1')
    expect(retrieved?.status).toBe('pending')
  })

  it('should add signer to decision', () => {
    const decision: Decision = {
      id: 'decision-1',
      proposerId: 'agent-1',
      type: DecisionType.TECHNICAL_PROPOSAL,
      content: {},
      requireSigners: ['agent-2'],
      signers: [],
      vetoers: [],
      status: 'pending',
      createdAt: Date.now(),
    }

    decisionRepo.insert(decision, 'task-1')
    decisionRepo.addSigner('decision-1', 'agent-2')

    const updated = decisionRepo.get('decision-1')
    expect(updated?.signers).toContain('agent-2')
  })

  it('should approve decision', () => {
    const decision: Decision = {
      id: 'decision-1',
      proposerId: 'agent-1',
      type: DecisionType.TECHNICAL_PROPOSAL,
      content: {},
      requireSigners: ['agent-2'],
      signers: [],
      vetoers: [],
      status: 'pending',
      createdAt: Date.now(),
    }

    decisionRepo.insert(decision, 'task-1')
    decisionRepo.approve('decision-1')

    const updated = decisionRepo.get('decision-1')
    expect(updated?.status).toBe('approved')
    expect(updated?.approvedAt).toBeDefined()
  })
})

describe('AuditRepository', () => {
  let dbManager: DatabaseManager
  let auditRepo: AuditRepository
  let taskRepo: TaskRepository

  beforeEach(() => {
    dbManager = new DatabaseManager({ path: ':memory:' })
    dbManager.initialize()
    auditRepo = new AuditRepository(dbManager.getDatabase())
    taskRepo = new TaskRepository(dbManager.getDatabase())

    taskRepo.insert({
      id: 'task-1',
      description: 'Test task',
      status: 'running',
      mode: 'auto',
      createdAt: Date.now(),
    })
  })

  afterEach(() => {
    dbManager.close()
  })

  it('should insert and retrieve audit record', () => {
    const audit = {
      id: 'audit-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      eventType: 'warning' as const,
      reason: 'Test warning',
      timestamp: Date.now(),
    }

    auditRepo.insert(audit)
    const retrieved = auditRepo.get('audit-1')

    expect(retrieved).toBeDefined()
    expect(retrieved?.eventType).toBe('warning')
  })

  it('should get warning count for agent', () => {
    auditRepo.insert({
      id: 'audit-1',
      taskId: 'task-1',
      agentId: 'agent-1',
      eventType: 'warning',
      reason: 'Warning 1',
      timestamp: Date.now(),
    })

    auditRepo.insert({
      id: 'audit-2',
      taskId: 'task-1',
      agentId: 'agent-1',
      eventType: 'warning',
      reason: 'Warning 2',
      timestamp: Date.now(),
    })

    const count = auditRepo.countWarnings('task-1', 'agent-1')
    expect(count).toBe(2)
  })
})
