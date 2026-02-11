/**
 * Tests for RoleGenerator
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { RoleGenerator } from '../../src/team/role-generator.js'
import type { TaskContext } from '../../src/team/types.js'

describe('RoleGenerator', () => {
  let generator: RoleGenerator
  let mockTaskContext: TaskContext

  beforeEach(() => {
    generator = new RoleGenerator()
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

  describe('generateTopLayerRoles', () => {
    it('should generate exactly 3 top-layer roles', async () => {
      const roles = await generator.generateTopLayerRoles(mockTaskContext)

      expect(roles).toHaveLength(3)
    })

    it('should assign top layer to all roles', async () => {
      const roles = await generator.generateTopLayerRoles(mockTaskContext)

      roles.forEach((role) => {
        expect(role.layer).toBe('top')
      })
    })

    it('should include arbitrate capability', async () => {
      const roles = await generator.generateTopLayerRoles(mockTaskContext)

      roles.forEach((role) => {
        expect(role.capabilities).toContain('arbitrate')
      })
    })

    it('should assign signature authority', async () => {
      const roles = await generator.generateTopLayerRoles(mockTaskContext)

      roles.forEach((role) => {
        expect(role.signatureAuthority).toBeDefined()
        expect(role.signatureAuthority!.length).toBeGreaterThan(0)
      })
    })

    it('should have unique role names', async () => {
      const roles = await generator.generateTopLayerRoles(mockTaskContext)

      const names = roles.map((r) => r.name)
      const uniqueNames = new Set(names)
      expect(uniqueNames.size).toBe(names.length)
    })

    it('should assign responsibilities', async () => {
      const roles = await generator.generateTopLayerRoles(mockTaskContext)

      roles.forEach((role) => {
        expect(role.responsibilities).toBeDefined()
        expect(role.responsibilities.length).toBeGreaterThan(0)
      })
    })
  })

  describe('generateMidLayerRoles', () => {
    it('should generate 2-5 mid-layer roles', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const roles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)

      expect(roles.length).toBeGreaterThanOrEqual(2)
      expect(roles.length).toBeLessThanOrEqual(5)
    })

    it('should assign mid layer to all roles', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const roles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)

      roles.forEach((role) => {
        expect(role.layer).toBe('mid')
      })
    })

    it('should assign unique domains', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const roles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)

      const domains = roles.map((r) => r.domain)
      const uniqueDomains = new Set(domains)
      expect(uniqueDomains.size).toBe(domains.length)
    })

    it('should include delegate capability', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const roles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)

      roles.forEach((role) => {
        expect(role.capabilities).toContain('delegate')
      })
    })

    it('should generate appropriate domains for development tasks', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const roles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)

      const domains = roles.map((r) => r.domain?.toLowerCase())
      // Development tasks should have backend, frontend, testing
      expect(domains.some((d) => d?.includes('backend'))).toBe(true)
    })
  })

  describe('generateBottomLayerRoles', () => {
    it('should generate bottom-layer roles', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const midRoles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)
      const roles = await generator.generateBottomLayerRoles(midRoles)

      expect(roles.length).toBeGreaterThan(0)
    })

    it('should not exceed 50 agents', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const midRoles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)
      const roles = await generator.generateBottomLayerRoles(midRoles)

      expect(roles.length).toBeLessThanOrEqual(50)
    })

    it('should assign bottom layer to all roles', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const midRoles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)
      const roles = await generator.generateBottomLayerRoles(midRoles)

      roles.forEach((role) => {
        expect(role.layer).toBe('bottom')
      })
    })

    it('should include execute capability', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const midRoles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)
      const roles = await generator.generateBottomLayerRoles(midRoles)

      roles.forEach((role) => {
        expect(role.capabilities).toContain('execute')
      })
    })

    it('should assign tools', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const midRoles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)
      const roles = await generator.generateBottomLayerRoles(midRoles)

      roles.forEach((role) => {
        expect(role.tools).toBeDefined()
        expect(role.tools!.length).toBeGreaterThan(0)
      })
    })

    it('should create agents for each mid-layer role', async () => {
      const topRoles = await generator.generateTopLayerRoles(mockTaskContext)
      const midRoles = await generator.generateMidLayerRoles(mockTaskContext, topRoles)
      const roles = await generator.generateBottomLayerRoles(midRoles)

      // Each mid-layer should have at least one bottom-layer agent
      for (const midRole of midRoles) {
        const domain = midRole.domain?.toLowerCase()
        const hasAgent = roles.some((r) => r.name.toLowerCase().includes(domain || ''))
        expect(hasAgent).toBe(true)
      }
    })
  })
})
