/**
 * Tests for TaskLifecycleManager
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TaskLifecycleManager } from '../../src/team/task-lifecycle-manager.js'
import type { AgentDependencies } from '../../src/agents/types.js'
import { DatabaseManager } from '../../src/persistence/database.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { WhiteboardSystem } from '../../src/whiteboard/system.js'
import { GovernanceEngine } from '../../src/governance/governance-engine.js'
import type { AgentRegistry } from '../../src/whiteboard/permissions.js'
import pino from 'pino'

describe('TaskLifecycleManager', () => {
  let manager: TaskLifecycleManager
  let dependencies: AgentDependencies

  beforeEach(async () => {
    // Create in-memory database
    const database = new DatabaseManager({ path: ':memory:' })
    database.initialize()

    // Create logger
    const logger = pino({ level: 'silent' })

    // Create mock dependencies
    const messageBus = new MessageBus(
      {
        heartbeatInterval: 4000,
        maxQueueSize: 1000,
      },
      database.getDatabase(),
      logger,
      'test-task-id'
    )

    // Create mock agent registry
    const mockAgentRegistry: AgentRegistry = {
      getAgent: () => ({ id: 'mock-agent', layer: 'top' }),
    }

    const whiteboardSystem = new WhiteboardSystem(
      {
        workspacePath: './.test-workspace',
        enableVersioning: false,
      },
      mockAgentRegistry
    )

    const governanceEngine = new GovernanceEngine(
      database.getDatabase(),
      messageBus,
      whiteboardSystem,
      logger,
      'test-task-id',
      {
        signatureConfig: { signatureThreshold: 2 },
        electionConfig: { interval: 50 },
        accountabilityConfig: { warningThreshold: 3, failureThreshold: 1 },
      }
    )

    dependencies = {
      database,
      messageBus,
      whiteboardSystem,
      governanceEngine,
    }

    manager = new TaskLifecycleManager(
      {
        maxAgents: 50,
        workspacePath: './.test-workspace',
      },
      dependencies
    )
  })

  describe('startTask', () => {
    it('should start a new task and return task ID', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      expect(taskId).toBeDefined()
      expect(typeof taskId).toBe('string')
    })

    it('should create task in database', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      const task = await dependencies.database.getTaskRepository().get(taskId)
      expect(task).toBeDefined()
      expect(task?.description).toBe('Create a TODO app')
      expect(task?.status).toBe('running')
    })

    it('should register task as active', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      const status = manager.getTaskStatus(taskId)
      expect(status).toBe('running')
    })

    it('should create agent team', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      const activeTask = manager.getActiveTask(taskId)
      expect(activeTask).toBeDefined()
      expect(activeTask?.team.size).toBeGreaterThan(0)
    })
  })

  describe('pauseTask', () => {
    it('should pause a running task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.pauseTask(taskId)

      const status = manager.getTaskStatus(taskId)
      expect(status).toBe('paused')
    })

    it('should update task status in database', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      manager.pauseTask(taskId)

      const task = await dependencies.database.getTaskRepository().get(taskId)
      expect(task?.status).toBe('paused')
    })

    it('should throw error for non-existent task', async () => {
      expect(() => manager.pauseTask('non-existent-id')).toThrow('not found')
    })

    it('should throw error for non-running task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')
      manager.pauseTask(taskId)

      expect(() => manager.pauseTask(taskId)).toThrow('not running')
    })
  })

  describe('resumeTask', () => {
    it('should resume a paused task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')
      await manager.pauseTask(taskId)

      await manager.resumeTask(taskId)

      const status = manager.getTaskStatus(taskId)
      expect(status).toBe('running')
    })

    it('should update task status in database', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')
      manager.pauseTask(taskId)

      manager.resumeTask(taskId)

      const task = await dependencies.database.getTaskRepository().get(taskId)
      expect(task?.status).toBe('running')
    })

    it('should throw error for non-paused task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      expect(() => manager.resumeTask(taskId)).toThrow('not paused')
    })
  })

  describe('cancelTask', () => {
    it('should cancel a task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.cancelTask(taskId)

      const status = manager.getTaskStatus(taskId)
      expect(status).toBeUndefined() // Task removed from active tasks
    })

    it('should dissolve team', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')
      const activeTask = manager.getActiveTask(taskId)
      const teamSize = activeTask?.team.size || 0

      expect(teamSize).toBeGreaterThan(0)

      await manager.cancelTask(taskId)

      const cancelledTask = manager.getActiveTask(taskId)
      expect(cancelledTask).toBeUndefined()
    })

    it('should update task status in database', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.cancelTask(taskId)

      const task = await dependencies.database.getTaskRepository().get(taskId)
      expect(task?.status).toBe('cancelled')
    })
  })

  describe('completeTask', () => {
    it('should complete a task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.completeTask(taskId, {
        success: true,
        output: 'Task completed successfully',
        duration: 1000,
      })

      const status = manager.getTaskStatus(taskId)
      expect(status).toBeUndefined() // Task removed from active tasks
    })

    it('should update task status in database', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.completeTask(taskId, {
        success: true,
        output: 'Task completed successfully',
        duration: 1000,
      })

      const task = await dependencies.database.getTaskRepository().get(taskId)
      expect(task?.status).toBe('completed')
      expect(task?.completedAt).toBeDefined()
    })
  })

  describe('failTask', () => {
    it('should mark task as failed', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.failTask(taskId, 'Test error')

      const status = manager.getTaskStatus(taskId)
      expect(status).toBeUndefined() // Task removed from active tasks
    })

    it('should update task status in database', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')

      await manager.failTask(taskId, 'Test error')

      const task = await dependencies.database.getTaskRepository().get(taskId)
      expect(task?.status).toBe('failed')
    })
  })

  describe('getAllActiveTasks', () => {
    it('should return all active tasks', async () => {
      const taskId1 = await manager.startTask('Task 1', 'auto')
      const taskId2 = await manager.startTask('Task 2', 'auto')

      const activeTasks = manager.getAllActiveTasks()

      expect(activeTasks).toHaveLength(2)
      expect(activeTasks.some((t) => t.context.id === taskId1)).toBe(true)
      expect(activeTasks.some((t) => t.context.id === taskId2)).toBe(true)
    })

    it('should return empty array when no active tasks', () => {
      const activeTasks = manager.getAllActiveTasks()

      expect(activeTasks).toHaveLength(0)
    })
  })

  describe('replaceAgent', () => {
    it('should replace failed agent in task', async () => {
      const taskId = await manager.startTask('Create a TODO app', 'auto')
      const activeTask = manager.getActiveTask(taskId)
      const agentId = Array.from(activeTask!.team.keys())[0]

      const newAgent = await manager.replaceAgent(taskId, agentId)

      expect(newAgent).toBeDefined()
      expect(newAgent.getConfig().id).not.toBe(agentId)
    })

    it('should throw error for non-existent task', async () => {
      await expect(manager.replaceAgent('non-existent-task', 'agent-id')).rejects.toThrow('not found')
    })
  })
})
