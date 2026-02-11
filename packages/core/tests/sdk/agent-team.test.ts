/**
 * AgentTeam SDK Tests
 *
 * Tests for the main SDK API.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { AgentTeam } from '../src/sdk/agent-team.js'

describe('AgentTeam SDK', () => {
  let team: AgentTeam

  beforeEach(() => {
    team = new AgentTeam({
      mode: 'auto',
      maxBottomAgents: 3,
      databasePath: ':memory:',
    })
  })

  describe('Constructor', () => {
    it('should create instance with default config', () => {
      expect(team).toBeDefined()
    })

    it('should normalize config with defaults', () => {
      const team2 = new AgentTeam({ mode: 'auto' })
      expect(team2).toBeDefined()
    })
  })

  describe('Event System', () => {
    it('should register event listeners', () => {
      let called = false
      team.on('test', () => {
        called = true
      })
      expect(called).toBe(false)
    })

    it('should remove event listeners', () => {
      const handler = () => {}
      team.on('test', handler)
      team.off('test', handler)
    })
  })

  describe('API Methods', () => {
    it('should throw error when pausing without active task', async () => {
      await expect(team.pause()).rejects.toThrow('No active task')
    })

    it('should throw error when resuming without active task', async () => {
      await expect(team.resume()).rejects.toThrow('No active task')
    })

    it('should throw error when cancelling without active task', async () => {
      await expect(team.cancel()).rejects.toThrow('No active task')
    })

    it('should throw error when getting status without active task', () => {
      expect(() => team.getStatus()).toThrow('No active task')
    })

    it('should return empty array when getting agents without active task', () => {
      const agents = team.getAgents()
      expect(agents).toEqual([])
    })
  })
})
