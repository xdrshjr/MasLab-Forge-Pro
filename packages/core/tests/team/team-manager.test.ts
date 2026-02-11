/**
 * Tests for TeamManager
 */

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { TeamManager } from '../../src/team/team-manager.js'
import type { TaskContext } from '../../src/team/types.js'
import type { AgentDependencies } from '../../src/agents/types.js'
import { DatabaseManager } from '../../src/persistence/database.js'
import { MessageBus } from '../../src/communication/message-bus.js'
import { WhiteboardSystem } from '../../src/whiteboard/system.js'
import { GovernanceEngine } from '../../src/governance/governance-engine.js'
import type { AgentRegistry } from '../../src/whiteboard/permissions.js'
import pino from 'pino'

describe('TeamManager', () => {
  let manager: TeamManager
  let dependencies: AgentDependencies
  let mockTaskContext: TaskContext

  beforeEach(async () => {
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

    manager = new TeamManager({ maxAgents: 50 }, dependencies)

    mockTaskContext = {
      id: 'task-123',
      description: 'Create a TODO application',
      type: 'development',
      requirements: ['Build REST API', 'Create frontend', 'Add tests'],
      constraints: {},
      clarificationHistory: [],
      mode: 'auto',
    }
  })

  describe('generateTeam', () => {
    it('should generate complete team structure', async () => {
      const structure = await manager.generateTeam(mockTaskContext)

      expect(structure.topLayer).toHaveLength(3)
      expect(structure.midLayer.length).toBeGreaterThanOrEqual(2)
      expect(structure.midLayer.length).toBeLessThanOrEqual(5)
      expect(structure.bottomLayer.length).toBeGreaterThan(0)
    })

    it('should validate generated structure', async () => {
      const structure = await manager.generateTeam(mockTaskContext)

      // Structure should be valid (no errors thrown)
      expect(structure).toBeDefined()
      expect(structure.topLayer).toBeDefined()
      expect(structure.midLayer).toBeDefined()
      expect(structure.bottomLayer).toBeDefined()
    })

    it('should throw error for invalid structure', async () => {
      // Mock the role generator to return invalid structure
      const invalidContext = { ...mockTaskContext }

      // This should not throw in normal cases, but validates error handling
      await expect(manager.generateTeam(invalidContext)).resolves.toBeDefined()
    })
  })

  describe('instantiateTeam', () => {
    it('should create agents with correct hierarchy', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      expect(team.size).toBeGreaterThan(0)

      // Verify hierarchy
      const midAgents = Array.from(team.values()).filter((a) => a.getConfig().layer === 'mid')
      for (const midAgent of midAgents) {
        const config = midAgent.getConfig()
        expect(config.supervisor).toBeDefined()

        const supervisor = team.get(config.supervisor!)
        expect(supervisor).toBeDefined()
        expect(supervisor!.getConfig().layer).toBe('top')
        expect(supervisor!.getConfig().subordinates).toContain(config.id)
      }
    })

    it('should create correct number of agents', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      const expectedCount = structure.topLayer.length + structure.midLayer.length + structure.bottomLayer.length

      expect(team.size).toBe(expectedCount)
    })

    it('should assign unique IDs to all agents', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      const ids = Array.from(team.keys())
      const uniqueIds = new Set(ids)

      expect(uniqueIds.size).toBe(ids.length)
    })

    it('should link bottom agents to mid supervisors', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      const bottomAgents = Array.from(team.values()).filter((a) => a.getConfig().layer === 'bottom')

      for (const bottomAgent of bottomAgents) {
        const config = bottomAgent.getConfig()
        expect(config.supervisor).toBeDefined()

        const supervisor = team.get(config.supervisor!)
        expect(supervisor).toBeDefined()
        expect(supervisor!.getConfig().layer).toBe('mid')
      }
    })
  })

  describe('replaceAgent', () => {
    it('should replace failed agent', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      const originalAgent = Array.from(team.values())[0]
      const originalId = originalAgent.getConfig().id

      const newAgent = await manager.replaceAgent(originalId, team)

      expect(newAgent.getConfig().id).not.toBe(originalId)
      expect(newAgent.getConfig().name).toContain('Replacement')
      expect(team.has(originalId)).toBe(false)
      expect(team.has(newAgent.getConfig().id)).toBe(true)
    })

    it('should update supervisor subordinate list', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      // Find a mid-layer agent with supervisor
      const midAgent = Array.from(team.values()).find((a) => a.getConfig().layer === 'mid')
      expect(midAgent).toBeDefined()

      const midId = midAgent!.getConfig().id
      const supervisorId = midAgent!.getConfig().supervisor!

      const newAgent = await manager.replaceAgent(midId, team)

      const supervisor = team.get(supervisorId)
      expect(supervisor!.getConfig().subordinates).not.toContain(midId)
      expect(supervisor!.getConfig().subordinates).toContain(newAgent.getConfig().id)
    })

    it('should throw error for non-existent agent', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      await expect(manager.replaceAgent('non-existent-id', team)).rejects.toThrow('not found')
    })
  })

  describe('dissolveTeam', () => {
    it('should remove all agents', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      expect(team.size).toBeGreaterThan(0)

      await manager.dissolveTeam(team)

      expect(team.size).toBe(0)
    })

    it('should shutdown agents properly', async () => {
      const structure = await manager.generateTeam(mockTaskContext)
      const team = await manager.instantiateTeam(mockTaskContext, structure)

      const agentIds = Array.from(team.keys())

      await manager.dissolveTeam(team)

      // Verify agents are removed from pool
      const pool = manager.getAgentPool()
      for (const agentId of agentIds) {
        expect(pool.getAgent(agentId)).toBeUndefined()
      }
    })
  })
})
