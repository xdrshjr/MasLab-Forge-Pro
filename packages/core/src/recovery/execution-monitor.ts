/**
 * Execution Monitor
 *
 * Monitors long-running task executions and enforces timeouts
 * to prevent agents from getting stuck.
 */

import type { ErrorRecoveryManager } from './error-recovery-manager.js'
import { ErrorSeverity } from './types.js'

interface ActiveExecution {
  agentId: string
  startTime: number
  timeout: NodeJS.Timeout
}

/**
 * Monitors task execution and enforces timeouts
 */
export class ExecutionMonitor {
  private activeExecutions: Map<string, ActiveExecution> = new Map()

  constructor(private errorRecoveryManager?: ErrorRecoveryManager) {}

  /**
   * Start monitoring an execution
   */
  startMonitoring(
    executionId: string,
    agentId: string,
    timeoutMs: number,
    onTimeout: () => void
  ): void {
    const timeout = setTimeout(() => {
      void this.handleTimeout(executionId)
      onTimeout()
    }, timeoutMs)

    this.activeExecutions.set(executionId, {
      agentId,
      startTime: Date.now(),
      timeout,
    })

    console.log(`[ExecutionMonitor] Started monitoring ${executionId} (timeout: ${timeoutMs}ms)`)
  }

  /**
   * Stop monitoring an execution
   */
  stopMonitoring(executionId: string): void {
    const execution = this.activeExecutions.get(executionId)
    if (execution) {
      clearTimeout(execution.timeout)
      this.activeExecutions.delete(executionId)
      console.log(`[ExecutionMonitor] Stopped monitoring ${executionId}`)
    }
  }

  /**
   * Handle execution timeout
   */
  private async handleTimeout(executionId: string): Promise<void> {
    const execution = this.activeExecutions.get(executionId)
    if (!execution) {
      return
    }

    const duration = Date.now() - execution.startTime
    console.error(`[ExecutionMonitor] Timeout after ${duration}ms: ${executionId}`)

    // Trigger error recovery if available
    if (this.errorRecoveryManager) {
      await this.errorRecoveryManager.handleError({
        error: new Error(`Execution timeout after ${duration}ms`),
        agentId: execution.agentId,
        taskId: executionId,
        attemptCount: 0,
        severity: ErrorSeverity.HIGH,
      })
    }

    this.activeExecutions.delete(executionId)
  }

  /**
   * Get active execution count
   */
  getActiveCount(): number {
    return this.activeExecutions.size
  }

  /**
   * Clear all active executions
   */
  clearAll(): void {
    for (const [, execution] of this.activeExecutions) {
      clearTimeout(execution.timeout)
    }
    this.activeExecutions.clear()
  }
}
