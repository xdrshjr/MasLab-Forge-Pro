/**
 * File Lock Manager Tests
 *
 * Tests for file locking mechanism.
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { FileLockManager } from '../src/whiteboard/locks.js'

describe('FileLockManager', () => {
  let lockManager: FileLockManager

  beforeEach(() => {
    lockManager = new FileLockManager()
  })

  describe('Lock Acquisition', () => {
    it('should acquire lock successfully', async () => {
      const lockId = await lockManager.acquireLock('/path/to/file', 'agent-1')
      expect(lockId).toBeDefined()
      expect(typeof lockId).toBe('string')
    })

    it('should prevent other agents from acquiring same lock', async () => {
      await lockManager.acquireLock('/path/to/file', 'agent-1')

      await expect(
        lockManager.acquireLock('/path/to/file', 'agent-2')
      ).rejects.toThrow('is locked by agent-1')
    })

    it('should allow reentrant locks for same agent', async () => {
      const lockId1 = await lockManager.acquireLock('/path/to/file', 'agent-1')
      const lockId2 = await lockManager.acquireLock('/path/to/file', 'agent-1')

      // Should return same lock ID
      expect(lockId2).toBe(lockId1)
    })

    it('should allow locking different files', async () => {
      const lockId1 = await lockManager.acquireLock('/path/to/file1', 'agent-1')
      const lockId2 = await lockManager.acquireLock('/path/to/file2', 'agent-2')

      expect(lockId1).not.toBe(lockId2)
    })
  })

  describe('Lock Release', () => {
    it('should release lock successfully', async () => {
      const lockId = await lockManager.acquireLock('/path/to/file', 'agent-1')
      lockManager.releaseLock(lockId)

      // Should be able to acquire again
      const newLockId = await lockManager.acquireLock(
        '/path/to/file',
        'agent-2'
      )
      expect(newLockId).toBeDefined()
    })

    it('should handle releasing non-existent lock', () => {
      // Should not throw
      expect(() => lockManager.releaseLock('invalid-lock-id')).not.toThrow()
    })
  })

  describe('Lock Status', () => {
    it('should report locked status correctly', async () => {
      expect(lockManager.isLocked('/path/to/file')).toBe(false)

      await lockManager.acquireLock('/path/to/file', 'agent-1')
      expect(lockManager.isLocked('/path/to/file')).toBe(true)
    })

    it('should get lock information', async () => {
      const lockId = await lockManager.acquireLock('/path/to/file', 'agent-1')
      const lock = lockManager.getLock('/path/to/file')

      expect(lock).toBeDefined()
      expect(lock?.lockId).toBe(lockId)
      expect(lock?.agentId).toBe('agent-1')
      expect(lock?.whiteboardPath).toBe('/path/to/file')
    })
  })

  describe('Lock Expiration', () => {
    it('should expire locks after timeout', async () => {
      await lockManager.acquireLock('/path/to/file', 'agent-1')

      // Wait for lock to expire (5 seconds + buffer)
      await new Promise((resolve) => setTimeout(resolve, 5500))

      // Should be able to acquire lock again
      const newLockId = await lockManager.acquireLock(
        '/path/to/file',
        'agent-2'
      )
      expect(newLockId).toBeDefined()
    })

    it('should clean up expired locks automatically', async () => {
      await lockManager.acquireLock('/path/to/file', 'agent-1')

      // Wait for expiration
      await new Promise((resolve) => setTimeout(resolve, 5500))

      // Check status should trigger cleanup
      expect(lockManager.isLocked('/path/to/file')).toBe(false)
    })
  })
})
