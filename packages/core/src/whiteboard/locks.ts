/**
 * File Lock Manager
 *
 * Implements file-level locking for concurrent access control.
 * Prevents multiple agents from writing to the same whiteboard simultaneously.
 */

import { randomUUID } from 'crypto'
import type { FileLock } from './types.js'

/**
 * File lock manager
 * Manages locks for whiteboard files to prevent concurrent write conflicts
 */
export class FileLockManager {
  private locks: Map<string, FileLock> = new Map()
  private lockTimeout: number = 5000 // 5 seconds

  /**
   * Acquire a lock on a whiteboard file
   *
   * @param whiteboardPath - Path to the whiteboard file
   * @param agentId - Agent requesting the lock
   * @returns Lock ID
   * @throws Error if whiteboard is already locked by another agent
   */
  acquireLock(whiteboardPath: string, agentId: string): Promise<string> {
    return new Promise((resolve, reject) => {
      // Clean up expired locks first
      this.cleanupExpiredLocks()

      // Check if already locked
      const existingLock = this.locks.get(whiteboardPath)

      if (existingLock) {
        // Reentrant lock: same agent can extend the lock
        if (existingLock.agentId === agentId) {
          existingLock.expiresAt = Date.now() + this.lockTimeout
          resolve(existingLock.lockId)
          return
        } else {
          reject(new Error(`Whiteboard ${whiteboardPath} is locked by ${existingLock.agentId}`))
          return
        }
      }

      // Acquire new lock
      const lockId = randomUUID()
      const lock: FileLock = {
        lockId,
        whiteboardPath,
        agentId,
        acquiredAt: Date.now(),
        expiresAt: Date.now() + this.lockTimeout,
      }

      this.locks.set(whiteboardPath, lock)
      resolve(lockId)
    })
  }

  /**
   * Release a lock
   *
   * @param lockId - Lock ID to release
   */
  releaseLock(lockId: string): void {
    for (const [path, lock] of this.locks) {
      if (lock.lockId === lockId) {
        this.locks.delete(path)
        return
      }
    }
  }

  /**
   * Clean up expired locks
   * Removes locks that have exceeded their timeout
   */
  private cleanupExpiredLocks(): void {
    const now = Date.now()
    for (const [path, lock] of this.locks) {
      if (lock.expiresAt < now) {
        this.locks.delete(path)
        console.warn(`Lock expired: ${path}`)
      }
    }
  }

  /**
   * Check if a whiteboard is currently locked
   *
   * @param whiteboardPath - Path to check
   * @returns True if locked, false otherwise
   */
  isLocked(whiteboardPath: string): boolean {
    this.cleanupExpiredLocks()
    return this.locks.has(whiteboardPath)
  }

  /**
   * Get lock information for a whiteboard
   *
   * @param whiteboardPath - Path to check
   * @returns Lock information or undefined if not locked
   */
  getLock(whiteboardPath: string): FileLock | undefined {
    this.cleanupExpiredLocks()
    return this.locks.get(whiteboardPath)
  }
}
