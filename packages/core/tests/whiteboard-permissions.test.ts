/**
 * Whiteboard Permission Tests
 *
 * Tests for permission checking logic.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { WhiteboardPermissionChecker } from '../src/whiteboard/permissions.js'
import type { AgentRegistry, AgentInfo } from '../src/whiteboard/permissions.js'
import type { WhiteboardType } from '../src/whiteboard/types.js'

// Import enum value
const WhiteboardType = {
  GLOBAL: 'global' as const,
  TOP_LAYER: 'top' as const,
  MID_LAYER: 'mid' as const,
  BOTTOM_LAYER: 'bottom' as const
}

class MockAgentRegistry implements AgentRegistry {
  private agents: Map<string, AgentInfo> = new Map()

  addAgent(agent: AgentInfo): void {
    this.agents.set(agent.id, agent)
  }

  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId)
  }
}

describe('WhiteboardPermissionChecker', () => {
  let checker: WhiteboardPermissionChecker
  let registry: MockAgentRegistry

  beforeEach(() => {
    registry = new MockAgentRegistry()

    // Add test agents
    registry.addAgent({ id: 'top-1', layer: 'top' })
    registry.addAgent({ id: 'mid-1', layer: 'mid', supervisor: 'top-1' })
    registry.addAgent({ id: 'mid-2', layer: 'mid', supervisor: 'top-1' })
    registry.addAgent({ id: 'bot-1', layer: 'bottom', supervisor: 'mid-1' })
    registry.addAgent({ id: 'bot-2', layer: 'bottom', supervisor: 'mid-2' })

    checker = new WhiteboardPermissionChecker(registry)
  })

  describe('Global Whiteboard Permissions', () => {
    it('should allow all agents to read global whiteboard', () => {
      expect(
        checker.canRead('top-1', { type: WhiteboardType.GLOBAL })
      ).toBe(true)
      expect(
        checker.canRead('mid-1', { type: WhiteboardType.GLOBAL })
      ).toBe(true)
      expect(
        checker.canRead('bot-1', { type: WhiteboardType.GLOBAL })
      ).toBe(true)
    })

    it('should only allow top agents to write to global whiteboard', () => {
      expect(
        checker.canWrite('top-1', { type: WhiteboardType.GLOBAL })
      ).toBe(true)
      expect(
        checker.canWrite('mid-1', { type: WhiteboardType.GLOBAL })
      ).toBe(false)
      expect(
        checker.canWrite('bot-1', { type: WhiteboardType.GLOBAL })
      ).toBe(false)
    })

    it('should allow top and mid agents to append to global whiteboard', () => {
      expect(
        checker.canAppend('top-1', { type: WhiteboardType.GLOBAL })
      ).toBe(true)
      expect(
        checker.canAppend('mid-1', { type: WhiteboardType.GLOBAL })
      ).toBe(true)
      expect(
        checker.canAppend('bot-1', { type: WhiteboardType.GLOBAL })
      ).toBe(false)
    })
  })

  describe('Top Layer Whiteboard Permissions', () => {
    it('should allow all agents to read top layer whiteboard', () => {
      expect(
        checker.canRead('top-1', { type: WhiteboardType.TOP_LAYER })
      ).toBe(true)
      expect(
        checker.canRead('mid-1', { type: WhiteboardType.TOP_LAYER })
      ).toBe(true)
      expect(
        checker.canRead('bot-1', { type: WhiteboardType.TOP_LAYER })
      ).toBe(true)
    })

    it('should only allow top agents to write to top layer whiteboard', () => {
      expect(
        checker.canWrite('top-1', { type: WhiteboardType.TOP_LAYER })
      ).toBe(true)
      expect(
        checker.canWrite('mid-1', { type: WhiteboardType.TOP_LAYER })
      ).toBe(false)
      expect(
        checker.canWrite('bot-1', { type: WhiteboardType.TOP_LAYER })
      ).toBe(false)
    })
  })

  describe('Mid Layer Whiteboard Permissions', () => {
    it('should allow top and mid agents to read all mid whiteboards', () => {
      expect(
        checker.canRead('top-1', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-1'
        })
      ).toBe(true)
      expect(
        checker.canRead('mid-2', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-1'
        })
      ).toBe(true)
    })

    it('should allow bottom agents to read supervisor whiteboard', () => {
      expect(
        checker.canRead('bot-1', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-1'
        })
      ).toBe(true)
    })

    it('should deny bottom agents from reading non-supervisor mid whiteboard', () => {
      expect(
        checker.canRead('bot-1', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-2'
        })
      ).toBe(false)
    })

    it('should only allow owner to write to mid whiteboard', () => {
      expect(
        checker.canWrite('mid-1', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-1'
        })
      ).toBe(true)
      expect(
        checker.canWrite('mid-2', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-1'
        })
      ).toBe(false)
      expect(
        checker.canWrite('top-1', {
          type: WhiteboardType.MID_LAYER,
          ownerId: 'mid-1'
        })
      ).toBe(false)
    })
  })

  describe('Bottom Layer Whiteboard Permissions', () => {
    it('should allow top and mid agents to read all bottom whiteboards', () => {
      expect(
        checker.canRead('top-1', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-1'
        })
      ).toBe(true)
      expect(
        checker.canRead('mid-1', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-1'
        })
      ).toBe(true)
    })

    it('should only allow bottom agents to read own whiteboard', () => {
      expect(
        checker.canRead('bot-1', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-1'
        })
      ).toBe(true)
      expect(
        checker.canRead('bot-1', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-2'
        })
      ).toBe(false)
    })

    it('should only allow owner to write to bottom whiteboard', () => {
      expect(
        checker.canWrite('bot-1', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-1'
        })
      ).toBe(true)
      expect(
        checker.canWrite('bot-2', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-1'
        })
      ).toBe(false)
      expect(
        checker.canWrite('mid-1', {
          type: WhiteboardType.BOTTOM_LAYER,
          ownerId: 'bot-1'
        })
      ).toBe(false)
    })
  })

  describe('Invalid Agent', () => {
    it('should deny all permissions for non-existent agent', () => {
      expect(
        checker.canRead('invalid', { type: WhiteboardType.GLOBAL })
      ).toBe(false)
      expect(
        checker.canWrite('invalid', { type: WhiteboardType.GLOBAL })
      ).toBe(false)
      expect(
        checker.canAppend('invalid', { type: WhiteboardType.GLOBAL })
      ).toBe(false)
    })
  })
})
