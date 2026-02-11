/**
 * AgentTeam SDK
 *
 * Main SDK class for programmatic access to the multi-agent governance framework.
 * Provides a high-level API for starting tasks, monitoring progress, and controlling execution.
 */

import { EventEmitter } from 'node:events'
import type {
  AgentTeamConfig,
  SDKTaskResult,
  SDKTeamStatus,
  AgentStatusSummary,
  EventHandler,
} from './types.js'
import type { DatabaseManager } from '../persistence/database.js'
import type { MessageBus } from '../communication/message-bus.js'
import type { TaskLifecycleManager } from '../team/task-lifecycle-manager.js'
import type { BaseAgent } from '../agents/base-agent.js'

/**
 * Main SDK class for managing multi-agent teams
 */
export class AgentTeam {
  private config: Required<AgentTeamConfig>
  private eventEmitter: EventEmitter
  private currentTaskId: string | null = null

  // Core systems (initialized in initialize())
  // Note: Only declaring properties that are actually used in the placeholder implementation
  // Additional properties will be added when the full implementation is complete
  private _database!: DatabaseManager
  private _messageBus!: MessageBus
  private _lifecycleManager!: TaskLifecycleManager

  private initialized = false

  /**
   * Create a new AgentTeam instance
   *
   * @param config - Configuration options
   */
  constructor(config: AgentTeamConfig) {
    this.config = this.normalizeConfig(config)
    this.eventEmitter = new EventEmitter()
  }

  /**
   * Normalize configuration with defaults
   */
  private normalizeConfig(config: AgentTeamConfig): Required<AgentTeamConfig> {
    return {
      mode: config.mode,
      heartbeatInterval: config.heartbeatInterval ?? 4000,
      maxBottomAgents: config.maxBottomAgents ?? 5,
      databasePath: config.databasePath ?? './.agent-workspace/task.db',
      workspacePath: config.workspacePath ?? './.agent-workspace',
      projectRoot: config.projectRoot ?? '.',
      llmModel: config.llmModel ?? 'claude-3-5-sonnet',
      governance: {
        signatureThreshold: config.governance?.signatureThreshold ?? 0.67,
        electionInterval: config.governance?.electionInterval ?? 50,
        warningThreshold: config.governance?.warningThreshold ?? 3,
      },
    }
  }

  /**
   * Start a new task
   *
   * @param taskDescription - Natural language description of the task
   * @returns Task execution result
   */
  async start(taskDescription: string): Promise<SDKTaskResult> {
    this.emit('log', 'Starting multi-agent team...')

    // Initialize all systems
    await this.initialize()

    // Start task
    const startTime = Date.now()
    this.currentTaskId = await this._lifecycleManager.startTask(taskDescription, this.config.mode)

    this.emit('log', `Task started: ${this.currentTaskId}`)

    // Wait for completion or user intervention
    const result = await this.waitForCompletion(this.currentTaskId)

    // Calculate duration
    result.duration = Date.now() - startTime

    // Cleanup
    await this.cleanup()

    return result
  }

  /**
   * Pause the current task
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async pause(): Promise<void> {
    if (!this.currentTaskId) {
      throw new Error('No active task to pause')
    }

    this._lifecycleManager.pauseTask(this.currentTaskId)
    this.emit('log', 'Task paused')
  }

  /**
   * Resume the paused task
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async resume(): Promise<void> {
    if (!this.currentTaskId) {
      throw new Error('No active task to resume')
    }

    this._lifecycleManager.resumeTask(this.currentTaskId)
    this.emit('log', 'Task resumed')
  }

  /**
   * Cancel the current task
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  async cancel(): Promise<void> {
    if (!this.currentTaskId) {
      throw new Error('No active task to cancel')
    }

    void this._lifecycleManager.cancelTask(this.currentTaskId)
    this.emit('log', 'Task cancelled')
  }

  /**
   * Get current team status
   *
   * @returns Current status snapshot
   */
  getStatus(): SDKTeamStatus {
    if (!this.currentTaskId) {
      throw new Error('No active task')
    }

    const task = this._lifecycleManager.getActiveTask(this.currentTaskId)
    if (!task) {
      throw new Error('Task not found')
    }

    const agents = this.getAgents()

    return {
      taskId: this.currentTaskId,
      status: task.status,
      currentHeartbeat: this._messageBus.getCurrentHeartbeat(),
      elapsedTime: this._messageBus.getCurrentHeartbeat() * this.config.heartbeatInterval,
      teamSize: agents.length,
      agents: agents.map((agent) => this.mapAgentToSummary(agent)),
      // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
      recentMessages: this.getRecentMessages(10),
      whiteboard: '', // TODO: Make this async or cache the whiteboard content
    }
  }

  /**
   * Get all agents in the team
   *
   * @returns Array of agents
   */
  getAgents(): BaseAgent[] {
    if (!this.currentTaskId) {
      return []
    }

    const task = this._lifecycleManager.getActiveTask(this.currentTaskId)
    if (!task) {
      return []
    }

    return Array.from(task.team.values())
  }

  /**
   * Register event listener
   *
   * @param event - Event name
   * @param callback - Event handler
   */
  on(event: string, callback: EventHandler): void {
    this.eventEmitter.on(event, callback)
  }

  /**
   * Remove event listener
   *
   * @param event - Event name
   * @param callback - Event handler
   */
  off(event: string, callback: EventHandler): void {
    this.eventEmitter.off(event, callback)
  }

  /**
   * Emit event
   */
  private emit(event: string, ...args: unknown[]): void {
    this.eventEmitter.emit(event, ...args)
  }

  /**
   * Initialize all systems
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async initialize(): Promise<void> {
    if (this.initialized) {
      return
    }

    this.emit('log', 'Initializing systems...')

    // Note: This is a placeholder implementation
    // The actual initialization will be completed when all dependencies are ready
    // For now, we throw an error to indicate this is not yet implemented
    throw new Error(
      'AgentTeam initialization not yet implemented - requires all core systems to be integrated'
    )

    // TODO: Uncomment and implement when dependencies are ready
    /*
    // Initialize database
    this._database = new DatabaseManager(this.config.databasePath)
    await this._database.initialize()

    // Initialize whiteboard system
    this._whiteboardSystem = new WhiteboardSystem({
      workspacePath: this.config.workspacePath,
      enableVersioning: true
    })

    // Initialize message bus
    this._messageBus = new MessageBus({
      heartbeatInterval: this.config.heartbeatInterval
    }, this._database)

    // Initialize governance engine
    this.governanceEngine = new GovernanceEngine(
      this._database,
      this._messageBus,
      this._whiteboardSystem,
      this.config.governance
    )

    // Initialize team manager
    this.teamManager = new TeamManager(
      new RoleGenerator(),
      new AgentPool(),
      this.governanceEngine,
      {
        messageBus: this._messageBus,
        whiteboardSystem: this._whiteboardSystem,
        governanceEngine: this.governanceEngine,
        database: this._database
      }
    )

    // Initialize lifecycle manager
    this._lifecycleManager = new TaskLifecycleManager(
      new RequirementManager(),
      this.teamManager,
      this._messageBus,
      this._database
    )

    this.initialized = true
    this.emit('log', 'Systems initialized')
    */
  }

  /**
   * Wait for task completion
   */
  private async waitForCompletion(taskId: string): Promise<SDKTaskResult> {
    return new Promise((resolve, reject) => {
      // Listen for task completion
      this.on('task:completed', (...args: unknown[]) => {
        const result = args[0] as SDKTaskResult
        if (result.taskId === taskId) {
          resolve(result)
        }
      })

      // Listen for task failure
      this.on('task:failed', (...args: unknown[]) => {
        const result = args[0] as SDKTaskResult
        if (result.taskId === taskId) {
          resolve(result)
        }
      })

      // Set timeout (2 hours)
      setTimeout(
        () => {
          reject(new Error('Task timeout after 2 hours'))
        },
        2 * 60 * 60 * 1000
      )
    })
  }

  /**
   * Cleanup resources
   */
  // eslint-disable-next-line @typescript-eslint/require-await
  private async cleanup(): Promise<void> {
    this.emit('log', 'Cleaning up...')

    // Stop message bus
    if (this._messageBus) {
      this._messageBus.stop()
    }

    // Close database
    if (this._database) {
      this._database.close()
    }

    this.initialized = false
    this.emit('log', 'Cleanup complete')
  }

  /**
   * Map agent to summary
   *
   * TODO: Add public getter methods in BaseAgent to avoid accessing protected properties
   */
  private mapAgentToSummary(agent: BaseAgent): AgentStatusSummary {
    // Type assertion to access protected config - will be fixed when BaseAgent has public getters
    interface AgentWithConfig {
      config: {
        id: string
        name: string
        layer: AgentLayer
        role: string
        supervisor?: string
      }
    }
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const agentWithConfig = agent as unknown as AgentWithConfig
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
    return {
      id: agentWithConfig.config.id,
      name: agentWithConfig.config.name,
      layer: agentWithConfig.config.layer,
      role: agentWithConfig.config.role,
      status: agent.getStatus(),
      supervisor: agentWithConfig.config.supervisor,
    }
    /* eslint-enable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access */
  }

  /**
   * Get recent messages
   */
  private getRecentMessages(_count: number): Message[] {
    // TODO: Implement when message bus is ready
    return [] as Message[]
  }
}
