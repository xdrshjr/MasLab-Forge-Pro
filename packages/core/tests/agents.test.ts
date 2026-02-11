/**
 * Agent System Tests
 *
 * Comprehensive tests for the agent base classes, state machine,
 * and lifecycle management.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { BaseAgent } from '../src/agents/base-agent.js'
import { AgentStateMachine } from '../src/agents/state-machine.js'
import { TopLayerAgent } from '../src/agents/top-layer-agent.js'
import { MidLayerAgent } from '../src/agents/mid-layer-agent.js'
import { BottomLayerAgent } from '../src/agents/bottom-layer-agent.js'
import { AgentPool } from '../src/agents/agent-pool.js'
import { CapabilityRegistry } from '../src/agents/capability-registry.js'
import { AgentMetricsCalculator } from '../src/agents/metrics-calculator.js'
import { AgentStatus, MessageType } from '../src/types/index.js'
import type { AgentConfig, Message } from '../src/types/index.js'
import type { AgentDependencies } from '../src/agents/types.js'

// Test agent implementation
class TestAgent extends BaseAgent {
  public simulateError = false

  protected async onInitialize(): Promise<void> {
    // Test initialization
  }

  protected async onProcess(
    messages: Message[],
    whiteboardContent: string
  ): Promise<void> {
    if (this.simulateError) {
      throw new Error('Simulated error')
    }
    // Test processing
  }

  protected async onShutdown(): Promise<void> {
    // Test shutdown
  }

  protected getResponsibilitiesDescription(): string {
    return 'Test agent responsibilities'
  }
}

// Mock dependencies
function createMockDependencies(): AgentDependencies {
  return {
    messageBus: {
      registerAgent: vi.fn(),
      unregisterAgent: vi.fn(),
      getMessages: vi.fn(() => []),
      sendMessage: vi.fn(),
    },
    whiteboardSystem: {
      createWhiteboard: vi.fn(),
      read: vi.fn(() => Promise.resolve('')),
      write: vi.fn(),
      append: vi.fn(),
    },
    database: {
      // Mock database methods
    },
  } as any
}

// Create test agent config
function createTestAgentConfig(overrides?: Partial<AgentConfig>): AgentConfig {
  const baseConfig: AgentConfig = {
    id: 'test-agent-1',
    name: 'Test Agent',
    layer: 'bottom',
    role: 'Test role',
    supervisor: 'supervisor-1',
    subordinates: [],
    capabilities: ['plan', 'execute'],
    config: {
      maxRetries: 3,
      timeoutMs: 30000,
    },
  }

  const merged = { ...baseConfig, ...overrides }

  // Add layer-specific properties based on layer
  if (merged.layer === 'bottom') {
    return {
      ...merged,
      tools: ['bash'],
    } as any
  } else if (merged.layer === 'mid') {
    return {
      ...merged,
      domain: 'test-domain',
      maxSubordinates: 5,
    } as any
  } else if (merged.layer === 'top') {
    return {
      ...merged,
      powerType: 'power_a',
      voteWeight: 1,
      signatureAuthority: [],
    } as any
  }

  return merged
}

describe('AgentStateMachine', () => {
  it('should allow valid transitions', () => {
    const sm = new AgentStateMachine()

    expect(sm.canTransition(AgentStatus.INITIALIZING, AgentStatus.IDLE)).toBe(
      true
    )
    expect(sm.canTransition(AgentStatus.IDLE, AgentStatus.WORKING)).toBe(true)
    expect(sm.canTransition(AgentStatus.WORKING, AgentStatus.IDLE)).toBe(true)
    expect(
      sm.canTransition(AgentStatus.WORKING, AgentStatus.WAITING_APPROVAL)
    ).toBe(true)
  })

  it('should reject invalid transitions', () => {
    const sm = new AgentStateMachine()

    expect(sm.canTransition(AgentStatus.IDLE, AgentStatus.TERMINATED)).toBe(
      false
    )
    expect(sm.canTransition(AgentStatus.WORKING, AgentStatus.TERMINATED)).toBe(
      false
    )
    expect(
      sm.canTransition(AgentStatus.TERMINATED, AgentStatus.IDLE)
    ).toBe(false)
  })

  it('should get allowed transitions', () => {
    const sm = new AgentStateMachine()

    const allowedFromIdle = sm.getAllowedTransitions(AgentStatus.IDLE)
    expect(allowedFromIdle).toContain(AgentStatus.WORKING)
    expect(allowedFromIdle).toContain(AgentStatus.WAITING_APPROVAL)
    expect(allowedFromIdle).toContain(AgentStatus.SHUTTING_DOWN)
  })
})

describe('BaseAgent', () => {
  let agent: TestAgent
  let dependencies: AgentDependencies

  beforeEach(() => {
    dependencies = createMockDependencies()
    const config = createTestAgentConfig()
    agent = new TestAgent(config, dependencies)
  })

  it('should initialize correctly', async () => {
    await agent.initialize()

    expect(agent.getStatus()).toBe(AgentStatus.IDLE)
    expect(agent.getMetrics().heartbeatsResponded).toBe(0)
    expect(dependencies.messageBus.registerAgent).toHaveBeenCalledWith(
      'test-agent-1'
    )
    // Note: Whiteboards are created automatically by the system
  })

  it('should process messages on heartbeat', async () => {
    await agent.initialize()

    const testMessage: Message = {
      id: 'msg-1',
      from: 'sender-1',
      to: 'test-agent-1',
      type: MessageType.TASK_ASSIGN,
      content: { task: { id: 'task-1', description: 'Test task' } },
      timestamp: Date.now(),
    }

    dependencies.messageBus.getMessages = vi.fn(() => [testMessage])

    await agent.onHeartbeat(1)

    expect(agent.getMetrics().heartbeatsResponded).toBe(1)
    expect(agent.getMetrics().messagesProcessed).toBe(1)
    expect(dependencies.messageBus.sendMessage).toHaveBeenCalled()
  })

  it('should handle errors with retry', async () => {
    await agent.initialize()
    agent.simulateError = true

    // First heartbeat - should retry
    await agent.onHeartbeat(1)
    expect(agent.getStatus()).toBe(AgentStatus.IDLE)
    expect(agent.getMetrics().heartbeatsMissed).toBe(1)

    // Continue retrying
    await agent.onHeartbeat(2)
    await agent.onHeartbeat(3)
    await agent.onHeartbeat(4)

    // After max retries, should fail
    expect(agent.getStatus()).toBe(AgentStatus.FAILED)
    expect(agent.getMetrics().tasksFailed).toBe(1)
  })

  it('should send messages', async () => {
    await agent.initialize()

    agent.sendMessage('target-agent', MessageType.TASK_ASSIGN, {
      task: 'test',
    })

    expect(dependencies.messageBus.sendMessage).toHaveBeenCalled()
  })

  it('should shutdown correctly', async () => {
    await agent.initialize()
    await agent.shutdown()

    expect(agent.getStatus()).toBe(AgentStatus.TERMINATED)
    expect(dependencies.messageBus.unregisterAgent).toHaveBeenCalledWith(
      'test-agent-1'
    )
  })

  it('should read and write whiteboard', async () => {
    await agent.initialize()

    await agent.readWhiteboard('bottom')
    expect(dependencies.whiteboardSystem.read).toHaveBeenCalled()

    await agent.writeWhiteboard('Test content')
    expect(dependencies.whiteboardSystem.write).toHaveBeenCalled()
  })

  it('should get metrics', async () => {
    await agent.initialize()

    const metrics = agent.getMetrics()
    expect(metrics.tasksCompleted).toBe(0)
    expect(metrics.tasksFailed).toBe(0)
    expect(metrics.performanceScore).toBe(100)
  })
})

describe('TopLayerAgent', () => {
  it('should initialize with power type', async () => {
    const dependencies = createMockDependencies()
    const config = createTestAgentConfig({
      layer: 'top',
      capabilities: ['plan', 'review', 'arbitrate'],
    })

    const topConfig = {
      ...config,
      powerType: 'power_a' as const,
      voteWeight: 1,
      signatureAuthority: ['technical_proposal', 'resource_adjustment'],
    }

    const agent = new TopLayerAgent(topConfig, dependencies)
    await agent.initialize()

    expect(agent.getStatus()).toBe(AgentStatus.IDLE)
    expect(agent.getConfig().layer).toBe('top')
  })
})

describe('MidLayerAgent', () => {
  it('should initialize with domain', async () => {
    const dependencies = createMockDependencies()
    const config = createTestAgentConfig({
      layer: 'mid',
      capabilities: ['plan', 'coordinate', 'delegate'],
      subordinates: ['bot-1', 'bot-2'],
    })

    const midConfig = {
      ...config,
      domain: 'frontend',
      maxSubordinates: 5,
    }

    const agent = new MidLayerAgent(midConfig, dependencies)
    await agent.initialize()

    expect(agent.getStatus()).toBe(AgentStatus.IDLE)
    expect(agent.getConfig().layer).toBe('mid')
  })
})

describe('BottomLayerAgent', () => {
  it('should initialize with tools', async () => {
    const dependencies = createMockDependencies()
    const config = createTestAgentConfig({
      layer: 'bottom',
      capabilities: ['execute', 'tool_call'],
    })

    const botConfig = {
      ...config,
      tools: ['file_read', 'file_write', 'bash'],
    }

    const agent = new BottomLayerAgent(botConfig, dependencies)
    await agent.initialize()

    expect(agent.getStatus()).toBe(AgentStatus.IDLE)
    expect(agent.getConfig().layer).toBe('bottom')
  })

  it('should execute tasks', async () => {
    const dependencies = createMockDependencies()
    const config = createTestAgentConfig({
      layer: 'bottom',
      supervisor: 'mid-1',
    })

    const botConfig = {
      ...config,
      tools: ['bash'],
    }

    const agent = new BottomLayerAgent(botConfig, dependencies)
    await agent.initialize()

    const taskMessage: Message = {
      id: 'msg-1',
      from: 'mid-1',
      to: config.id,
      type: MessageType.TASK_ASSIGN,
      content: {
        task: {
          id: 'task-1',
          description: 'Test task',
        },
      },
      timestamp: Date.now(),
    }

    dependencies.messageBus.getMessages = vi.fn(() => [taskMessage])

    await agent.onHeartbeat(1)

    // Task should be processed
    expect(agent.getMetrics().messagesProcessed).toBeGreaterThan(0)
  })
})

describe('AgentPool', () => {
  let pool: AgentPool
  let dependencies: AgentDependencies

  beforeEach(() => {
    dependencies = createMockDependencies()
    pool = new AgentPool({ maxAgents: 10 }, dependencies)
  })

  it('should create and destroy agents', async () => {
    const config = createTestAgentConfig()
    const agent = await pool.createAgent(config)

    expect(pool.getAgent(config.id)).toBeDefined()
    expect(pool.getAgentCount()).toBe(1)

    await pool.destroyAgent(config.id)
    expect(pool.getAgent(config.id)).toBeUndefined()
    expect(pool.getAgentCount()).toBe(0)
  })

  it('should enforce max agent limit', async () => {
    const smallPool = new AgentPool({ maxAgents: 2 }, dependencies)

    await smallPool.createAgent(createTestAgentConfig({ id: 'agent-1' }))
    await smallPool.createAgent(createTestAgentConfig({ id: 'agent-2' }))

    await expect(
      smallPool.createAgent(createTestAgentConfig({ id: 'agent-3' }))
    ).rejects.toThrow('Agent pool full')
  })

  it('should get agents by layer', async () => {
    await pool.createAgent(
      createTestAgentConfig({ id: 'top-1', layer: 'top' })
    )
    await pool.createAgent(
      createTestAgentConfig({ id: 'mid-1', layer: 'mid' })
    )
    await pool.createAgent(
      createTestAgentConfig({ id: 'bot-1', layer: 'bottom' })
    )

    const topAgents = pool.getAgentsByLayer('top')
    const midAgents = pool.getAgentsByLayer('mid')
    const botAgents = pool.getAgentsByLayer('bottom')

    expect(topAgents.length).toBe(1)
    expect(midAgents.length).toBe(1)
    expect(botAgents.length).toBe(1)
  })

  it('should clear all agents', async () => {
    await pool.createAgent(createTestAgentConfig({ id: 'agent-1' }))
    await pool.createAgent(createTestAgentConfig({ id: 'agent-2' }))

    expect(pool.getAgentCount()).toBe(2)

    await pool.clear()
    expect(pool.getAgentCount()).toBe(0)
  })
})

describe('CapabilityRegistry', () => {
  let registry: CapabilityRegistry

  beforeEach(() => {
    registry = new CapabilityRegistry()
  })

  it('should have built-in capabilities', () => {
    const allCapabilities = registry.getAllCapabilities()
    expect(allCapabilities.length).toBeGreaterThan(0)

    expect(registry.get('plan')).toBeDefined()
    expect(registry.get('execute')).toBeDefined()
    expect(registry.get('arbitrate')).toBeDefined()
  })

  it('should validate layer capabilities', () => {
    expect(registry.canExecute('top', 'arbitrate')).toBe(true)
    expect(registry.canExecute('mid', 'arbitrate')).toBe(false)
    expect(registry.canExecute('bottom', 'arbitrate')).toBe(false)

    expect(registry.canExecute('bottom', 'execute')).toBe(true)
    expect(registry.canExecute('top', 'execute')).toBe(false)

    expect(registry.canExecute('top', 'plan')).toBe(true)
    expect(registry.canExecute('mid', 'plan')).toBe(true)
    expect(registry.canExecute('bottom', 'plan')).toBe(true)
  })

  it('should list capabilities by layer', () => {
    const topCapabilities = registry.listCapabilities('top')
    const midCapabilities = registry.listCapabilities('mid')
    const bottomCapabilities = registry.listCapabilities('bottom')

    expect(topCapabilities.some((c) => c.name === 'arbitrate')).toBe(true)
    expect(midCapabilities.some((c) => c.name === 'delegate')).toBe(true)
    expect(bottomCapabilities.some((c) => c.name === 'execute')).toBe(true)
  })
})

describe('AgentMetricsCalculator', () => {
  let calculator: AgentMetricsCalculator

  beforeEach(() => {
    calculator = new AgentMetricsCalculator()
  })

  it('should calculate performance score', async () => {
    const dependencies = createMockDependencies()
    const config = createTestAgentConfig()
    const agent = new TestAgent(config, dependencies)
    await agent.initialize()

    // Simulate some activity
    const metrics = agent.getMetrics()
    metrics.tasksCompleted = 10
    metrics.tasksFailed = 2
    metrics.averageTaskDuration = 5000
    metrics.heartbeatsResponded = 100
    metrics.heartbeatsMissed = 5

    const score = calculator.calculatePerformanceScore(agent)
    expect(score).toBeGreaterThan(0)
    expect(score).toBeLessThanOrEqual(100)
  })

  it('should calculate score breakdown', () => {
    const metrics = {
      tasksCompleted: 8,
      tasksFailed: 2,
      averageTaskDuration: 10000,
      messagesProcessed: 50,
      heartbeatsResponded: 95,
      heartbeatsMissed: 5,
      warningsReceived: 0,
      lastActiveTimestamp: Date.now(),
      performanceScore: 0,
    }

    const breakdown = calculator.calculateScoreBreakdown(metrics)

    expect(breakdown.successScore).toBeGreaterThan(0)
    expect(breakdown.responsivenessScore).toBeGreaterThan(0)
    expect(breakdown.reliabilityScore).toBeGreaterThan(0)
    expect(breakdown.overallScore).toBeGreaterThan(0)
  })

  it('should determine promotion eligibility', () => {
    const goodMetrics = {
      tasksCompleted: 15,
      tasksFailed: 0,
      averageTaskDuration: 5000,
      messagesProcessed: 100,
      heartbeatsResponded: 100,
      heartbeatsMissed: 0,
      warningsReceived: 0,
      lastActiveTimestamp: Date.now(),
      performanceScore: 90,
    }

    expect(calculator.shouldPromote(goodMetrics)).toBe(true)
  })

  it('should determine demotion eligibility', () => {
    const poorMetrics = {
      tasksCompleted: 5,
      tasksFailed: 10,
      averageTaskDuration: 50000,
      messagesProcessed: 20,
      heartbeatsResponded: 50,
      heartbeatsMissed: 20,
      warningsReceived: 2,
      lastActiveTimestamp: Date.now(),
      performanceScore: 40,
    }

    expect(calculator.shouldDemote(poorMetrics)).toBe(true)
  })

  it('should determine dismissal eligibility', () => {
    const criticalMetrics = {
      tasksCompleted: 1,
      tasksFailed: 20,
      averageTaskDuration: 80000,
      messagesProcessed: 10,
      heartbeatsResponded: 30,
      heartbeatsMissed: 50,
      warningsReceived: 3,
      lastActiveTimestamp: Date.now(),
      performanceScore: 20,
    }

    expect(calculator.shouldDismiss(criticalMetrics)).toBe(true)
  })

  it('should get performance rating', () => {
    expect(calculator.getPerformanceRating(95)).toBe('Excellent')
    expect(calculator.getPerformanceRating(85)).toBe('Good')
    expect(calculator.getPerformanceRating(75)).toBe('Satisfactory')
    expect(calculator.getPerformanceRating(65)).toBe('Fair')
    expect(calculator.getPerformanceRating(45)).toBe('Poor')
    expect(calculator.getPerformanceRating(25)).toBe('Critical')
  })
})
