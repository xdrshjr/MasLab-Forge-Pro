/**
 * Execution Monitor Tests
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ExecutionMonitor } from '../../src/recovery/execution-monitor.js'

describe('ExecutionMonitor', () => {
  let monitor: ExecutionMonitor

  beforeEach(() => {
    monitor = new ExecutionMonitor()
    vi.useFakeTimers()
  })

  afterEach(() => {
    monitor.clearAll()
    vi.restoreAllMocks()
  })

  it('should start monitoring an execution', () => {
    const onTimeout = vi.fn()

    monitor.startMonitoring('exec-1', 'bot-1', 1000, onTimeout)

    expect(monitor.getActiveCount()).toBe(1)
  })

  it('should trigger timeout callback after timeout period', async () => {
    const onTimeout = vi.fn()

    monitor.startMonitoring('exec-1', 'bot-1', 1000, onTimeout)

    // Fast-forward time
    vi.advanceTimersByTime(1100)

    expect(onTimeout).toHaveBeenCalled()
    expect(monitor.getActiveCount()).toBe(0)
  })

  it('should stop monitoring and cancel timeout', async () => {
    const onTimeout = vi.fn()

    monitor.startMonitoring('exec-1', 'bot-1', 1000, onTimeout)
    monitor.stopMonitoring('exec-1')

    // Fast-forward time
    vi.advanceTimersByTime(1100)

    expect(onTimeout).not.toHaveBeenCalled()
    expect(monitor.getActiveCount()).toBe(0)
  })

  it('should handle multiple concurrent executions', () => {
    const onTimeout1 = vi.fn()
    const onTimeout2 = vi.fn()

    monitor.startMonitoring('exec-1', 'bot-1', 1000, onTimeout1)
    monitor.startMonitoring('exec-2', 'bot-2', 2000, onTimeout2)

    expect(monitor.getActiveCount()).toBe(2)

    // Stop one execution
    monitor.stopMonitoring('exec-1')

    expect(monitor.getActiveCount()).toBe(1)
  })

  it('should clear all active executions', () => {
    const onTimeout1 = vi.fn()
    const onTimeout2 = vi.fn()

    monitor.startMonitoring('exec-1', 'bot-1', 1000, onTimeout1)
    monitor.startMonitoring('exec-2', 'bot-2', 2000, onTimeout2)

    expect(monitor.getActiveCount()).toBe(2)

    monitor.clearAll()

    expect(monitor.getActiveCount()).toBe(0)

    // Fast-forward time - callbacks should not be called
    vi.advanceTimersByTime(3000)

    expect(onTimeout1).not.toHaveBeenCalled()
    expect(onTimeout2).not.toHaveBeenCalled()
  })
})
