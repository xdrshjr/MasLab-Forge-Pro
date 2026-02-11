/**
 * Team Visualizer
 *
 * Provides utilities to visualize team structure in human-readable format.
 */

import type { BaseAgent } from '../agents/base-agent.js'
import type { AgentLayer } from '../types/index.js'

/**
 * Visualizes team structure
 */
export class TeamVisualizer {
  /**
   * Generate text visualization of team structure
   */
  visualize(team: Map<string, BaseAgent>): string {
    let output = '\n=== Team Structure ===\n\n'

    // Group by layer
    const topAgents = this.getAgentsByLayer(team, 'top')
    const midAgents = this.getAgentsByLayer(team, 'mid')
    const bottomAgents = this.getAgentsByLayer(team, 'bottom')

    // Top layer
    output += `Top Layer (${topAgents.length}):\n`
    for (const agent of topAgents) {
      const config = agent.getConfig()
      output += `  ├─ ${config.name} (${config.id.slice(0, 8)}...)\n`
      output += `  │  Role: ${config.role}\n`
      output += `  │  Status: ${agent.getStatus()}\n`
      output += `  │  Subordinates: ${config.subordinates.length}\n`
    }

    // Mid layer
    output += `\nMid Layer (${midAgents.length}):\n`
    for (const agent of midAgents) {
      const config = agent.getConfig()
      const supervisorName = this.getAgentName(team, config.supervisor)
      output += `  ├─ ${config.name} (${config.id.slice(0, 8)}...)\n`
      output += `  │  Supervisor: ${supervisorName}\n`
      output += `  │  Subordinates: ${config.subordinates.length}\n`
      output += `  │  Status: ${agent.getStatus()}\n`
    }

    // Bottom layer
    output += `\nBottom Layer (${bottomAgents.length}):\n`
    for (const agent of bottomAgents) {
      const config = agent.getConfig()
      const supervisorName = this.getAgentName(team, config.supervisor)
      output += `  ├─ ${config.name} (${config.id.slice(0, 8)}...)\n`
      output += `  │  Supervisor: ${supervisorName}\n`
      output += `  │  Status: ${agent.getStatus()}\n`
    }

    return output
  }

  /**
   * Generate ASCII hierarchy diagram
   */
  generateDiagram(team: Map<string, BaseAgent>): string {
    let output = '\n=== Team Hierarchy ===\n\n'

    const topAgents = this.getAgentsByLayer(team, 'top')
    const midAgents = this.getAgentsByLayer(team, 'mid')
    const bottomAgents = this.getAgentsByLayer(team, 'bottom')

    // Build hierarchy tree
    for (let i = 0; i < topAgents.length; i++) {
      const topAgent = topAgents[i]
      if (!topAgent) continue
      const topConfig = topAgent.getConfig()
      const isLast = i === topAgents.length - 1

      output += `${isLast ? '└─' : '├─'} ${topConfig.name}\n`

      // Find mid-layer subordinates
      const midSubs = midAgents.filter((m) => m.getConfig().supervisor === topConfig.id)

      for (let j = 0; j < midSubs.length; j++) {
        const midAgent = midSubs[j]
        if (!midAgent) continue
        const midConfig = midAgent.getConfig()
        const isMidLast = j === midSubs.length - 1
        const prefix = isLast ? '   ' : '│  '

        output += `${prefix}${isMidLast ? '└─' : '├─'} ${midConfig.name}\n`

        // Find bottom-layer subordinates
        const botSubs = bottomAgents.filter((b) => b.getConfig().supervisor === midConfig.id)

        for (let k = 0; k < botSubs.length; k++) {
          const botAgent = botSubs[k]
          if (!botAgent) continue
          const botConfig = botAgent.getConfig()
          const isBotLast = k === botSubs.length - 1
          const botPrefix = prefix + (isMidLast ? '   ' : '│  ')

          output += `${botPrefix}${isBotLast ? '└─' : '├─'} ${botConfig.name}\n`
        }
      }
    }

    return output
  }

  /**
   * Generate summary statistics
   */
  generateSummary(team: Map<string, BaseAgent>): string {
    const topAgents = this.getAgentsByLayer(team, 'top')
    const midAgents = this.getAgentsByLayer(team, 'mid')
    const bottomAgents = this.getAgentsByLayer(team, 'bottom')

    let output = '\n=== Team Summary ===\n\n'
    output += `Total Agents: ${team.size}\n`
    output += `  - Top Layer: ${topAgents.length}\n`
    output += `  - Mid Layer: ${midAgents.length}\n`
    output += `  - Bottom Layer: ${bottomAgents.length}\n\n`

    // Status breakdown
    const statusCounts = new Map<string, number>()
    for (const agent of team.values()) {
      const status = agent.getStatus()
      statusCounts.set(status, (statusCounts.get(status) || 0) + 1)
    }

    output += 'Status Breakdown:\n'
    for (const [status, count] of statusCounts.entries()) {
      output += `  - ${status}: ${count}\n`
    }

    return output
  }

  /**
   * Get agents by layer
   */
  private getAgentsByLayer(team: Map<string, BaseAgent>, layer: AgentLayer): BaseAgent[] {
    return Array.from(team.values()).filter((a) => a.getConfig().layer === layer)
  }

  /**
   * Get agent name by ID
   */
  private getAgentName(team: Map<string, BaseAgent>, agentId?: string): string {
    if (!agentId) return 'None'
    const agent = team.get(agentId)
    return agent ? agent.getConfig().name : agentId.slice(0, 8) + '...'
  }
}
