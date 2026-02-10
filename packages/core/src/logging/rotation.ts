/**
 * Log rotation manager
 *
 * Handles automatic log file rotation to prevent disk space issues.
 */

import {
  statSync,
  renameSync,
  readdirSync,
  unlinkSync,
  createReadStream,
  createWriteStream,
} from 'fs'
import { createGzip } from 'zlib'
import { join } from 'path'

/**
 * Log rotation configuration
 */
export interface LogRotationConfig {
  maxFileSize: number // Maximum file size in bytes (default: 10MB)
  maxFiles: number // Maximum number of rotated files to keep (default: 7)
  compress: boolean // Whether to compress rotated files (default: true)
}

/**
 * Log rotation manager
 */
export class LogRotationManager {
  private config: LogRotationConfig

  constructor(config?: Partial<LogRotationConfig>) {
    this.config = {
      maxFileSize: config?.maxFileSize ?? 10 * 1024 * 1024, // 10MB
      maxFiles: config?.maxFiles ?? 7,
      compress: config?.compress ?? true,
    }
  }

  /**
   * Checks if a log file needs rotation and performs it
   *
   * @param logFile - Path to log file
   */
  checkAndRotate(logFile: string): void {
    try {
      const stats = statSync(logFile)

      if (stats.size > this.config.maxFileSize) {
        this.rotateFile(logFile)
      }
    } catch (error) {
      // File doesn't exist or can't be accessed, skip rotation
      return
    }
  }

  /**
   * Rotates a log file
   *
   * @param logFile - Path to log file
   */
  private rotateFile(logFile: string): void {
    const timestamp = Date.now()
    const rotatedFile = `${logFile}.${timestamp}`

    // Rename current log file
    renameSync(logFile, rotatedFile)

    console.log(`Log file rotated: ${logFile} -> ${rotatedFile}`)

    // Compress if enabled
    if (this.config.compress) {
      this.compressFile(rotatedFile)
    }

    // Clean up old logs
    this.cleanupOldLogs(logFile)
  }

  /**
   * Compresses a log file using gzip
   *
   * @param filePath - Path to file to compress
   */
  private compressFile(filePath: string): void {
    const gzip = createGzip()
    const source = createReadStream(filePath)
    const destination = createWriteStream(`${filePath}.gz`)

    source
      .pipe(gzip)
      .pipe(destination)
      .on('finish', () => {
        // Delete original file after compression
        unlinkSync(filePath)
        console.log(`Log file compressed: ${filePath}.gz`)
      })
      .on('error', (error) => {
        console.error(`Failed to compress log file: ${error.message}`)
      })
  }

  /**
   * Cleans up old rotated log files
   *
   * @param logFile - Base log file path
   */
  private cleanupOldLogs(logFile: string): void {
    const logDir = join(logFile, '..')
    const baseName = logFile.split('/').pop()
    if (!baseName) return

    try {
      const files = readdirSync(logDir)
        .filter((f) => f.startsWith(baseName) && f !== baseName)
        .map((f) => ({
          name: f,
          path: join(logDir, f),
          time: statSync(join(logDir, f)).mtime.getTime(),
        }))
        .sort((a, b) => b.time - a.time) // Sort by time, newest first

      // Delete files beyond max count
      if (files.length > this.config.maxFiles) {
        const filesToDelete = files.slice(this.config.maxFiles)
        for (const file of filesToDelete) {
          unlinkSync(file.path)
          console.log(`Old log file deleted: ${file.name}`)
        }
      }
    } catch (error) {
      console.error(`Failed to cleanup old logs: ${(error as Error).message}`)
    }
  }

  /**
   * Rotates all log files in a directory
   *
   * @param logDir - Directory containing log files
   */
  rotateAllInDirectory(logDir: string): void {
    try {
      const files = readdirSync(logDir)
        .filter((f) => f.endsWith('.log'))
        .map((f) => join(logDir, f))

      for (const file of files) {
        this.checkAndRotate(file)
      }
    } catch (error) {
      console.error(`Failed to rotate logs in directory: ${(error as Error).message}`)
    }
  }
}
