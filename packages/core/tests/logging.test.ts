/**
 * Logging system tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { LoggerFactory, AuditLogger, PerformanceLogger } from '../src/logging/logger.js'
import { LogRotationManager } from '../src/logging/rotation.js'
import { existsSync, mkdirSync, rmSync, writeFileSync, statSync } from 'fs'
import { join } from 'path'

describe('LoggerFactory', () => {
  const testWorkspace = './test-workspace'
  let loggerFactory: LoggerFactory

  beforeEach(() => {
    // Create test workspace
    if (!existsSync(testWorkspace)) {
      mkdirSync(testWorkspace, { recursive: true })
    }

    loggerFactory = new LoggerFactory({
      workspacePath: testWorkspace,
      level: 'info',
      enableConsole: false,
      enableFile: true,
    })
  })

  afterEach(() => {
    loggerFactory.closeAll()
    // Clean up test workspace
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true })
    }
  })

  it('should create logs directory', () => {
    const logDir = loggerFactory.getLogDir()
    expect(existsSync(logDir)).toBe(true)
  })

  it('should create category-specific logger', () => {
    const logger = loggerFactory.createLogger('message-bus')
    expect(logger).toBeDefined()
    expect(logger.level).toBe('info')
  })

  it('should return cached logger on subsequent calls', () => {
    const logger1 = loggerFactory.createLogger('message-bus')
    const logger2 = loggerFactory.createLogger('message-bus')
    expect(logger1).toBe(logger2)
  })

  it('should create different loggers for different categories', () => {
    const logger1 = loggerFactory.createLogger('message-bus')
    const logger2 = loggerFactory.createLogger('audit')
    expect(logger1).not.toBe(logger2)
  })

  it('should write logs to file', async () => {
    const logger = loggerFactory.createLogger('test')
    logger.info('Test message')

    // Flush and wait for file write
    logger.flush()
    await new Promise(resolve => setTimeout(resolve, 100))

    const logFile = join(loggerFactory.getLogDir(), 'test.log')
    // File should exist (though content might be buffered)
    expect(existsSync(logFile)).toBe(true)
  })
})

describe('AuditLogger', () => {
  const testWorkspace = './test-workspace'
  let loggerFactory: LoggerFactory
  let auditLogger: AuditLogger

  beforeEach(() => {
    if (!existsSync(testWorkspace)) {
      mkdirSync(testWorkspace, { recursive: true })
    }

    loggerFactory = new LoggerFactory({
      workspacePath: testWorkspace,
      level: 'info',
      enableConsole: false,
      enableFile: true,
    })

    auditLogger = new AuditLogger(loggerFactory)
  })

  afterEach(() => {
    loggerFactory.closeAll()
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true })
    }
  })

  it('should log audit events', () => {
    expect(() => {
      auditLogger.logEvent({
        taskId: 'task-1',
        agentId: 'agent-1',
        eventType: 'warning',
        reason: 'Test warning',
      })
    }).not.toThrow()
  })

  it('should log warning events', () => {
    expect(() => {
      auditLogger.logWarning('agent-1', 'Test warning', 'task-1')
    }).not.toThrow()
  })

  it('should log dismissal events', () => {
    expect(() => {
      auditLogger.logDismissal('agent-1', 'Poor performance', 'task-1')
    }).not.toThrow()
  })

  it('should log promotion events', () => {
    expect(() => {
      auditLogger.logPromotion('agent-1', 'Excellent performance', 'task-1')
    }).not.toThrow()
  })

  it('should log decision events', () => {
    expect(() => {
      auditLogger.logDecision('decision-1', 'agent-1', 'approved', 'task-1')
    }).not.toThrow()
  })
})

describe('PerformanceLogger', () => {
  const testWorkspace = './test-workspace'
  let loggerFactory: LoggerFactory
  let perfLogger: PerformanceLogger

  beforeEach(() => {
    if (!existsSync(testWorkspace)) {
      mkdirSync(testWorkspace, { recursive: true })
    }

    loggerFactory = new LoggerFactory({
      workspacePath: testWorkspace,
      level: 'info',
      enableConsole: false,
      enableFile: true,
    })

    perfLogger = new PerformanceLogger(loggerFactory)
  })

  afterEach(() => {
    loggerFactory.closeAll()
    if (existsSync(testWorkspace)) {
      rmSync(testWorkspace, { recursive: true, force: true })
    }
  })

  it('should log performance metrics', () => {
    expect(() => {
      perfLogger.logMetric({
        name: 'test_metric',
        value: 42,
        unit: 'ms',
      })
    }).not.toThrow()
  })

  it('should log heartbeat metrics', () => {
    expect(() => {
      perfLogger.logHeartbeat(1, 150, 10)
    }).not.toThrow()
  })

  it('should log message bus throughput', () => {
    expect(() => {
      perfLogger.logMessageBusThroughput(1000, 50)
    }).not.toThrow()
  })

  it('should log database query performance', () => {
    expect(() => {
      perfLogger.logDatabaseQuery('SELECT * FROM tasks', 25)
    }).not.toThrow()
  })
})

describe('LogRotationManager', () => {
  const testLogDir = './test-logs'
  const testLogFile = join(testLogDir, 'test.log')
  let rotationManager: LogRotationManager

  beforeEach(() => {
    if (!existsSync(testLogDir)) {
      mkdirSync(testLogDir, { recursive: true })
    }

    rotationManager = new LogRotationManager({
      maxFileSize: 1024, // 1KB for testing
      maxFiles: 3,
      compress: false, // Disable compression for faster tests
    })
  })

  afterEach(() => {
    if (existsSync(testLogDir)) {
      rmSync(testLogDir, { recursive: true, force: true })
    }
  })

  it('should not rotate small files', () => {
    // Create a small log file
    writeFileSync(testLogFile, 'Small log content')

    rotationManager.checkAndRotate(testLogFile)

    // Original file should still exist
    expect(existsSync(testLogFile)).toBe(true)
  })

  it('should rotate large files', () => {
    // Create a large log file (> 1KB)
    const largeContent = 'x'.repeat(2000)
    writeFileSync(testLogFile, largeContent)

    rotationManager.checkAndRotate(testLogFile)

    // Original file should be rotated (renamed)
    const files = require('fs').readdirSync(testLogDir)
    const rotatedFiles = files.filter((f: string) => f.startsWith('test.log.'))

    expect(rotatedFiles.length).toBeGreaterThan(0)
  })

  it('should handle non-existent files gracefully', () => {
    expect(() => {
      rotationManager.checkAndRotate('./non-existent.log')
    }).not.toThrow()
  })
})
