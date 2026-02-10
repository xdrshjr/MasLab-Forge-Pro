/**
 * Backup manager tests
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { DatabaseBackupManager } from '../src/persistence/backup.js'
import { DatabaseManager } from '../src/persistence/database.js'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import { join } from 'path'

describe('DatabaseBackupManager', () => {
  const testBackupDir = './test-backups'
  const testDbPath = './test-db.db'
  let backupManager: DatabaseBackupManager
  let dbManager: DatabaseManager

  beforeEach(() => {
    // Create test database
    dbManager = new DatabaseManager({ path: testDbPath })
    dbManager.initialize()
    dbManager.close()

    // Create backup manager
    backupManager = new DatabaseBackupManager({
      backupDir: testBackupDir,
      maxBackups: 3,
    })
  })

  afterEach(() => {
    // Clean up
    if (existsSync(testBackupDir)) {
      rmSync(testBackupDir, { recursive: true, force: true })
    }
    if (existsSync(testDbPath)) {
      rmSync(testDbPath, { force: true })
    }
    // Clean up WAL files
    if (existsSync(testDbPath + '-wal')) {
      rmSync(testDbPath + '-wal', { force: true })
    }
    if (existsSync(testDbPath + '-shm')) {
      rmSync(testDbPath + '-shm', { force: true })
    }
  })

  it('should create backup directory', () => {
    expect(existsSync(testBackupDir)).toBe(true)
  })

  it('should create a backup', () => {
    const backupPath = backupManager.backup(testDbPath)

    expect(existsSync(backupPath)).toBe(true)
    expect(backupPath).toContain('backup-')
    expect(backupPath).toContain('.db')
  })

  it('should list backups', async () => {
    backupManager.backup(testDbPath)
    // Wait 10ms to ensure different timestamps
    await new Promise(resolve => setTimeout(resolve, 10))
    backupManager.backup(testDbPath)

    const backups = backupManager.listBackups()
    expect(backups.length).toBeGreaterThanOrEqual(2)
  })

  it('should get latest backup', () => {
    backupManager.backup(testDbPath)
    const latest = backupManager.getLatestBackup()

    expect(latest).toBeDefined()
    expect(latest?.name).toContain('backup-')
  })

  it('should restore from backup', () => {
    const backupPath = backupManager.backup(testDbPath)
    const restorePath = './test-restore.db'

    backupManager.restore(backupPath, restorePath)

    expect(existsSync(restorePath)).toBe(true)

    // Clean up
    if (existsSync(restorePath)) {
      rmSync(restorePath, { force: true })
    }
  })

  it('should cleanup old backups', () => {
    // Create more backups than maxBackups
    backupManager.backup(testDbPath)
    backupManager.backup(testDbPath)
    backupManager.backup(testDbPath)
    backupManager.backup(testDbPath)

    const backups = backupManager.listBackups()
    expect(backups.length).toBeLessThanOrEqual(3)
  })

  it('should verify backup integrity', () => {
    const backupPath = backupManager.backup(testDbPath)
    const isValid = backupManager.verifyBackup(backupPath)

    expect(isValid).toBe(true)
  })

  it('should return false for non-existent backup', () => {
    const isValid = backupManager.verifyBackup('./non-existent.db')
    expect(isValid).toBe(false)
  })

  it('should throw error when backing up non-existent database', () => {
    expect(() => {
      backupManager.backup('./non-existent.db')
    }).toThrow('Database file not found')
  })

  it('should throw error when restoring from non-existent backup', () => {
    expect(() => {
      backupManager.restore('./non-existent.db', './target.db')
    }).toThrow('Backup file not found')
  })
})
