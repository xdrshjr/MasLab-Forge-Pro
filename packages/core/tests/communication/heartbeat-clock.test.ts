/**
 * Tests for HeartbeatClock
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { HeartbeatClock } from '../../src/communication/heartbeat-clock.js'

describe('HeartbeatClock', () => {
  let clock: HeartbeatClock

  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    if (clock && clock.getIsRunning()) {
      clock.stop()
    }
    vi.restoreAllMocks()
  })

  describe('constructor', () => {
    it('should create clock with default interval', () => {
      clock = new HeartbeatClock()
      expect(clock.getInterval()).toBe(4000)
    })

    it('should create clock with custom interval', () => {
      clock = new HeartbeatClock({ interval: 2000 })
      expect(clock.getInterval()).toBe(2000)
    })
  })

  describe('start and stop', () => {
    it('should start the clock', () => {
      clock = new HeartbeatClock()
      clock.start()

      expect(clock.getIsRunning()).toBe(true)
      expect(clock.getCurrentHeartbeat()).toBe(0)
    })

    it('should throw error if already running', () => {
      clock = new HeartbeatClock()
      clock.start()

      expect(() => clock.start()).toThrow('HeartbeatClock is already running')
    })

    it('should stop the clock', () => {
      clock = new HeartbeatClock()
      clock.start()
      clock.stop()

      expect(clock.getIsRunning()).toBe(false)
    })

    it('should handle stop when not running', () => {
      clock = new HeartbeatClock()
      expect(() => clock.stop()).not.toThrow()
    })
  })

  describe('heartbeat ticking', () => {
    it('should increment heartbeat on each tick', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      clock.start()

      expect(clock.getCurrentHeartbeat()).toBe(0)

      vi.advanceTimersByTime(1000)
      expect(clock.getCurrentHeartbeat()).toBe(1)

      vi.advanceTimersByTime(1000)
      expect(clock.getCurrentHeartbeat()).toBe(2)

      vi.advanceTimersByTime(1000)
      expect(clock.getCurrentHeartbeat()).toBe(3)
    })

    it('should trigger listeners on each heartbeat', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      const listener = vi.fn()

      clock.onHeartbeat(listener)
      clock.start()

      vi.advanceTimersByTime(1000)
      expect(listener).toHaveBeenCalledTimes(1)
      expect(listener).toHaveBeenCalledWith(1)

      vi.advanceTimersByTime(1000)
      expect(listener).toHaveBeenCalledTimes(2)
      expect(listener).toHaveBeenCalledWith(2)
    })

    it('should trigger multiple listeners', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      const listener1 = vi.fn()
      const listener2 = vi.fn()
      const listener3 = vi.fn()

      clock.onHeartbeat(listener1)
      clock.onHeartbeat(listener2)
      clock.onHeartbeat(listener3)
      clock.start()

      vi.advanceTimersByTime(1000)

      expect(listener1).toHaveBeenCalledWith(1)
      expect(listener2).toHaveBeenCalledWith(1)
      expect(listener3).toHaveBeenCalledWith(1)
    })

    it('should handle listener errors gracefully', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      const errorListener = vi.fn(() => {
        throw new Error('Listener error')
      })
      const goodListener = vi.fn()

      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      clock.onHeartbeat(errorListener)
      clock.onHeartbeat(goodListener)
      clock.start()

      vi.advanceTimersByTime(1000)

      expect(errorListener).toHaveBeenCalled()
      expect(goodListener).toHaveBeenCalled()
      expect(consoleErrorSpy).toHaveBeenCalled()

      consoleErrorSpy.mockRestore()
    })
  })

  describe('listener management', () => {
    it('should remove listener with offHeartbeat', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      const listener = vi.fn()

      clock.onHeartbeat(listener)
      clock.start()

      vi.advanceTimersByTime(1000)
      expect(listener).toHaveBeenCalledTimes(1)

      clock.offHeartbeat(listener)
      vi.advanceTimersByTime(1000)
      expect(listener).toHaveBeenCalledTimes(1) // Not called again
    })

    it('should handle removing non-existent listener', () => {
      clock = new HeartbeatClock()
      const listener = vi.fn()

      expect(() => clock.offHeartbeat(listener)).not.toThrow()
    })
  })

  describe('getElapsedTime', () => {
    it('should calculate elapsed time correctly', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      clock.start()

      expect(clock.getElapsedTime()).toBe(0)

      vi.advanceTimersByTime(1000)
      expect(clock.getElapsedTime()).toBe(1000)

      vi.advanceTimersByTime(2000)
      expect(clock.getElapsedTime()).toBe(3000)
    })

    it('should use configured interval for calculation', () => {
      clock = new HeartbeatClock({ interval: 2500 })
      clock.start()

      vi.advanceTimersByTime(2500)
      expect(clock.getElapsedTime()).toBe(2500)

      vi.advanceTimersByTime(2500)
      expect(clock.getElapsedTime()).toBe(5000)
    })
  })

  describe('getCurrentHeartbeat', () => {
    it('should return 0 before starting', () => {
      clock = new HeartbeatClock()
      expect(clock.getCurrentHeartbeat()).toBe(0)
    })

    it('should return 0 immediately after starting', () => {
      clock = new HeartbeatClock()
      clock.start()
      expect(clock.getCurrentHeartbeat()).toBe(0)
    })

    it('should return current count after ticks', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      clock.start()

      vi.advanceTimersByTime(5000)
      expect(clock.getCurrentHeartbeat()).toBe(5)
    })
  })

  describe('stop behavior', () => {
    it('should stop triggering listeners after stop', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      const listener = vi.fn()

      clock.onHeartbeat(listener)
      clock.start()

      vi.advanceTimersByTime(2000)
      expect(listener).toHaveBeenCalledTimes(2)

      clock.stop()
      vi.advanceTimersByTime(2000)
      expect(listener).toHaveBeenCalledTimes(2) // No additional calls
    })

    it('should preserve heartbeat count after stop', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      clock.start()

      vi.advanceTimersByTime(3000)
      expect(clock.getCurrentHeartbeat()).toBe(3)

      clock.stop()
      expect(clock.getCurrentHeartbeat()).toBe(3) // Count preserved
    })
  })

  describe('restart behavior', () => {
    it('should reset heartbeat count on restart', () => {
      clock = new HeartbeatClock({ interval: 1000 })
      clock.start()

      vi.advanceTimersByTime(3000)
      expect(clock.getCurrentHeartbeat()).toBe(3)

      clock.stop()
      clock.start()

      expect(clock.getCurrentHeartbeat()).toBe(0) // Reset to 0
    })
  })
})
