/**
 * Whiteboard System Tests
 *
 * Comprehensive tests for the whiteboard system including permissions,
 * locking, versioning, and file operations.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { promises as fs } from 'fs'
import path from 'path'
import { WhiteboardSystem } from '../src/whiteboard/system.js'
import type { AgentRegistry, AgentInfo } from '../src/whiteboard/permissions.js'

// Import enum value
const WhiteboardType = {
  GLOBAL: 'global' as const,
  TOP_LAYER: 'top' as const,
  MID_LAYER: 'mid' as const,
  BOTTOM_LAYER: 'bottom' as const
}

// Test workspace path
const TEST_WORKSPACE = path.join(process.cwd(), '.test-workspace')

// Mock agent registry
class MockAgentRegistry implements AgentRegistry {
  private agents: Map<string, AgentInfo> = new Map()

  addAgent(agent: AgentInfo): void {
    this.agents.set(agent.id, agent)
  }

  getAgent(agentId: string): AgentInfo | undefined {
    return this.agents.get(agentId)
  }

  clear(): void {
    this.agents.clear()
  }
}

describe('WhiteboardSystem', () => {
  let system: WhiteboardSystem
  let registry: MockAgentRegistry

  beforeEach(async () => {
    // Create test workspace
    await fs.mkdir(TEST_WORKSPACE, { recursive: true })

    // Setup mock registry
    registry = new MockAgentRegistry()

    // Add test agents
    registry.addAgent({ id: 'top-1', layer: 'top' })
    registry.addAgent({ id: 'top-2', layer: 'top' })
    registry.addAgent({ id: 'mid-1', layer: 'mid', supervisor: 'top-1' })
    registry.addAgent({ id: 'mid-2', layer: 'mid', supervisor: 'top-2' })
    registry.addAgent({ id: 'bot-1', layer: 'bottom', supervisor: 'mid-1' })
    registry.addAgent({ id: 'bot-2', layer: 'bottom', supervisor: 'mid-2' })

    // Create whiteboard system
    system = new WhiteboardSystem(
      {
        workspacePath: TEST_WORKSPACE,
        enableVersioning: true,
        cacheTimeout: 2000
      },
      registry
    )
  })

  afterEach(async () => {
    // Clean up test workspace
    try {
      await fs.rm(TEST_WORKSPACE, { recursive: true, force: true })
    } catch (error) {
      // Ignore cleanup errors
    }
  })

  describe('Initialization', () => {
    it('should create workspace directories', async () => {
      const whiteboardsDir = path.join(TEST_WORKSPACE, 'whiteboards')
      const locksDir = path.join(whiteboardsDir, '.locks')

      const whiteboardsDirExists = await fs
        .access(whiteboardsDir)
        .then(() => true)
        .catch(() => false)
      const locksDirExists = await fs
        .access(locksDir)
        .then(() => true)
        .catch(() => false)

      expect(whiteboardsDirExists).toBe(true)
      expect(locksDirExists).toBe(true)
    })
  })

  describe('Read Operations', () => {
    it('should return template for non-existent whiteboard', async () => {
      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content).toContain('# Global Whiteboard')
      expect(content).toContain('## Task Overview')
    })

    it('should read existing whiteboard content', async () => {
      const testContent = '# Test Whiteboard\n\nTest content'
      await system.write(WhiteboardType.GLOBAL, testContent, 'top-1')

      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content).toBe(testContent)
    })

    it('should cache read results', async () => {
      const testContent = '# Cached Content'
      await system.write(WhiteboardType.GLOBAL, testContent, 'top-1')

      // First read
      const content1 = await system.read(WhiteboardType.GLOBAL, 'top-1')

      // Modify file directly (bypass system)
      const globalPath = path.join(TEST_WORKSPACE, 'global-whiteboard.md')
      await fs.writeFile(globalPath, '# Modified Content', 'utf-8')

      // Second read should return cached content
      const content2 = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content2).toBe(content1)
    })
  })

  describe('Write Operations', () => {
    it('should write content to whiteboard', async () => {
      const testContent = '# Test Write\n\nContent here'
      await system.write(WhiteboardType.GLOBAL, testContent, 'top-1')

      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content).toBe(testContent)
    })

    it('should invalidate cache on write', async () => {
      await system.write(WhiteboardType.GLOBAL, 'Original', 'top-1')
      await system.read(WhiteboardType.GLOBAL, 'top-1') // Cache it

      await system.write(WhiteboardType.GLOBAL, 'Updated', 'top-1')
      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')

      expect(content).toBe('Updated')
    })

    it('should emit update event on write', async () => {
      let eventEmitted = false
      system.on('whiteboard:updated', (data) => {
        eventEmitted = true
        expect(data.updatedBy).toBe('top-1')
        expect(data.version).toBe(1)
      })

      await system.write(WhiteboardType.GLOBAL, 'Test', 'top-1')
      expect(eventEmitted).toBe(true)
    })
  })

  describe('Append Operations', () => {
    it('should append content with timestamp and attribution', async () => {
      await system.write(WhiteboardType.GLOBAL, 'Initial content', 'top-1')
      await system.append(WhiteboardType.GLOBAL, 'Appended content', 'top-2')

      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content).toContain('Initial content')
      expect(content).toContain('Appended content')
      expect(content).toContain('**By**: top-2')
      expect(content).toMatch(/### Update - \d{4}-\d{2}-\d{2}/)
    })
  })

  describe('Permission Enforcement', () => {
    it('should allow top agents to read global whiteboard', async () => {
      await expect(
        system.read(WhiteboardType.GLOBAL, 'top-1')
      ).resolves.toBeDefined()
    })

    it('should allow mid agents to read global whiteboard', async () => {
      await expect(
        system.read(WhiteboardType.GLOBAL, 'mid-1')
      ).resolves.toBeDefined()
    })

    it('should allow bottom agents to read global whiteboard', async () => {
      await expect(
        system.read(WhiteboardType.GLOBAL, 'bot-1')
      ).resolves.toBeDefined()
    })

    it('should deny mid agents from writing to global whiteboard', async () => {
      await expect(
        system.write(WhiteboardType.GLOBAL, 'Test', 'mid-1')
      ).rejects.toThrow('Permission denied')
    })

    it('should deny bottom agents from writing to global whiteboard', async () => {
      await expect(
        system.write(WhiteboardType.GLOBAL, 'Test', 'bot-1')
      ).rejects.toThrow('Permission denied')
    })

    it('should allow mid agents to write to their own whiteboard', async () => {
      await expect(
        system.write(WhiteboardType.MID_LAYER, 'Test', 'mid-1', 'mid-1')
      ).resolves.toBeUndefined()
    })

    it('should deny mid agents from writing to other mid whiteboards', async () => {
      await expect(
        system.write(WhiteboardType.MID_LAYER, 'Test', 'mid-1', 'mid-2')
      ).rejects.toThrow('Permission denied')
    })

    it('should allow bottom agents to read supervisor whiteboard', async () => {
      await expect(
        system.read(WhiteboardType.MID_LAYER, 'bot-1', 'mid-1')
      ).resolves.toBeDefined()
    })

    it('should deny bottom agents from reading non-supervisor mid whiteboard', async () => {
      await expect(
        system.read(WhiteboardType.MID_LAYER, 'bot-1', 'mid-2')
      ).rejects.toThrow('Permission denied')
    })
  })

  describe('Concurrent Access', () => {
    it('should handle concurrent writes with locks', async () => {
      // Start both writes concurrently
      const write1 = system.write(WhiteboardType.GLOBAL, 'Content A', 'top-1')
      const write2 = system.write(WhiteboardType.GLOBAL, 'Content B', 'top-2')

      // One should succeed, one should fail due to lock
      const results = await Promise.allSettled([write1, write2])

      // At least one should succeed
      const succeeded = results.filter((r) => r.status === 'fulfilled')
      expect(succeeded.length).toBeGreaterThanOrEqual(1)

      // If one failed, it should be due to lock conflict
      const failed = results.filter((r) => r.status === 'rejected')
      if (failed.length > 0) {
        const reason = (failed[0] as PromiseRejectedResult).reason
        expect(reason.message).toContain('is locked by')
      }

      // Final content should be one of the writes
      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content === 'Content A' || content === 'Content B').toBe(true)
    })
  })

  describe('Metadata', () => {
    it('should track version numbers', async () => {
      await system.write(WhiteboardType.GLOBAL, 'v1', 'top-1')
      const meta1 = system.getMetadata(WhiteboardType.GLOBAL)
      expect(meta1?.version).toBe(1)

      await system.write(WhiteboardType.GLOBAL, 'v2', 'top-1')
      const meta2 = system.getMetadata(WhiteboardType.GLOBAL)
      expect(meta2?.version).toBe(2)
    })

    it('should track last modified by', async () => {
      await system.write(WhiteboardType.GLOBAL, 'Test', 'top-1')
      const meta = system.getMetadata(WhiteboardType.GLOBAL)
      expect(meta?.lastModifiedBy).toBe('top-1')
    })
  })

  describe('Cache Management', () => {
    it('should clear cache for specific whiteboard', async () => {
      await system.write(WhiteboardType.GLOBAL, 'Original', 'top-1')
      await system.read(WhiteboardType.GLOBAL, 'top-1') // Cache it

      // Modify directly
      const globalPath = path.join(TEST_WORKSPACE, 'global-whiteboard.md')
      await fs.writeFile(globalPath, 'Modified', 'utf-8')

      // Clear cache
      system.clearCache(WhiteboardType.GLOBAL)

      // Should read new content
      const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
      expect(content).toBe('Modified')
    })

    it('should clear all caches', async () => {
      await system.write(WhiteboardType.GLOBAL, 'Test1', 'top-1')
      await system.write(WhiteboardType.TOP_LAYER, 'Test2', 'top-1')
      await system.read(WhiteboardType.GLOBAL, 'top-1')
      await system.read(WhiteboardType.TOP_LAYER, 'top-1')

      system.clearCache()

      // Both should be re-read from disk
      const content1 = await system.read(WhiteboardType.GLOBAL, 'top-1')
      const content2 = await system.read(WhiteboardType.TOP_LAYER, 'top-1')

      expect(content1).toBe('Test1')
      expect(content2).toBe('Test2')
    })
  })
})
