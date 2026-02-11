/**
 * Task Lifecycle Manager
 *
 * Manages the complete lifecycle of tasks including start, pause,
 * resume, cancel, and completion.
 */

import type { ExecutionMode } from '../types/index.js'
import type { BaseAgent } from '../agents/base-agent.js'
import type { AgentDependencies } from '../agents/types.js'
import { RequirementManager } from './requirement-manager.js'
import { TeamManager } from './team-manager.js'
import { TaskLifecycleStatus } from './types.js'
import type { ActiveTask, TaskResult } from './types.js'

/**
 * Configuration for task lifecycle manager
 */
export interface TaskLifecycleManagerConfig {
  maxAgents: number
  workspacePath: string
}

/**
 * Manages task execution lifecycle
 */
export class TaskLifecycleManager {
  private requirementManager: RequirementManager
  private teamManager: TeamManager
  private dependencies: AgentDependencies
  private activeTasks: Map<string, ActiveTask> = new Map()

  constructor(config: TaskLifecycleManagerConfig, dependencies: AgentDependencies) {
    this.requirementManager = new RequirementManager()
    this.teamManager = new TeamManager({ maxAgents: config.maxAgents }, dependencies)
    this.dependencies = dependencies
  }

  /**
   * Start a new task
   */
  async startTask(taskDescription: string, mode: ExecutionMode): Promise<string> {
    // 1. Clarify requirements
    console.log('Clarifying task requirements...')
    const taskContext = this.requirementManager.clarify(taskDescription, mode)

    // 2. Generate team structure
    console.log('Generating team structure...')
    const teamStructure = this.teamManager.generateTeam(taskContext)

    // 3. Instantiate agents
    console.log('Instantiating agent team...')
    const team = await this.teamManager.instantiateTeam(taskContext, teamStructure)

    // 4. Save to database
    this.dependencies.database.getTaskRepository().insert({
      id: taskContext.id,
      description: taskContext.description,
      status: 'running',
      mode: taskContext.mode,
      createdAt: Date.now(),
    })

    // 5. Register task
    this.activeTasks.set(taskContext.id, {
      context: taskContext,
      team,
      status: 'running' as TaskLifecycleStatus,
      startedAt: Date.now(),
    })

    // 6. Start message bus (if not already running)
    if (!this.dependencies.messageBus.isRunning()) {
      this.dependencies.messageBus.start()
    }

    console.log(`Task ${taskContext.id} started with ${team.size} agents`)

    return taskContext.id
  }

  /**
   * Pause a running task
   */
  pauseTask(taskId: string): void {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    if (task.status !== TaskLifecycleStatus.RUNNING) {
      throw new Error(`Task ${taskId} is not running (status: ${task.status})`)
    }

    // Pause all agents (set status to paused)
    for (const _agent of task.team.values()) {
      // In production, agents would have a pause() method
      // For now, we just update the task status
    }

    task.status = 'paused' as TaskLifecycleStatus

    this.dependencies.database.getTaskRepository().update(taskId, {
      status: 'paused',
    })

    console.log(`Task ${taskId} paused`)
  }

  /**
   * Resume a paused task
   */
  resumeTask(taskId: string): void {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    if (task.status !== TaskLifecycleStatus.PAUSED) {
      throw new Error(`Task ${taskId} is not paused (status: ${task.status})`)
    }

    // Resume all agents
    for (const _agent of task.team.values()) {
      // In production, agents would have a resume() method
    }

    task.status = 'running' as TaskLifecycleStatus

    this.dependencies.database.getTaskRepository().update(taskId, {
      status: 'running',
    })

    console.log(`Task ${taskId} resumed`)
  }

  /**
   * Cancel a task
   */
  async cancelTask(taskId: string): Promise<void> {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    // Dissolve team
    await this.teamManager.dissolveTeam(task.team)

    task.status = 'cancelled' as TaskLifecycleStatus

    this.dependencies.database.getTaskRepository().update(taskId, {
      status: 'cancelled',
    })

    this.activeTasks.delete(taskId)

    console.log(`Task ${taskId} cancelled`)
  }

  /**
   * Complete a task
   */
  async completeTask(taskId: string, _result: TaskResult): Promise<void> {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      return
    }

    // Dissolve team
    await this.teamManager.dissolveTeam(task.team)

    task.status = 'completed' as TaskLifecycleStatus
    task.completedAt = Date.now()

    this.dependencies.database.getTaskRepository().update(taskId, {
      status: 'completed',
      completedAt: Date.now(),
    })

    this.activeTasks.delete(taskId)

    console.log(`Task ${taskId} completed`)
  }

  /**
   * Mark a task as failed
   */
  async failTask(taskId: string, error: string): Promise<void> {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      return
    }

    // Dissolve team
    await this.teamManager.dissolveTeam(task.team)

    task.status = 'failed' as TaskLifecycleStatus
    task.completedAt = Date.now()

    this.dependencies.database.getTaskRepository().update(taskId, {
      status: 'failed',
      completedAt: Date.now(),
    })

    this.activeTasks.delete(taskId)

    console.log(`Task ${taskId} failed: ${error}`)
  }

  /**
   * Get task status
   */
  getTaskStatus(taskId: string): TaskLifecycleStatus | undefined {
    const task = this.activeTasks.get(taskId)
    return task?.status
  }

  /**
   * Get active task
   */
  getActiveTask(taskId: string): ActiveTask | undefined {
    return this.activeTasks.get(taskId)
  }

  /**
   * Get all active tasks
   */
  getAllActiveTasks(): ActiveTask[] {
    return Array.from(this.activeTasks.values())
  }

  /**
   * Replace a failed agent in a task
   */
  async replaceAgent(taskId: string, agentId: string): Promise<BaseAgent> {
    const task = this.activeTasks.get(taskId)

    if (!task) {
      throw new Error(`Task ${taskId} not found`)
    }

    return await this.teamManager.replaceAgent(agentId, task.team)
  }
}
