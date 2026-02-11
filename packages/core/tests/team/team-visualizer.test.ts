/**
 * Tests for TeamVisualizer
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { TeamVisualizer } from '../../src/team/team-visualizer.js'
import type { BaseAgent } from '../../src/agents/base-agent.js'
import type { AgentDependencies } from '../../src/agents/types.js'
import { DatabaseManager } from '../../src/persistence/database.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { WhiteboardSystem } from '../../src/whiteboard/system.js'
import { GovernanceEngine } from '../../src/governance/governance-engine.js'
import { TeamManager } from '../../src/team/team-manager.js'
import { RequirementManager } from '../../src/team/requirement-manager.js'
import type { AgentRegistry } from '../../src/whiteboard/permissions.js'
import pino from 'pino'

describe('TeamVisualizer', () => {
  let visualizer: TeamVisualizer
  let team: Map<string, BaseAgent>
  let dependencies: AgentDependencies

  beforeEach(async () => {
    visualizer = new TeamVisualizer()

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

    // Create a test team
    const requirementManager = new RequirementManager()
    const teamManager = new TeamManager({ maxAgents: 50 }, dependencies)

    const taskContext = await requirementManager.clarify('Create a TODO app', 'auto')
    const structure = await teamManager.generateTeam(taskContext)
    team = await teamManager.instantiateTeam(taskContext, structure)
  })

  describe('visualize', () => {
    it('should generate text visualization', () => {
      const output = visualizer.visualize(team)

      expect(output).toContain('=== Team Structure ===')
      expect(output).toContain('Top Layer')
      expect(output).toContain('Mid Layer')
      expect(output).toContain('Bottom Layer')
    })

    it('should show agent counts for each layer', () => {
      const output = visualizer.visualize(team)

      expect(output).toMatch(/Top Layer \(\d+\)/)
      expect(output).toMatch(/Mid Layer \(\d+\)/)
      expect(output).toMatch(/Bottom Layer \(\d+\)/)
    })

    it('should display agent names and IDs', () => {
      const output = visualizer.visualize(team)

      const agents = Array.from(team.values())
      const firstAgent = agents[0]

      expect(output).toContain(firstAgent.getConfig().name)
      expect(output).toContain(firstAgent.getConfig().id.slice(0, 8))
    })

    it('should show agent status', () => {
      const output = visualizer.visualize(team)

      expect(output).toContain('Status:')
    })

    it('should show subordinate counts', () => {
      const output = visualizer.visualize(team)

      expect(output).toContain('Subordinates:')
    })

    it('should show supervisor information for mid and bottom layers', () => {
      const output = visualizer.visualize(team)

      expect(output).toContain('Supervisor:')
    })
  })

  describe('generateDiagram', () => {
    it('should generate ASCII hierarchy diagram', () => {
      const output = visualizer.generateDiagram(team)

      expect(output).toContain('=== Team Hierarchy ===')
    })

    it('should use tree characters', () => {
      const output = visualizer.generateDiagram(team)

      // Should contain tree drawing characters
      expect(output).toMatch(/[├└─│]/)
    })

    it('should show hierarchical structure', () => {
      const output = visualizer.generateDiagram(team)

      // Should have multiple levels of indentation
      const lines = output.split('\n')
      const indentedLines = lines.filter((line) => line.startsWith('   ') || line.startsWith('│'))

      expect(indentedLines.length).toBeGreaterThan(0)
    })

    it('should include all agent names', () => {
      const output = visualizer.generateDiagram(team)

      const agents = Array.from(team.values())
      for (const agent of agents) {
        expect(output).toContain(agent.getConfig().name)
      }
    })
  })

  describe('generateSummary', () => {
    it('should generate summary statistics', () => {
      const output = visualizer.generateSummary(team)

      expect(output).toContain('=== Team Summary ===')
      expect(output).toContain('Total Agents:')
    })

    it('should show layer breakdown', () => {
      const output = visualizer.generateSummary(team)

      expect(output).toContain('Top Layer:')
      expect(output).toContain('Mid Layer:')
      expect(output).toContain('Bottom Layer:')
    })

    it('should show correct agent counts', () => {
      const output = visualizer.generateSummary(team)

      const topCount = Array.from(team.values()).filter((a) => a.getConfig().layer === 'top').length
      const midCount = Array.from(team.values()).filter((a) => a.getConfig().layer === 'mid').length
      const bottomCount = Array.from(team.values()).filter((a) => a.getConfig().layer === 'bottom').length

      expect(output).toContain(`Total Agents: ${team.size}`)
      expect(output).toContain(`Top Layer: ${topCount}`)
      expect(output).toContain(`Mid Layer: ${midCount}`)
      expect(output).toContain(`Bottom Layer: ${bottomCount}`)
    })

    it('should show status breakdown', () => {
      const output = visualizer.generateSummary(team)

      expect(output).toContain('Status Breakdown:')
    })

    it('should count statuses correctly', () => {
      const output = visualizer.generateSummary(team)

      // All agents should be in initializing or idle state
      expect(output).toMatch(/(initializing|idle)/)
    })
  })

  describe('empty team', () => {
    it('should handle empty team gracefully', () => {
      const emptyTeam = new Map<string, BaseAgent>()

      const visualization = visualizer.visualize(emptyTeam)
      expect(visualization).toContain('Top Layer (0)')
      expect(visualization).toContain('Mid Layer (0)')
      expect(visualization).toContain('Bottom Layer (0)')

      const diagram = visualizer.generateDiagram(emptyTeam)
      expect(diagram).toContain('=== Team Hierarchy ===')

      const summary = visualizer.generateSummary(emptyTeam)
      expect(summary).toContain('Total Agents: 0')
    })
  })
})
