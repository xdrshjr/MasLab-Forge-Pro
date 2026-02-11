/**
 * Team Manager
 *
 * Orchestrates team lifecycle including generation, instantiation,
 * agent replacement, and team dissolution.
 */

import type {
  AgentDependencies,
  TopLayerAgentConfig,
  MidLayerAgentConfig,
  BottomLayerAgentConfig,
} from '../agents/types.js'
import type { BaseAgent } from '../agents/base-agent.js'
import { AgentPool, type AnyAgentConfig } from '../agents/agent-pool.js'
import { RoleGenerator } from './role-generator.js'
import { TeamValidator } from './team-validator.js'
import type { TaskContext, TeamStructure } from './types.js'

/**
 * Configuration for team manager
 */
export interface TeamManagerConfig {
  maxAgents: number
}

/**
 * Manages agent team lifecycle
 */
export class TeamManager {
  private roleGenerator: RoleGenerator
  private validator: TeamValidator
  private agentPool: AgentPool

  constructor(config: TeamManagerConfig, dependencies: AgentDependencies) {
    this.roleGenerator = new RoleGenerator()
    this.validator = new TeamValidator()
    this.agentPool = new AgentPool({ maxAgents: config.maxAgents }, dependencies)
  }

  /**
   * Generate complete team structure
   */
  generateTeam(taskContext: TaskContext): TeamStructure {
    console.log(`Generating team for task: ${taskContext.id}`)

    // 1. Generate top layer (3 roles)
    const topLayerRoles = this.roleGenerator.generateTopLayerRoles(taskContext)
    console.log(`Top layer: ${topLayerRoles.map((r) => r.name).join(', ')}`)

    // 2. Generate mid layer (2-5 roles)
    const midLayerRoles = this.roleGenerator.generateMidLayerRoles(taskContext, topLayerRoles)
    console.log(`Mid layer: ${midLayerRoles.map((r) => r.name).join(', ')}`)

    // 3. Generate bottom layer
    const bottomLayerRoles = this.roleGenerator.generateBottomLayerRoles(midLayerRoles)
    console.log(`Bottom layer: ${bottomLayerRoles.length} agents`)

    const teamStructure: TeamStructure = {
      topLayer: topLayerRoles,
      midLayer: midLayerRoles,
      bottomLayer: bottomLayerRoles,
    }

    // 4. Validate structure
    const validation = this.validator.validate(teamStructure)
    if (!validation.valid) {
      throw new Error(`Invalid team structure: ${validation.errors.join(', ')}`)
    }

    // 5. Request approval if semi-auto mode
    if (taskContext.mode === 'semi-auto') {
      const approved = this.requestUserApproval(teamStructure)
      if (!approved) {
        // In production, would allow modification and regeneration
        throw new Error('Team structure not approved by user')
      }
    }

    return teamStructure
  }

  /**
   * Instantiate agent team from structure
   */
  async instantiateTeam(
    _taskContext: TaskContext,
    teamStructure: TeamStructure
  ): Promise<Map<string, BaseAgent>> {
    const agents = new Map<string, BaseAgent>()

    // 1. Create top layer agents
    const topAgentIds: string[] = []
    const powerTypes: Array<'power_a' | 'power_b' | 'power_c'> = ['power_a', 'power_b', 'power_c']
    for (let i = 0; i < teamStructure.topLayer.length; i++) {
      const role = teamStructure.topLayer[i]
      if (!role) continue

      const config: TopLayerAgentConfig = {
        id: this.generateUUID(),
        name: role.name,
        layer: 'top',
        role: role.responsibilities.join('; '),
        subordinates: [],
        capabilities: role.capabilities,
        powerType: powerTypes[i % powerTypes.length] || 'power_a',
        voteWeight: 1,
        signatureAuthority: role.signatureAuthority || [],
        config: {
          maxRetries: 3,
          timeoutMs: 30000,
        },
      }

      const agent = await this.agentPool.createAgent(config)
      agents.set(agent.getConfig().id, agent)
      topAgentIds.push(agent.getConfig().id)
    }

    // 2. Create mid layer agents
    const midAgentIds: string[] = []
    for (let i = 0; i < teamStructure.midLayer.length; i++) {
      const role = teamStructure.midLayer[i]
      if (!role) continue

      // Assign supervisor (round-robin from top layer)
      const supervisorId = topAgentIds[i % topAgentIds.length]

      const config: MidLayerAgentConfig = {
        id: this.generateUUID(),
        name: role.name,
        layer: 'mid',
        role: role.responsibilities.join('; '),
        supervisor: supervisorId,
        subordinates: [],
        capabilities: role.capabilities,
        domain: role.domain || 'general',
        maxSubordinates: 10,
        config: {
          maxRetries: 3,
          timeoutMs: 30000,
        },
      }

      const agent = await this.agentPool.createAgent(config)
      agents.set(agent.getConfig().id, agent)
      midAgentIds.push(agent.getConfig().id)

      // Update supervisor's subordinates
      if (supervisorId) {
        const supervisor = agents.get(supervisorId)
        if (supervisor) {
          supervisor.getConfig().subordinates.push(agent.getConfig().id)
        }
      }
    }

    // 3. Create bottom layer agents
    for (const role of teamStructure.bottomLayer) {
      if (!role) continue

      // Determine supervisor from role name
      const supervisorId = this.findMidLayerSupervisor(role.name, midAgentIds, agents)

      const config: BottomLayerAgentConfig = {
        id: this.generateUUID(),
        name: role.name,
        layer: 'bottom',
        role: role.responsibilities.join('; '),
        supervisor: supervisorId,
        subordinates: [],
        capabilities: role.capabilities,
        tools: role.tools || [],
        config: {
          maxRetries: 3,
          timeoutMs: 30000,
        },
      }

      const agent = await this.agentPool.createAgent(config)
      agents.set(agent.getConfig().id, agent)

      // Update supervisor's subordinates
      if (supervisorId) {
        const supervisor = agents.get(supervisorId)
        if (supervisor) {
          supervisor.getConfig().subordinates.push(agent.getConfig().id)
        }
      }
    }

    console.log(`Team instantiated: ${agents.size} agents`)

    return agents
  }

  /**
   * Replace a failed agent
   */
  async replaceAgent(agentId: string, team: Map<string, BaseAgent>): Promise<BaseAgent> {
    const oldAgent = team.get(agentId)

    if (!oldAgent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    const oldConfig = oldAgent.getConfig()

    // Create new agent with same configuration
    const newConfig = {
      ...oldConfig,
      id: this.generateUUID(),
      name: `${oldConfig.name} (Replacement)`,
      subordinates: [], // Will be reassigned
    }

    const newAgent = await this.agentPool.createAgent(newConfig as unknown as AnyAgentConfig)

    // Update supervisor's subordinate list
    if (oldConfig.supervisor) {
      const supervisor = team.get(oldConfig.supervisor)
      if (supervisor) {
        const supervisorConfig = supervisor.getConfig()
        const oldIndex = supervisorConfig.subordinates.indexOf(agentId)
        if (oldIndex !== -1) {
          supervisorConfig.subordinates.splice(oldIndex, 1)
        }
        supervisorConfig.subordinates.push(newAgent.getConfig().id)
      }
    }

    // Transfer subordinates to new agent
    for (const subordinateId of oldConfig.subordinates) {
      const subordinate = team.get(subordinateId)
      if (subordinate) {
        subordinate.getConfig().supervisor = newAgent.getConfig().id
        newAgent.getConfig().subordinates.push(subordinateId)
      }
    }

    // Remove old agent from team
    team.delete(agentId)
    await this.agentPool.destroyAgent(agentId)

    // Add new agent to team
    team.set(newAgent.getConfig().id, newAgent)

    console.log(`Agent ${agentId} replaced with ${newAgent.getConfig().id}`)

    return newAgent
  }

  /**
   * Dissolve entire team
   */
  async dissolveTeam(team: Map<string, BaseAgent>): Promise<void> {
    console.log(`Dissolving team: ${team.size} agents`)

    // Shutdown all agents
    const agentIds = Array.from(team.keys())
    for (const agentId of agentIds) {
      await this.agentPool.destroyAgent(agentId)
    }

    team.clear()
    console.log('Team dissolved')
  }

  /**
   * Find mid-layer supervisor for bottom-layer agent
   */
  private findMidLayerSupervisor(
    bottomRoleName: string,
    midAgentIds: string[],
    agents: Map<string, BaseAgent>
  ): string {
    // Parse mid-layer prefix from bottom role name
    // e.g., "backend-Agent-1" -> find "Backend Lead"
    const prefix = (bottomRoleName.split('-')[0] || '').toLowerCase()

    for (const midId of midAgentIds) {
      const midAgent = agents.get(midId)
      if (midAgent) {
        const midName = midAgent.getConfig().name.toLowerCase()
        if (midName.includes(prefix)) {
          return midId
        }
      }
    }

    // Fallback: round-robin
    return midAgentIds[0] || ''
  }

  /**
   * Request user approval for team structure
   */
  private requestUserApproval(teamStructure: TeamStructure): boolean {
    // In production, this would integrate with TUI/CLI for user input
    console.log('\n=== Proposed Team Structure ===')
    console.log('Top Layer:')
    for (const role of teamStructure.topLayer) {
      console.log(`  - ${role.name}: ${role.responsibilities.join(', ')}`)
    }

    console.log('\nMid Layer:')
    for (const role of teamStructure.midLayer) {
      console.log(`  - ${role.name}: ${role.responsibilities.join(', ')}`)
    }

    console.log(`\nBottom Layer: ${teamStructure.bottomLayer.length} agents`)

    // Auto-approve for now
    return true
  }

  /**
   * Generate UUID
   */
  private generateUUID(): string {
    return `agent-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }

  /**
   * Get agent pool
   */
  getAgentPool(): AgentPool {
    return this.agentPool
  }
}
