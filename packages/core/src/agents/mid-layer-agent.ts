/**
 * Mid Layer Agent
 *
 * Implements tactical planning, task delegation, and progress monitoring
 * for the middle tier of the governance hierarchy.
 */

import { BaseAgent } from './base-agent.js'
import { AgentStatus, MessageType } from '../types/index.js'
import type { Message } from '../types/index.js'
import type {
  MidLayerAgentConfig,
  AgentDependencies,
  AgentTask,
  Issue,
  ProgressReport,
  TaskDecomposition,
  SubTask,
} from './types.js'

/**
 * Mid layer agent with tactical planning capabilities
 */
export class MidLayerAgent extends BaseAgent {
  protected domain: string
  protected taskQueue: AgentTask[] = []
  protected subordinateStatus: Map<string, AgentStatus> = new Map()

  constructor(config: MidLayerAgentConfig, dependencies: AgentDependencies) {
    super(config, dependencies)
    this.domain = config.domain
  }

  protected async onInitialize(): Promise<void> {
    console.log(`[${this.config.name}] Domain: ${this.domain}`)
    // Wait for subordinate assignment
    await this.waitForSubordinateAssignment()
    this.taskQueue = []
  }

  protected async onProcess(messages: Message[], _whiteboardContent: string): Promise<void> {
    // 1. Receive tasks from top layer
    const taskAssignments = messages.filter(
      (m) => m.type === MessageType.TASK_ASSIGN && m.from.startsWith('top-')
    )
    for (const assignment of taskAssignments) {
      this.taskQueue.push(assignment.content.task as AgentTask)
    }

    // 2. Delegate to subordinates
    if (this.taskQueue.length > 0) {
      await this.delegateTasksToSubordinates()
    }

    // 3. Collect subordinate progress
    const subordinateReports = messages.filter(
      (m) => m.type === MessageType.PROGRESS_REPORT && this.config.subordinates.includes(m.from)
    )
    await this.aggregateSubordinateProgress(subordinateReports)

    // 4. Coordinate with peers
    const peerMessages = messages.filter((m) => m.type === MessageType.PEER_COORDINATION)
    for (const peerMsg of peerMessages) {
      await this.coordinateWithPeer(peerMsg)
    }

    // 5. Escalate issues if needed
    const issues = await this.detectIssues()
    if (issues.length > 0) {
      await this.escalateToTopLayer(issues)
    }

    // 6. Report to top layer periodically
    if (this.shouldReport()) {
      await this.reportToTopLayer()
    }
  }

  protected async onShutdown(): Promise<void> {
    if (this.taskQueue.length > 0) {
      console.warn(
        `[${this.config.name}] Shutting down with ${this.taskQueue.length} pending tasks`
      )
    }
  }

  protected getResponsibilitiesDescription(): string {
    return `
- Receive tasks from top layer and decompose into subtasks
- Assign subtasks to bottom-layer agents
- Monitor subordinate progress and quality
- Coordinate with peer mid-layer agents
- Detect issues and escalate to top layer
- Report overall progress periodically
    `.trim()
  }

  // ===== Mid-Layer Specific Methods =====

  /**
   * Wait for subordinate assignment
   */
  private async waitForSubordinateAssignment(): Promise<void> {
    console.log(`[${this.config.name}] Waiting for subordinate assignment...`)
    // Placeholder for team manager integration
  }

  /**
   * Delegate tasks to subordinates
   */
  private async delegateTasksToSubordinates(): Promise<void> {
    console.log(`[${this.config.name}] Delegating ${this.taskQueue.length} tasks to subordinates`)

    // Use LLM to decompose tasks (will integrate with pi-agent-core in Task 09)
    const decomposition = await this.decomposeTask(this.taskQueue)

    // Assign subtasks
    for (const subtask of decomposition.subtasks) {
      const assigneeId = subtask.assignee
      this.sendMessage(assigneeId, MessageType.TASK_ASSIGN, { task: subtask })
      console.log(`[${this.config.name}] Assigned to ${assigneeId}: ${subtask.description}`)
    }

    // Update whiteboard
    await this.writeWhiteboard(`
## Task Allocation Plan

${decomposition.subtasks.map((st: SubTask) => `- [${st.assignee}] ${st.description}`).join('\n')}
    `)

    this.taskQueue = []
  }

  /**
   * Decompose task (placeholder for LLM integration)
   */
  private async decomposeTask(tasks: AgentTask[]): Promise<TaskDecomposition> {
    // Placeholder - will integrate with pi-agent-core in Task 09
    return {
      subtasks: tasks.map((task, index) => ({
        id: task.id,
        description: task.description,
        assignee: this.config.subordinates[index % this.config.subordinates.length] || 'unassigned',
        dependencies: task.dependencies,
      })),
      dependencies: {},
    }
  }

  /**
   * Aggregate subordinate progress
   */
  private async aggregateSubordinateProgress(reports: Message[]): Promise<void> {
    for (const report of reports) {
      const agentId = report.from
      const progress = report.content.progress as ProgressReport

      this.subordinateStatus.set(agentId, progress.status as AgentStatus)

      // Record to whiteboard
      await this.appendToWhiteboard(`
- [${agentId}] ${progress.status || 'unknown'}: ${progress.description || ''} (${progress.percentage || 0}%)
      `)
    }
  }

  /**
   * Append to own whiteboard
   */
  private async appendToWhiteboard(content: string): Promise<void> {
    const currentContent = await this.readWhiteboard(this.config.layer, this.config.id)
    await this.writeWhiteboard(currentContent + '\n' + content)
  }

  /**
   * Coordinate with peer
   */
  private async coordinateWithPeer(peerMsg: Message): Promise<void> {
    const peerId = peerMsg.from
    const request = peerMsg.content

    console.log(`[${this.config.name}] Coordinating with peer ${peerId}: ${request.topic}`)

    // Respond to peer (placeholder for LLM integration)
    const response = await this.generatePeerResponse(request)

    this.sendMessage(peerId, MessageType.PEER_COORDINATION_RESPONSE, response)
  }

  /**
   * Generate peer response (placeholder for LLM integration)
   */
  private async generatePeerResponse(
    _request: Record<string, unknown>
  ): Promise<Record<string, unknown>> {
    // Placeholder - will integrate with pi-agent-core in Task 09
    return { status: 'acknowledged' }
  }

  /**
   * Detect issues
   */
  private async detectIssues(): Promise<Issue[]> {
    const issues: Issue[] = []

    // Check for blocked subordinates
    for (const [agentId, status] of this.subordinateStatus) {
      if (status === AgentStatus.BLOCKED || status === AgentStatus.FAILED) {
        issues.push({
          id: `issue-${Date.now()}`,
          description: `Agent ${agentId} is ${status}`,
          severity: status === AgentStatus.FAILED ? 'high' : 'medium',
          affectedAgents: [agentId],
          timestamp: Date.now(),
        })
      }
    }

    return issues
  }

  /**
   * Escalate issues to top layer
   */
  private async escalateToTopLayer(issues: Issue[]): Promise<void> {
    if (!this.config.supervisor) {
      console.warn(`[${this.config.name}] No supervisor to escalate to`)
      return
    }

    for (const issue of issues) {
      console.log(`[${this.config.name}] Escalating issue: ${issue.description}`)
      this.sendMessage(this.config.supervisor, MessageType.ISSUE_ESCALATION, {
        issue,
        impact: this.assessImpact(issue),
        proposedSolution: await this.proposeSolution(issue),
      })
    }
  }

  /**
   * Assess impact of an issue
   */
  private assessImpact(issue: Issue): string {
    // Placeholder for impact assessment
    return `${issue.severity} severity impact`
  }

  /**
   * Propose solution for an issue
   */
  private async proposeSolution(_issue: Issue): Promise<string> {
    // Placeholder for solution proposal
    return 'Reassign task to another agent'
  }

  /**
   * Check if should report to top layer
   */
  private shouldReport(): boolean {
    // Report every 10 heartbeats (placeholder logic)
    return this.metrics.heartbeatsResponded % 10 === 0
  }

  /**
   * Report to top layer
   */
  private async reportToTopLayer(): Promise<void> {
    if (!this.config.supervisor) {
      return
    }

    const report = {
      agentId: this.config.id,
      domain: this.domain,
      tasksInQueue: this.taskQueue.length,
      subordinateCount: this.config.subordinates.length,
      metrics: this.metrics,
    }

    this.sendMessage(this.config.supervisor, MessageType.PROGRESS_REPORT, { progress: report })
  }
}
