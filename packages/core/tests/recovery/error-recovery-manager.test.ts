/**
 * Error Recovery Manager Tests
 */

import { describe, it, expect, beforeEach } from 'vitest'
import { ErrorRecoveryManager } from '../../src/recovery/error-recovery-manager.js'
import { ErrorSeverity } from '../../src/recovery/types.js'

describe('ErrorRecoveryManager', () => {
  let manager: ErrorRecoveryManager

  beforeEach(() => {
    manager = new ErrorRecoveryManager()
  })

  describe('classifyError', () => {
    it('should classify authentication errors as CRITICAL', () => {
      const error = new Error('Authentication failed')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.CRITICAL)
    })

    it('should classify permission errors as CRITICAL', () => {
      const error = new Error('Permission denied')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.CRITICAL)
    })

    it('should classify timeout errors as HIGH', () => {
      const error = new Error('Connection timeout')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.HIGH)
    })

    it('should classify network errors as HIGH', () => {
      const error = new Error('Network error: ECONNREFUSED')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.HIGH)
    })

    it('should classify file not found errors as MEDIUM', () => {
      const error = new Error('File not found: ENOENT')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.MEDIUM)
    })

    it('should classify syntax errors as MEDIUM', () => {
      const error = new Error('Syntax error in code')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.MEDIUM)
    })

    it('should classify unknown errors as LOW', () => {
      const error = new Error('Some random error')
      const severity = manager.classifyError(error)
      expect(severity).toBe(ErrorSeverity.LOW)
    })
  })

  describe('handleError', () => {
    it('should retry for low severity errors within retry limit', async () => {
      const errorContext = {
        error: new Error('Temporary failure'),
        agentId: 'bot-1',
        taskId: 'task-1',
        attemptCount: 0,
        severity: ErrorSeverity.LOW,
      }

      const action = await manager.handleError(errorContext)

      expect(action.type).toBe('retry')
      expect(action.agentId).toBe('bot-1')
      expect(action.delay).toBeGreaterThan(0)
    })

    it('should use exponential backoff for retries', async () => {
      const errorContext = {
        error: new Error('Temporary failure'),
        agentId: 'bot-1',
        taskId: 'task-1',
        attemptCount: 1,
        severity: ErrorSeverity.MEDIUM,
      }

      const action = await manager.handleError(errorContext)

      expect(action.type).toBe('retry')
      // Base delay is 5000ms, with attemptCount=1, backoff multiplier is 2^1 = 2
      expect(action.delay).toBe(10000)
    })

    it('should escalate after exceeding retry limit', async () => {
      const errorContext = {
        error: new Error('Persistent failure'),
        agentId: 'bot-1',
        taskId: 'task-1',
        attemptCount: 3, // Exceeded max retries for MEDIUM (2)
        severity: ErrorSeverity.MEDIUM,
      }

      const action = await manager.handleError(errorContext)

      expect(action.type).toBe('escalate_to_supervisor')
      expect(action.agentId).toBe('bot-1')
    })

    it('should escalate to top layer for critical errors', async () => {
      const errorContext = {
        error: new Error('Authentication failed'),
        agentId: 'bot-1',
        taskId: 'task-1',
        attemptCount: 0,
        severity: ErrorSeverity.CRITICAL,
      }

      const action = await manager.handleError(errorContext)

      expect(action.type).toBe('escalate_to_top')
      expect(action.agentId).toBe('bot-1')
    })

    it('should attempt peer takeover for high severity errors', async () => {
      const errorContext = {
        error: new Error('Connection timeout'),
        agentId: 'bot-1',
        taskId: 'task-1',
        attemptCount: 2, // Exceeded max retries for HIGH (1)
        severity: ErrorSeverity.HIGH,
      }

      const action = await manager.handleError(errorContext)

      expect(action.type).toBe('peer_takeover')
      expect(action.agentId).toBe('bot-1')
      expect(action.taskId).toBe('task-1')
    })
  })
})
