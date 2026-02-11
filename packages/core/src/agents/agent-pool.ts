/**
 * Agent Pool Manager
 *
 * Manages the lifecycle of agent instances, including creation,
 * destruction, and registry of all active agents.
 */

import type { AgentLayer } from '../types/index.js'
import type {
  AgentDependencies,
  TopLayerAgentConfig,
  MidLayerAgentConfig,
  BottomLayerAgentConfig,
} from './types.js'
import { BaseAgent } from './base-agent.js'
import { TopLayerAgent } from './top-layer-agent.js'
import { MidLayerAgent } from './mid-layer-agent.js'
import { BottomLayerAgent } from './bottom-layer-agent.js'

/**
 * Union type for all agent config types
 */
export type AnyAgentConfig = TopLayerAgentConfig | MidLayerAgentConfig | BottomLayerAgentConfig

/**
 * Agent pool configuration
 */
export interface AgentPoolConfig {
  maxAgents: number
}

/**
 * Manages a pool of agent instances
 */
export class AgentPool {
  private agents: Map<string, BaseAgent> = new Map()
  private maxAgents: number
  private dependencies: AgentDependencies

  constructor(config: AgentPoolConfig, dependencies: AgentDependencies) {
    this.maxAgents = config.maxAgents
    this.dependencies = dependencies
  }

  /**
   * Create a new agent
   */
  async createAgent(config: AnyAgentConfig): Promise<BaseAgent> {
    if (this.agents.size >= this.maxAgents) {
      throw new Error(`Agent pool full (max ${this.maxAgents})`)
    }

    if (this.agents.has(config.id)) {
      throw new Error(`Agent ${config.id} already exists`)
    }

    // Create appropriate agent type based on layer
    let agent: BaseAgent
    switch (config.layer) {
      case 'top':
        agent = new TopLayerAgent(config as TopLayerAgentConfig, this.dependencies)
        break
      case 'mid':
        agent = new MidLayerAgent(config as MidLayerAgentConfig, this.dependencies)
        break
      case 'bottom':
        agent = new BottomLayerAgent(config as BottomLayerAgentConfig, this.dependencies)
        break
      default:
        throw new Error(`Unknown layer: ${config.layer}`)
    }

    // Initialize the agent
    await agent.initialize()

    // Add to pool
    this.agents.set(config.id, agent)
    console.log(`Agent created: ${config.id} (${config.name})`)

    return agent
  }

  /**
   * Destroy an agent
   */
  async destroyAgent(agentId: string): Promise<void> {
    const agent = this.agents.get(agentId)
    if (!agent) {
      console.warn(`Agent ${agentId} not found in pool`)
      return
    }

    // Shutdown the agent
    await agent.shutdown()

    // Remove from pool
    this.agents.delete(agentId)
    console.log(`Agent destroyed: ${agentId}`)
  }

  /**
   * Get an agent by ID
   */
  getAgent(agentId: string): BaseAgent | undefined {
    return this.agents.get(agentId)
  }

  /**
   * Get all agents
   */
  getAllAgents(): BaseAgent[] {
    return Array.from(this.agents.values())
  }

  /**
   * Get agents by layer
   */
  getAgentsByLayer(layer: AgentLayer): BaseAgent[] {
    return this.getAllAgents().filter((a) => a.getConfig().layer === layer)
  }

  /**
   * Get agent count
   */
  getAgentCount(): number {
    return this.agents.size
  }

  /**
   * Check if pool is full
   */
  isFull(): boolean {
    return this.agents.size >= this.maxAgents
  }

  /**
   * Clear all agents
   */
  async clear(): Promise<void> {
    const agentIds = Array.from(this.agents.keys())
    for (const agentId of agentIds) {
      await this.destroyAgent(agentId)
    }
  }
}
