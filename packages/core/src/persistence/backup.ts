/**
 * Database backup and restore utilities
 *
 * Provides functionality for backing up and restoring the SQLite database.
 */

import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync, unlinkSync } from 'fs'
import { join } from 'path'

/**
 * Backup configuration
 */
export interface BackupConfig {
  backupDir: string
  maxBackups?: number // Maximum number of backups to keep (default: 10)
  autoBackup?: boolean // Enable automatic backups (default: false)
  backupInterval?: number // Backup interval in milliseconds (default: 1 hour)
}

/**
 * Database backup manager
 */
export class DatabaseBackupManager {
  private config: BackupConfig
  private backupTimer?: NodeJS.Timeout

  constructor(config: BackupConfig) {
    this.config = {
      maxBackups: config.maxBackups ?? 10,
      autoBackup: config.autoBackup ?? false,
      backupInterval: config.backupInterval ?? 3600000, // 1 hour
      ...config,
    }

    // Create backup directory if it doesn't exist
    if (!existsSync(this.config.backupDir)) {
      mkdirSync(this.config.backupDir, { recursive: true })
    }
  }

  /**
   * Creates a backup of the database
   *
   * @param dbPath - Path to the database file
   * @returns Path to the backup file
   */
  backup(dbPath: string): string {
    if (!existsSync(dbPath)) {
      throw new Error(`Database file not found: ${dbPath}`)
    }

    const timestamp = new Date().toISOString().replace(/:/g, '-').replace(/\..+/, '')
    const backupFileName = `backup-${timestamp}.db`
    const backupPath = join(this.config.backupDir, backupFileName)

    // Copy database file
    copyFileSync(dbPath, backupPath)

    console.log(`Database backed up to ${backupPath}`)

    // Clean up old backups
    this.cleanupOldBackups()

    return backupPath
  }

  /**
   * Restores a database from a backup
   *
   * @param backupPath - Path to the backup file
   * @param targetPath - Path where to restore the database
   */
  restore(backupPath: string, targetPath: string): void {
    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupPath}`)
    }

    // Copy backup to target location
    copyFileSync(backupPath, targetPath)

    console.log(`Database restored from ${backupPath} to ${targetPath}`)
  }

  /**
   * Lists all available backups
   *
   * @returns Array of backup file information
   */
  listBackups(): Array<{ name: string; path: string; size: number; createdAt: Date }> {
    if (!existsSync(this.config.backupDir)) {
      return []
    }

    const files = readdirSync(this.config.backupDir)
      .filter((f) => f.startsWith('backup-') && f.endsWith('.db'))
      .map((f) => {
        const path = join(this.config.backupDir, f)
        const stats = statSync(path)
        return {
          name: f,
          path,
          size: stats.size,
          createdAt: stats.mtime,
        }
      })
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())

    return files
  }

  /**
   * Gets the most recent backup
   *
   * @returns Most recent backup info or undefined
   */
  getLatestBackup(): { name: string; path: string; size: number; createdAt: Date } | undefined {
    const backups = this.listBackups()
    return backups.length > 0 ? backups[0] : undefined
  }

  /**
   * Deletes a specific backup
   *
   * @param backupName - Name of the backup file
   */
  deleteBackup(backupName: string): void {
    const backupPath = join(this.config.backupDir, backupName)

    if (!existsSync(backupPath)) {
      throw new Error(`Backup file not found: ${backupName}`)
    }

    unlinkSync(backupPath)
    console.log(`Backup deleted: ${backupName}`)
  }

  /**
   * Cleans up old backups beyond the maximum count
   */
  private cleanupOldBackups(): void {
    const backups = this.listBackups()
    const maxBackups = this.config.maxBackups ?? 10

    if (backups.length > maxBackups) {
      const backupsToDelete = backups.slice(maxBackups)

      for (const backup of backupsToDelete) {
        unlinkSync(backup.path)
        console.log(`Old backup deleted: ${backup.name}`)
      }
    }
  }

  /**
   * Starts automatic backup timer
   *
   * @param dbPath - Path to the database file
   */
  startAutoBackup(dbPath: string): void {
    if (!this.config.autoBackup) {
      return
    }

    if (this.backupTimer) {
      console.warn('Auto backup already running')
      return
    }

    console.log(`Starting auto backup every ${this.config.backupInterval}ms`)

    this.backupTimer = setInterval(() => {
      try {
        this.backup(dbPath)
      } catch (error) {
        console.error('Auto backup failed:', error)
      }
    }, this.config.backupInterval)
  }

  /**
   * Stops automatic backup timer
   */
  stopAutoBackup(): void {
    if (this.backupTimer) {
      clearInterval(this.backupTimer)
      this.backupTimer = undefined
      console.log('Auto backup stopped')
    }
  }

  /**
   * Verifies a backup file integrity
   *
   * @param backupPath - Path to the backup file
   * @returns True if backup is valid
   */
  verifyBackup(backupPath: string): boolean {
    if (!existsSync(backupPath)) {
      return false
    }

    try {
      const stats = statSync(backupPath)
      // Basic check: file exists and has non-zero size
      return stats.size > 0
    } catch {
      return false
    }
  }
}
