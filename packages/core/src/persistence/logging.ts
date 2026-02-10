/**
 * Logging System
 *
 * Multi-category structured logging using pino.
 * Provides separate loggers for different system components.
 */

import pino from 'pino'
import { mkdirSync, existsSync } from 'fs'
import { join } from 'path'

export interface LoggerConfig {
  workspacePath: string
  level?: 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  prettyPrint?: boolean
}

/**
 * Logger factory for creating category-specific loggers
 */
export class LoggerFactory {
  private logDir: string
  private config: LoggerConfig

  constructor(config: LoggerConfig) {
    this.config = config
    this.logDir = join(config.workspacePath, 'logs')

    // Create logs directory if it doesn't exist
    if (!existsSync(this.logDir)) {
      mkdirSync(this.logDir, { recursive: true })
    }
  }

  /**
   * Create a logger for a specific category
   */
  createLogger(category: string): pino.Logger {
    const logFile = join(this.logDir, `${category}.log`)

    const targets: pino.TransportTargetOptions[] = [
      {
        target: 'pino/file',
        options: { destination: logFile },
        level: this.config.level || 'info',
      },
    ]

    // Add pretty printing for console output if enabled
    if (this.config.prettyPrint) {
      targets.push({
        target: 'pino-pretty',
        options: {
          destination: 1, // stdout
          colorize: true,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
        },
        level: this.config.level || 'info',
      })
    }

    return pino({
      name: category,
      level: this.config.level || 'info',
      timestamp: pino.stdTimeFunctions.isoTime,
      transport: {
        targets,
      },
    })
  }

  /**
   * Get the logs directory path
   */
  getLogDir(): string {
    return this.logDir
  }
}

/**
 * Pre-configured logger categories for the framework
 */
export class SystemLoggers {
  private factory: LoggerFactory

  // Category-specific loggers
  public readonly messageBus: pino.Logger
  public readonly audit: pino.Logger
  public readonly performance: pino.Logger
  public readonly error: pino.Logger
  public readonly governance: pino.Logger
  public readonly agent: pino.Logger
  public readonly whiteboard: pino.Logger

  constructor(config: LoggerConfig) {
    this.factory = new LoggerFactory(config)

    // Initialize all category loggers
    this.messageBus = this.factory.createLogger('message-bus')
    this.audit = this.factory.createLogger('audit')
    this.performance = this.factory.createLogger('performance')
    this.error = this.factory.createLogger('error')
    this.governance = this.factory.createLogger('governance')
    this.agent = this.factory.createLogger('agent')
    this.whiteboard = this.factory.createLogger('whiteboard')
  }

  /**
   * Create a custom logger for a specific category
   */
  createCustomLogger(category: string): pino.Logger {
    return this.factory.createLogger(category)
  }

  /**
   * Get the logs directory
   */
  getLogDir(): string {
    return this.factory.getLogDir()
  }
}

/**
 * Audit event structure for governance logging
 */
export interface AuditEvent {
  taskId: string
  agentId: string
  eventType: 'warning' | 'demotion' | 'dismissal' | 'promotion' | 'veto' | 'decision'
  reason: string
  metadata?: Record<string, unknown>
}

/**
 * Audit logger helper for structured governance event logging
 */
export class AuditLogger {
  constructor(
    private logger: pino.Logger,
    private auditRepo?: { insert: (record: unknown) => void } // AuditRepository - optional to avoid circular dependency
  ) {}

  /**
   * Log an audit event
   */
  logEvent(event: AuditEvent): void {
    // Log to pino
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

    // Optionally persist to database if repository is provided
    if (this.auditRepo) {
      const auditRecord = {
        id: this.generateId(),
        task_id: event.taskId,
        agent_id: event.agentId,
        event_type: event.eventType,
        reason: event.reason,
        created_at: Date.now(),
      }

      try {
        this.auditRepo.insert(auditRecord)
      } catch (error) {
        this.logger.error({ error }, 'Failed to persist audit record to database')
      }
    }
  }

  /**
   * Log a warning event
   */
  logWarning(
    taskId: string,
    agentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'warning',
      reason,
      metadata,
    })
  }

  /**
   * Log a demotion event
   */
  logDemotion(
    taskId: string,
    agentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'demotion',
      reason,
      metadata,
    })
  }

  /**
   * Log a dismissal event
   */
  logDismissal(
    taskId: string,
    agentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'dismissal',
      reason,
      metadata,
    })
  }

  /**
   * Log a promotion event
   */
  logPromotion(
    taskId: string,
    agentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'promotion',
      reason,
      metadata,
    })
  }

  /**
   * Log a veto event
   */
  logVeto(
    taskId: string,
    agentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'veto',
      reason,
      metadata,
    })
  }

  /**
   * Log a decision event
   */
  logDecision(
    taskId: string,
    agentId: string,
    reason: string,
    metadata?: Record<string, unknown>
  ): void {
    this.logEvent({
      taskId,
      agentId,
      eventType: 'decision',
      reason,
      metadata,
    })
  }

  /**
   * Generate a unique ID for audit records
   */
  private generateId(): string {
    return `audit-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * Performance logger helper for tracking system metrics
 */
export class PerformanceLogger {
  constructor(private logger: pino.Logger) {}

  /**
   * Log heartbeat performance metrics
   */
  logHeartbeat(
    heartbeatNumber: number,
    metrics: {
      agentCount: number
      messageCount: number
      processingTimeMs: number
    }
  ): void {
    this.logger.info(
      {
        event: 'heartbeat',
        heartbeatNumber,
        ...metrics,
      },
      `Heartbeat #${heartbeatNumber}: ${metrics.agentCount} agents, ${metrics.messageCount} messages, ${metrics.processingTimeMs}ms`
    )
  }

  /**
   * Log agent performance metrics
   */
  logAgentMetrics(
    agentId: string,
    metrics: {
      tasksCompleted: number
      tasksFailed: number
      averageTaskDuration: number
      messagesProcessed: number
    }
  ): void {
    this.logger.info(
      {
        event: 'agent_metrics',
        agentId,
        ...metrics,
      },
      `Agent ${agentId}: ${metrics.tasksCompleted} completed, ${metrics.tasksFailed} failed`
    )
  }

  /**
   * Log database query performance
   */
  logQuery(query: string, durationMs: number): void {
    if (durationMs > 100) {
      this.logger.warn(
        {
          event: 'slow_query',
          query,
          durationMs,
        },
        `Slow query detected: ${durationMs}ms`
      )
    } else {
      this.logger.debug(
        {
          event: 'query',
          query,
          durationMs,
        },
        `Query executed: ${durationMs}ms`
      )
    }
  }

  /**
   * Log memory usage
   */
  logMemoryUsage(): void {
    const usage = process.memoryUsage()
    this.logger.info(
      {
        event: 'memory_usage',
        heapUsed: Math.round(usage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(usage.heapTotal / 1024 / 1024),
        external: Math.round(usage.external / 1024 / 1024),
        rss: Math.round(usage.rss / 1024 / 1024),
      },
      `Memory: ${Math.round(usage.heapUsed / 1024 / 1024)}MB / ${Math.round(usage.heapTotal / 1024 / 1024)}MB`
    )
  }
}
