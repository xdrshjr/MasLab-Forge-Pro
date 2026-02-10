/**
 * Capability Registry
 *
 * Manages agent capabilities and validates which capabilities
 * are available to agents at different layers.
 */

import type { AgentLayer, AgentCapability } from '../types/index.js'
import type { BaseAgent } from './base-agent.js'

/**
 * Capability definition
 */
export interface Capability {
  name: AgentCapability
  description: string
  requiredLayer: AgentLayer[]
  execute: (agent: BaseAgent, context: any) => Promise<any>
}

/**
 * Registry for agent capabilities
 */
export class CapabilityRegistry {
  private capabilities: Map<AgentCapability, Capability> = new Map()

  constructor() {
    this.registerBuiltInCapabilities()
  }

  /**
   * Register a capability
   */
  register(capability: Capability): void {
    if (this.capabilities.has(capability.name)) {
      throw new Error(`Capability ${capability.name} already registered`)
    }
    this.capabilities.set(capability.name, capability)
    console.log(`Capability registered: ${capability.name}`)
  }

  /**
   * Get a capability by name
   */
  get(name: AgentCapability): Capability | undefined {
    return this.capabilities.get(name)
  }

  /**
   * Check if an agent can execute a capability
   */
  canExecute(agentLayer: AgentLayer, capabilityName: AgentCapability): boolean {
    const capability = this.get(capabilityName)
    if (!capability) {
      return false
    }
    return capability.requiredLayer.includes(agentLayer)
  }

  /**
   * List capabilities available to a layer
   */
  listCapabilities(agentLayer: AgentLayer): Capability[] {
    return Array.from(this.capabilities.values()).filter((c) =>
      c.requiredLayer.includes(agentLayer)
    )
  }

  /**
   * Get all capabilities
   */
  getAllCapabilities(): Capability[] {
    return Array.from(this.capabilities.values())
  }

  /**
   * Register built-in capabilities
   */
  private registerBuiltInCapabilities(): void {
    // Plan capability - available to all layers
    this.register({
      name: 'plan',
      description: 'Decompose tasks and create plans',
      requiredLayer: ['top', 'mid', 'bottom'],
      execute: async (_agent, _context) => {
        // Planning logic (will integrate with pi-agent-core in Task 09)
        return { plan: 'Generated plan' }
      },
    })

    // Execute capability - only bottom layer
    this.register({
      name: 'execute',
      description: 'Execute tasks using tools',
      requiredLayer: ['bottom'],
      execute: async (_agent, _context) => {
        // Execution logic (will integrate with pi-coding-agent in Task 09)
        return { result: 'Execution result' }
      },
    })

    // Reflect capability - available to all layers
    this.register({
      name: 'reflect',
      description: 'Evaluate results and improve strategies',
      requiredLayer: ['top', 'mid', 'bottom'],
      execute: async (_agent, _context) => {
        // Reflection logic (will integrate with pi-agent-core in Task 09)
        return { reflection: 'Reflection result' }
      },
    })

    // Tool call capability - only bottom layer
    this.register({
      name: 'tool_call',
      description: 'Invoke external tools',
      requiredLayer: ['bottom'],
      execute: async (_agent, _context) => {
        // Tool invocation logic
        return { toolResult: 'Tool execution result' }
      },
    })

    // Code generation capability - only bottom layer
    this.register({
      name: 'code_gen',
      description: 'Generate code',
      requiredLayer: ['bottom'],
      execute: async (_agent, _context) => {
        // Code generation logic
        return { code: 'Generated code' }
      },
    })

    // Test execution capability - only bottom layer
    this.register({
      name: 'test_exec',
      description: 'Execute tests',
      requiredLayer: ['bottom'],
      execute: async (_agent, _context) => {
        // Test execution logic
        return { testResult: 'Test results' }
      },
    })

    // Review capability - top and mid layers
    this.register({
      name: 'review',
      description: 'Review code and decisions',
      requiredLayer: ['top', 'mid'],
      execute: async (_agent, _context) => {
        // Review logic
        return { review: 'Review feedback' }
      },
    })

    // Coordinate capability - available to all layers
    this.register({
      name: 'coordinate',
      description: 'Coordinate with other agents',
      requiredLayer: ['top', 'mid', 'bottom'],
      execute: async (_agent, _context) => {
        // Coordination logic
        return { coordination: 'Coordination result' }
      },
    })

    // Delegate capability - top and mid layers
    this.register({
      name: 'delegate',
      description: 'Delegate tasks to subordinates',
      requiredLayer: ['top', 'mid'],
      execute: async (_agent, _context) => {
        // Delegation logic
        return { delegation: 'Task delegated' }
      },
    })

    // Arbitrate capability - only top layer
    this.register({
      name: 'arbitrate',
      description: 'Resolve conflicts and make final decisions',
      requiredLayer: ['top'],
      execute: async (_agent, _context) => {
        // Arbitration logic
        return { arbitration: 'Conflict resolved' }
      },
    })
  }
}
