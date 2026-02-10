/**
 * Heartbeat clock for synchronous agent coordination
 *
 * Implements a fixed-interval timer that triggers heartbeat events
 * every 4 seconds, enabling synchronized message processing across
 * all agents in the system (von Neumann architecture style).
 */

/**
 * Heartbeat listener callback type
 */
export type HeartbeatListener = (heartbeat: number) => void

/**
 * Heartbeat clock configuration
 */
export interface HeartbeatClockConfig {
  interval?: number // Heartbeat interval in milliseconds (default: 4000)
}

/**
 * Heartbeat clock for coordinating agent activities
 */
export class HeartbeatClock {
  private interval: number
  private timer: NodeJS.Timeout | null = null
  private currentHeartbeat: number = 0
  private listeners: HeartbeatListener[] = []
  private isRunning: boolean = false

  constructor(config: HeartbeatClockConfig = {}) {
    this.interval = config.interval ?? 4000 // Default: 4 seconds
  }

  /**
   * Start the heartbeat clock
   *
   * @throws Error if clock is already running
   */
  start(): void {
    if (this.isRunning) {
      throw new Error('HeartbeatClock is already running')
    }

    this.isRunning = true
    this.currentHeartbeat = 0

    this.timer = setInterval(() => {
      this.tick()
    }, this.interval)

    console.log(`HeartbeatClock started (interval: ${this.interval}ms)`)
  }

  /**
   * Stop the heartbeat clock
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
      this.isRunning = false
    }

    console.log('HeartbeatClock stopped')
  }

  /**
   * Internal tick handler - increments heartbeat and notifies listeners
   */
  private tick(): void {
    this.currentHeartbeat++

    // Notify all registered listeners
    for (const listener of this.listeners) {
      try {
        listener(this.currentHeartbeat)
      } catch (error) {
        console.error('Heartbeat listener error:', error)
      }
    }
  }

  /**
   * Register a callback to be invoked on each heartbeat
   *
   * @param callback - Function to call on each heartbeat
   */
  onHeartbeat(callback: HeartbeatListener): void {
    this.listeners.push(callback)
  }

  /**
   * Remove a heartbeat listener
   *
   * @param callback - Listener to remove
   */
  offHeartbeat(callback: HeartbeatListener): void {
    const index = this.listeners.indexOf(callback)
    if (index !== -1) {
      this.listeners.splice(index, 1)
    }
  }

  /**
   * Get the current heartbeat number
   *
   * @returns Current heartbeat count
   */
  getCurrentHeartbeat(): number {
    return this.currentHeartbeat
  }

  /**
   * Get the elapsed time since clock started
   *
   * @returns Elapsed time in milliseconds
   */
  getElapsedTime(): number {
    return this.currentHeartbeat * this.interval
  }

  /**
   * Check if the clock is currently running
   *
   * @returns True if running, false otherwise
   */
  getIsRunning(): boolean {
    return this.isRunning
  }

  /**
   * Get the configured heartbeat interval
   *
   * @returns Interval in milliseconds
   */
  getInterval(): number {
    return this.interval
  }
}
