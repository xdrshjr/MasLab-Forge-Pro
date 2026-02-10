/**
 * Optimistic Lock Manager
 *
 * Implements version-based optimistic locking to detect concurrent modifications.
 * Uses version numbers to ensure write operations don't overwrite newer changes.
 */

import { promises as fs } from 'fs'
import type { WhiteboardMetadata } from './types.js'
import { WhiteboardType } from './types.js'

/**
 * Optimistic lock manager
 * Tracks version numbers and detects conflicts during writes
 */
export class OptimisticLockManager {
  private metadata: Map<string, WhiteboardMetadata> = new Map()

  /**
   * Get the current version of a whiteboard
   *
   * @param whiteboardPath - Path to the whiteboard file
   * @returns Current version number (0 if not tracked)
   */
  getVersion(whiteboardPath: string): number {
    const meta = this.metadata.get(whiteboardPath)
    return meta?.version || 0
  }

  /**
   * Write content with version check
   * Throws error if version conflict is detected
   *
   * @param whiteboardPath - Path to the whiteboard file
   * @param content - Content to write
   * @param expectedVersion - Expected current version
   * @param agentId - Agent performing the write
   * @throws Error if version mismatch detected
   */
  async writeWithVersionCheck(
    whiteboardPath: string,
    content: string,
    expectedVersion: number,
    agentId: string
  ): Promise<void> {
    const currentVersion = this.getVersion(whiteboardPath)

    if (currentVersion !== expectedVersion) {
      throw new Error(`Version conflict: expected ${expectedVersion}, got ${currentVersion}`)
    }

    // Write file
    await fs.writeFile(whiteboardPath, content, 'utf-8')

    // Update metadata
    const whiteboardType = this.inferTypeFromPath(whiteboardPath)
    this.metadata.set(whiteboardPath, {
      path: whiteboardPath,
      type: whiteboardType,
      version: currentVersion + 1,
      lastModifiedBy: agentId,
      lastModifiedAt: Date.now(),
    })

    console.log(`Whiteboard updated: ${whiteboardPath} v${currentVersion + 1} by ${agentId}`)
  }

  /**
   * Get metadata for a whiteboard
   *
   * @param whiteboardPath - Path to the whiteboard file
   * @returns Metadata or undefined if not tracked
   */
  getMetadata(whiteboardPath: string): WhiteboardMetadata | undefined {
    return this.metadata.get(whiteboardPath)
  }

  /**
   * Initialize metadata for a new whiteboard
   *
   * @param whiteboardPath - Path to the whiteboard file
   * @param agentId - Agent creating the whiteboard
   */
  initializeMetadata(whiteboardPath: string, agentId: string): void {
    if (!this.metadata.has(whiteboardPath)) {
      const whiteboardType = this.inferTypeFromPath(whiteboardPath)
      this.metadata.set(whiteboardPath, {
        path: whiteboardPath,
        type: whiteboardType,
        version: 0,
        lastModifiedBy: agentId,
        lastModifiedAt: Date.now(),
      })
    }
  }

  /**
   * Infer whiteboard type from file path
   * Helper method to determine type based on path pattern
   */
  private inferTypeFromPath(filePath: string): WhiteboardType {
    if (filePath.includes('global-whiteboard')) {
      return WhiteboardType.GLOBAL
    } else if (filePath.includes('top-layer')) {
      return WhiteboardType.TOP_LAYER
    } else if (filePath.includes('mid-layer')) {
      return WhiteboardType.MID_LAYER
    } else if (filePath.includes('bottom-layer')) {
      return WhiteboardType.BOTTOM_LAYER
    }
    return WhiteboardType.GLOBAL
  }
}
