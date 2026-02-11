/**
 * Error Recovery Manager
 *
 * Handles error classification, retry logic with exponential backoff,
 * and escalation decisions based on error severity.
 */

import type { ErrorContext, RecoveryAction, ErrorSeverity } from './types.js'
import { ErrorSeverity as Severity } from './types.js'

/**
 * Manages error recovery strategies
 */
export class ErrorRecoveryManager {
  private maxRetries: Map<ErrorSeverity, number>
  private backoffDelays: Map<ErrorSeverity, number>

  constructor() {
    // Configure max retries per severity level
    this.maxRetries = new Map([
      [Severity.LOW, 3],
      [Severity.MEDIUM, 2],
      [Severity.HIGH, 1],
      [Severity.CRITICAL, 0],
    ])

    // Configure base backoff delays (in milliseconds)
    this.backoffDelays = new Map([
      [Severity.LOW, 1000], // 1 second
      [Severity.MEDIUM, 5000], // 5 seconds
      [Severity.HIGH, 10000], // 10 seconds
      [Severity.CRITICAL, 0],
    ])
  }

  /**
   * Handle an error and determine recovery action
   */
  async handleError(errorContext: ErrorContext): Promise<RecoveryAction> {
    const severity = this.classifyError(errorContext.error)
    errorContext.severity = severity

    console.log(
      `[ErrorRecovery] ${severity} error in ${errorContext.agentId}: ${errorContext.error.message}`
    )

    // Determine recovery strategy
    const maxRetries = this.maxRetries.get(severity) ?? 0

    if (errorContext.attemptCount < maxRetries) {
      // Retry with backoff
      return await this.retryWithBackoff(errorContext)
    }

    // Exceeded retries, escalate
    return this.escalate(errorContext)
  }

  /**
   * Classify error severity based on error message
   */
  classifyError(error: Error): ErrorSeverity {
    const message = error.message.toLowerCase()

    // Critical errors - require immediate top-layer attention
    if (
      message.includes('authentication') ||
      message.includes('permission denied') ||
      message.includes('api key') ||
      message.includes('unauthorized')
    ) {
      return Severity.CRITICAL
    }

    // High severity - network/timeout issues
    if (
      message.includes('timeout') ||
      message.includes('connection') ||
      message.includes('network') ||
      message.includes('econnrefused')
    ) {
      return Severity.HIGH
    }

    // Medium severity - file/syntax errors
    if (
      message.includes('file not found') ||
      message.includes('syntax error') ||
      message.includes('parse error') ||
      message.includes('enoent')
    ) {
      return Severity.MEDIUM
    }

    // Low severity (default)
    return Severity.LOW
  }

  /**
   * Retry with exponential backoff
   */
  private async retryWithBackoff(errorContext: ErrorContext): Promise<RecoveryAction> {
    const baseDelay = this.backoffDelays.get(errorContext.severity) ?? 1000
    const backoffMultiplier = Math.pow(2, errorContext.attemptCount)
    const actualDelay = baseDelay * backoffMultiplier

    console.log(
      `[ErrorRecovery] Retrying in ${actualDelay}ms (attempt ${errorContext.attemptCount + 1})`
    )

    // Wait for backoff period
    await this.sleep(actualDelay)

    return {
      type: 'retry',
      agentId: errorContext.agentId,
      delay: actualDelay,
    }
  }

  /**
   * Escalate error based on severity
   */
  private escalate(errorContext: ErrorContext): RecoveryAction {
    const { severity } = errorContext

    if (severity === Severity.CRITICAL) {
      // Escalate to top layer immediately
      return {
        type: 'escalate_to_top',
        agentId: errorContext.agentId,
        error: errorContext.error,
      }
    }

    if (severity === Severity.HIGH) {
      // Try peer takeover first
      return {
        type: 'peer_takeover',
        agentId: errorContext.agentId,
        taskId: errorContext.taskId,
      }
    }

    // Medium/Low: escalate to supervisor
    return {
      type: 'escalate_to_supervisor',
      agentId: errorContext.agentId,
      error: errorContext.error,
    }
  }

  /**
   * Sleep utility
   */
  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}
