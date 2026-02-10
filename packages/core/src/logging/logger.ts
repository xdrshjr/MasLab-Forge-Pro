/**
 * Logging system for the multi-agent governance framework
 *
 * Provides category-based logging with pino, supporting multiple
 * log files and structured logging.
 */

import pino from 'pino'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

/**
 * Log category types
 */
export type LogCategory =
  | 'message-bus'
  | 'audit'
  | 'performance'
  | 'error'
  | 'governance'
  | 'agent'
  | 'whiteboard'
  | 'database'

/**
 * Logger configuration
 */
export interface LoggerConfig {
  workspacePath: string
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  enableConsole?: boolean
  enableFile?: boolean
}

/**
 * Logger factory that creates category-specific loggers
 */
export class LoggerFactory {
  private logDir: string
  private config: LoggerConfig
  private loggers: Map<LogCategory, pino.Logger> = new Map()

  constructor(config: LoggerConfig) {
    this.config = {
      level: config.level ?? 'info',
      enableConsole: config.enableConsole ?? true,
      enableFile: config.enableFile ?? true,
      ...config,
    }

    this.logDir = join(config.workspacePath, 'logs')

    // Create logs directory if it doesn't exist
    if (this.config.enableFile && !existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  /**
   * Creates or retrieves a logger for a specific category
   *
   * @param category - Log category
   * @returns Pino logger instance
   */
  createLogger(category: LogCategory): pino.Logger {
    // Return cached logger if exists
    const existingLogger = this.loggers.get(category)
    if (existingLogger) {
      return existingLogger
    }

    const targets: pino.TransportTargetOptions[] = []

    // Add file transport if enabled
    if (this.config.enableFile) {
      const logFile = join(this.logDir, `${category}.log`)
      targets.push({
        target: 'pino/file',
        level: this.config.level,
        options: {
          destination: logFile,
          mkdir: true,
        },
      })
    }

    // Add console transport if enabled
    if (this.config.enableConsole) {
      targets.push({
        target: 'pino-pretty',
        level: this.config.level,
        options: {
          destination: 1, // stdout
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
      })
    }

    const logger = pino({
      name: category,
      level: this.config.level,
      transport: targets.length > 0 ? { targets } : undefined,
      timestamp: pino.stdTimeFunctions.isoTime,
    })

    this.loggers.set(category, logger)
    return logger
  }

  /**
   * Gets an existing logger or creates a new one
   *
   * @param category - Log category
   * @returns Pino logger instance
   */
  getLogger(category: LogCategory): pino.Logger {
    return this.createLogger(category)
  }

  /**
   * Gets the logs directory path
   *
   * @returns Logs directory path
   */
  getLogDir(): string {
    return this.logDir
  }

  /**
   * Closes all loggers
   */
  closeAll(): void {
    for (const logger of this.loggers.values()) {
      logger.flush()
    }
    this.loggers.clear()
  }
}

/**
 * Structured audit logger for governance events
 */
export class AuditLogger {
  private logger: pino.Logger

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.getLogger('audit')
  }

  /**
   * Logs a governance event
   *
   * @param event - Audit event details
   */
  logEvent(event: {
    taskId: string
    agentId: string
    eventType: string
    reason: string
    metadata?: Record<string, unknown>
  }): void {
    this.logger.info(
      {
        event: 'audit',
        taskId: event.taskId,
        agentId: event.agentId,
        eventType: event.eventType,
        metadata: event.metadata,
      },
      `Audit: ${event.eventType} - ${event.reason}`
    )
  }

  /**
   * Logs a warning event
   *
   * @param agentId - Agent ID
   * @param reason - Warning reason
   * @param taskId - Task ID
   */
  logWarning(agentId: string, reason: string, taskId: string): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'warning',
      reason,
    })
  }

  /**
   * Logs a dismissal event
   *
   * @param agentId - Agent ID
   * @param reason - Dismissal reason
   * @param taskId - Task ID
   */
  logDismissal(agentId: string, reason: string, taskId: string): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'dismissal',
      reason,
    })
  }

  /**
   * Logs a promotion event
   *
   * @param agentId - Agent ID
   * @param reason - Promotion reason
   * @param taskId - Task ID
   */
  logPromotion(agentId: string, reason: string, taskId: string): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'promotion',
      reason,
    })
  }

  /**
   * Logs a decision event
   *
   * @param decisionId - Decision ID
   * @param proposerId - Proposer agent ID
   * @param status - Decision status
   * @param taskId - Task ID
   */
  logDecision(decisionId: string, proposerId: string, status: string, taskId: string): void {
    this.logEvent({
      taskId,
      agentId: proposerId,
      eventType: 'decision',
      reason: `Decision ${decisionId} ${status}`,
      metadata: { decisionId, status },
    })
  }
}

/**
 * Performance logger for tracking system metrics
 */
export class PerformanceLogger {
  private logger: pino.Logger

  constructor(loggerFactory: LoggerFactory) {
    this.logger = loggerFactory.getLogger('performance')
  }

  /**
   * Logs a performance metric
   *
   * @param metric - Metric details
   */
  logMetric(metric: {
    name: string
    value: number
    unit: string
    context?: Record<string, unknown>
  }): void {
    this.logger.info(
      {
        metric: metric.name,
        value: metric.value,
        unit: metric.unit,
        context: metric.context,
      },
      `Performance: ${metric.name} = ${metric.value}${metric.unit}`
    )
  }

  /**
   * Logs heartbeat processing time
   *
   * @param heartbeatNumber - Heartbeat number
   * @param durationMs - Processing duration in milliseconds
   * @param agentCount - Number of agents processed
   */
  logHeartbeat(heartbeatNumber: number, durationMs: number, agentCount: number): void {
    this.logMetric({
      name: 'heartbeat_duration',
      value: durationMs,
      unit: 'ms',
      context: { heartbeatNumber, agentCount },
    })
  }

  /**
   * Logs message bus throughput
   *
   * @param messagesPerSecond - Messages processed per second
   * @param queueSize - Current queue size
   */
  logMessageBusThroughput(messagesPerSecond: number, queueSize: number): void {
    this.logMetric({
      name: 'message_bus_throughput',
      value: messagesPerSecond,
      unit: 'msg/s',
      context: { queueSize },
    })
  }

  /**
   * Logs database query performance
   *
   * @param query - Query name
   * @param durationMs - Query duration in milliseconds
   */
  logDatabaseQuery(query: string, durationMs: number): void {
    this.logMetric({
      name: 'database_query',
      value: durationMs,
      unit: 'ms',
      context: { query },
    })
  }
}
