/**
 * Bottom Layer Agent
 *
 * Implements task execution, tool invocation, and result reporting
 * for the bottom tier of the governance hierarchy.
 */

import { BaseAgent } from './base-agent.js'
import { AgentStatus, MessageType } from '../types/index.js'
import type { Message } from '../types/index.js'
import type { BottomLayerAgentConfig, AgentDependencies, AgentTask } from './types.js'

/**
 * Bottom layer agent with execution capabilities
 */
export class BottomLayerAgent extends BaseAgent {
  protected currentTask: AgentTask | null = null
  protected tools: string[]

  constructor(config: BottomLayerAgentConfig, dependencies: AgentDependencies) {
    super(config, dependencies)
    this.tools = config.tools
  }

  protected async onInitialize(): Promise<void> {
    console.log(`[${this.config.name}] Tools: ${this.tools.join(', ')}`)
  }

  protected async onProcess(messages: Message[], _whiteboardContent: string): Promise<void> {
    // 1. Receive task from mid-layer
    const taskAssignments = messages.filter(
      (m) => m.type === MessageType.TASK_ASSIGN && m.from === this.config.supervisor
    )
    if (taskAssignments.length > 0 && taskAssignments[0]) {
      this.currentTask = taskAssignments[0].content.task as AgentTask
    }

    // 2. Execute current task
    if (this.currentTask && this.status === AgentStatus.IDLE) {
      await this.executeCurrentTask()
    }

    // 3. Help peers if requested
    const peerRequests = messages.filter((m) => m.type === MessageType.PEER_HELP_REQUEST)
    for (const request of peerRequests) {
      await this.helpPeer(request)
    }

    // 4. Respond to supervisor queries
    const supervisorQueries = messages.filter(
      (m) => m.type === MessageType.STATUS_QUERY && m.from === this.config.supervisor
    )
    if (supervisorQueries.length > 0) {
      await this.reportStatus()
    }
  }

  protected async onShutdown(): Promise<void> {
    if (this.currentTask) {
      console.warn(
        `[${this.config.name}] Shutting down with incomplete task: ${this.currentTask.description}`
      )
    }
  }

  protected getResponsibilitiesDescription(): string {
    return `
- Receive specific tasks from mid-layer supervisor
- Execute tasks using available tools
- Record execution results to whiteboard
- Report progress and results to supervisor
- Collaborate with peers when needed
    `.trim()
  }

  // ===== Bottom-Layer Specific Methods =====

  /**
   * Execute the current task
   */
  private async executeCurrentTask(): Promise<void> {
    if (!this.currentTask) {
      return
    }

    this.stateMachine.transition(this, AgentStatus.WORKING, 'executing task')
    console.log(`[${this.config.name}] Executing: ${this.currentTask.description}`)

    const startTime = Date.now()

    try {
      // Execute using tools (will integrate pi-coding-agent in Task 09)
      const result = await this.executeWithTools(this.currentTask)

      const duration = Date.now() - startTime

      // Update whiteboard
      await this.writeWhiteboard(`
## Task Execution Result

Task: ${this.currentTask.description}
Status: ${result.success ? 'Success' : 'Failed'}
Duration: ${duration}ms
Output:
\`\`\`
${result.output}
\`\`\`
      `)

      // Report to supervisor
      if (this.config.supervisor) {
        this.sendMessage(this.config.supervisor, MessageType.PROGRESS_REPORT, {
          progress: {
            taskId: this.currentTask.id,
            status: result.success ? 'completed' : 'failed',
            percentage: 100,
            description: result.success ? 'Task completed successfully' : 'Task failed',
            result,
          },
        })
      }

      // Update metrics
      if (result.success) {
        this.metrics.tasksCompleted++
      } else {
        this.metrics.tasksFailed++
      }

      // Update average task duration
      this.updateAverageTaskDuration(duration)

      this.currentTask = null
      this.stateMachine.transition(this, AgentStatus.IDLE, 'task complete')
    } catch (error) {
      console.error(`[${this.config.name}] Task execution failed:`, error)
      await this.handleError(error as Error)
    }
  }

  /**
   * Execute task with tools (placeholder for pi-coding-agent integration)
   */
  private async executeWithTools(task: AgentTask): Promise<any> {
    // Placeholder - will integrate with pi-coding-agent in Task 09
    console.log(`[${this.config.name}] Executing task with tools: ${this.tools.join(', ')}`)

    // Simulate task execution
    await new Promise((resolve) => setTimeout(resolve, 100))

    return {
      success: true,
      output: `Task "${task.description}" completed successfully`,
    }
  }

  /**
   * Update average task duration
   */
  private updateAverageTaskDuration(duration: number): void {
    const totalTasks = this.metrics.tasksCompleted + this.metrics.tasksFailed
    if (totalTasks === 0) {
      this.metrics.averageTaskDuration = duration
    } else {
      this.metrics.averageTaskDuration =
        (this.metrics.averageTaskDuration * (totalTasks - 1) + duration) / totalTasks
    }
  }

  /**
   * Help a peer agent
   */
  private async helpPeer(request: Message): Promise<void> {
    const peerId = request.from
    const helpType = request.content.helpType

    console.log(`[${this.config.name}] Received help request from ${peerId}: ${helpType}`)

    if (helpType === 'share_knowledge') {
      // Share knowledge from whiteboard
      const knowledge = await this.readWhiteboard(this.config.layer, this.config.id)
      this.sendMessage(peerId, MessageType.PEER_HELP_RESPONSE, { knowledge })
    } else if (helpType === 'take_over_task') {
      // Take over task if idle
      if (this.status === AgentStatus.IDLE && !this.currentTask) {
        this.currentTask = request.content.task as AgentTask
        this.sendMessage(peerId, MessageType.PEER_HELP_RESPONSE, {
          accepted: true,
        })
        console.log(`[${this.config.name}] Accepted task from ${peerId}`)
      } else {
        this.sendMessage(peerId, MessageType.PEER_HELP_RESPONSE, {
          accepted: false,
          reason: 'busy',
        })
      }
    }
  }

  /**
   * Report status to supervisor
   */
  private async reportStatus(): Promise<void> {
    if (!this.config.supervisor) {
      return
    }

    this.sendMessage(this.config.supervisor, MessageType.STATUS_REPORT, {
      status: this.status,
      currentTask: this.currentTask,
      metrics: this.metrics,
    })
  }
}
