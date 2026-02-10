/**
 * Whiteboard System
 *
 * Core whiteboard management system that coordinates permissions, locking,
 * versioning, and file operations for the multi-agent whiteboard system.
 */

import { promises as fs } from 'fs'
import path from 'path'
import { EventEmitter } from 'events'
import { WhiteboardPermissionChecker } from './permissions.js'
import { FileLockManager } from './locks.js'
import { OptimisticLockManager } from './optimistic-lock.js'
import { WhiteboardTemplates } from './templates.js'
import {
  WhiteboardType,
  type WhiteboardConfig,
  type WhiteboardMetadata
} from './types.js'
import type { AgentRegistry } from './permissions.js'

/**
 * Cache entry for whiteboard content
 */
interface CacheEntry {
  content: string
  cachedAt: number
}

/**
 * Whiteboard system
 * Main class that manages all whiteboard operations
 */
export class WhiteboardSystem extends EventEmitter {
  private config: WhiteboardConfig
  private permissionChecker: WhiteboardPermissionChecker
  private lockManager: FileLockManager
  private optimisticLockManager: OptimisticLockManager
  private cache: Map<string, CacheEntry> = new Map()

  constructor(config: WhiteboardConfig, agentRegistry: AgentRegistry) {
    super()
    this.config = config
    this.permissionChecker = new WhiteboardPermissionChecker(agentRegistry)
    this.lockManager = new FileLockManager()
    this.optimisticLockManager = new OptimisticLockManager()

    // Create workspace directories
    this.initializeWorkspace()
  }

  /**
   * Initialize workspace directory structure
   * Creates necessary directories for whiteboards and locks
   */
  private initializeWorkspace(): void {
    const whiteboardsDir = path.join(this.config.workspacePath, 'whiteboards')
    const locksDir = path.join(whiteboardsDir, '.locks')

    try {
      // Create directories synchronously during initialization
      const mkdirSync = require('fs').mkdirSync
      mkdirSync(whiteboardsDir, { recursive: true })
      mkdirSync(locksDir, { recursive: true })
    } catch (error) {
      console.error('Failed to initialize workspace:', error)
      throw error
    }
  }

  /**
   * Read whiteboard content
   *
   * @param type - Whiteboard type
   * @param agentId - Agent requesting read access
   * @param ownerId - Owner agent ID (for layer-specific whiteboards)
   * @returns Whiteboard content
   * @throws Error if permission denied or file error
   */
  async read(
    type: WhiteboardType,
    agentId: string,
    ownerId?: string
  ): Promise<string> {
    const whiteboardPath = this.resolveWhiteboardPath(type, ownerId)

    // Permission check
    if (!this.permissionChecker.canRead(agentId, { type, ownerId })) {
      throw new Error(
        `Permission denied: ${agentId} cannot read ${whiteboardPath}`
      )
    }

    // Check cache
    const cached = this.cache.get(whiteboardPath)
    if (cached && Date.now() - cached.cachedAt < this.config.cacheTimeout) {
      return cached.content
    }

    // Read file
    try {
      const content = await fs.readFile(whiteboardPath, 'utf-8')
      this.cache.set(whiteboardPath, { content, cachedAt: Date.now() })
      return content
    } catch (error: any) {
      if (error.code === 'ENOENT') {
        // File doesn't exist, return template
        return this.getTemplate(type)
      }
      throw error
    }
  }

  /**
   * Write whiteboard content
   *
   * @param type - Whiteboard type
   * @param content - Content to write
   * @param agentId - Agent performing the write
   * @param ownerId - Owner agent ID (for layer-specific whiteboards)
   * @throws Error if permission denied or lock conflict
   */
  async write(
    type: WhiteboardType,
    content: string,
    agentId: string,
    ownerId?: string
  ): Promise<void> {
    const whiteboardPath = this.resolveWhiteboardPath(type, ownerId)

    // Permission check
    if (!this.permissionChecker.canWrite(agentId, { type, ownerId })) {
      throw new Error(
        `Permission denied: ${agentId} cannot write ${whiteboardPath}`
      )
    }

    // Acquire lock
    const lockId = await this.lockManager.acquireLock(whiteboardPath, agentId)

    try {
      // Optimistic lock write
      const currentVersion = this.optimisticLockManager.getVersion(whiteboardPath)
      await this.optimisticLockManager.writeWithVersionCheck(
        whiteboardPath,
        content,
        currentVersion,
        agentId
      )

      // Invalidate cache
      this.cache.delete(whiteboardPath)

      // Emit update event
      this.emit('whiteboard:updated', {
        path: whiteboardPath,
        updatedBy: agentId,
        version: currentVersion + 1
      })
    } finally {
      this.lockManager.releaseLock(lockId)
    }
  }

  /**
   * Append content to whiteboard
   * Adds timestamped and attributed content to existing whiteboard
   *
   * @param type - Whiteboard type
   * @param content - Content to append
   * @param agentId - Agent performing the append
   * @param ownerId - Owner agent ID (for layer-specific whiteboards)
   */
  async append(
    type: WhiteboardType,
    content: string,
    agentId: string,
    ownerId?: string
  ): Promise<void> {
    const whiteboardPath = this.resolveWhiteboardPath(type, ownerId)

    // Permission check
    if (!this.permissionChecker.canAppend(agentId, { type, ownerId })) {
      throw new Error(
        `Permission denied: ${agentId} cannot append to ${whiteboardPath}`
      )
    }

    const lockId = await this.lockManager.acquireLock(whiteboardPath, agentId)

    try {
      // Read existing content
      const existingContent = await this.read(type, agentId, ownerId)

      // Append with timestamp and attribution
      const timestamp = new Date().toISOString()
      const appendedContent =
        existingContent +
        '\n\n' +
        `### Update - ${timestamp}\n` +
        `**By**: ${agentId}\n\n` +
        content

      // Write back
      await this.write(type, appendedContent, agentId, ownerId)
    } finally {
      this.lockManager.releaseLock(lockId)
    }
  }

  /**
   * Resolve whiteboard file path from type and owner
   *
   * @param type - Whiteboard type
   * @param ownerId - Owner agent ID (required for mid/bottom layer)
   * @returns Absolute file path
   * @throws Error if invalid parameters
   */
  private resolveWhiteboardPath(
    type: WhiteboardType,
    ownerId?: string
  ): string {
    const whiteboardsDir = path.join(this.config.workspacePath, 'whiteboards')

    switch (type) {
      case WhiteboardType.GLOBAL:
        return path.join(this.config.workspacePath, 'global-whiteboard.md')

      case WhiteboardType.TOP_LAYER:
        return path.join(whiteboardsDir, 'top-layer.md')

      case WhiteboardType.MID_LAYER:
        if (!ownerId) {
          throw new Error('ownerId required for mid-layer whiteboard')
        }
        return path.join(whiteboardsDir, `mid-layer-${ownerId}.md`)

      case WhiteboardType.BOTTOM_LAYER:
        if (!ownerId) {
          throw new Error('ownerId required for bottom-layer whiteboard')
        }
        return path.join(whiteboardsDir, `bottom-layer-${ownerId}.md`)

      default:
        throw new Error(`Unknown whiteboard type: ${type}`)
    }
  }

  /**
   * Get template for whiteboard type
   *
   * @param type - Whiteboard type
   * @returns Template string
   */
  private getTemplate(type: WhiteboardType): string {
    switch (type) {
      case WhiteboardType.GLOBAL:
        return WhiteboardTemplates.getTemplate('global')
      case WhiteboardType.TOP_LAYER:
      case WhiteboardType.MID_LAYER:
      case WhiteboardType.BOTTOM_LAYER:
        return WhiteboardTemplates.getTemplate('layer')
      default:
        return '# Whiteboard\n\n'
    }
  }

  /**
   * Get metadata for a whiteboard
   *
   * @param type - Whiteboard type
   * @param ownerId - Owner agent ID (for layer-specific whiteboards)
   * @returns Whiteboard metadata or undefined
   */
  getMetadata(
    type: WhiteboardType,
    ownerId?: string
  ): WhiteboardMetadata | undefined {
    const whiteboardPath = this.resolveWhiteboardPath(type, ownerId)
    return this.optimisticLockManager.getMetadata(whiteboardPath)
  }

  /**
   * Clear cache for a specific whiteboard or all whiteboards
   *
   * @param type - Whiteboard type (optional, clears all if not provided)
   * @param ownerId - Owner agent ID (for layer-specific whiteboards)
   */
  clearCache(type?: WhiteboardType, ownerId?: string): void {
    if (type) {
      const whiteboardPath = this.resolveWhiteboardPath(type, ownerId)
      this.cache.delete(whiteboardPath)
    } else {
      this.cache.clear()
    }
  }
}
