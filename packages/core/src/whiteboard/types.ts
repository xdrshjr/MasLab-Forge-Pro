/**
 * Whiteboard System Types
 *
 * Defines all type definitions for the whiteboard system including
 * whiteboard types, metadata, configuration, and path structures.
 */

/**
 * Whiteboard type enumeration
 * Defines the four types of whiteboards in the system
 */
export enum WhiteboardType {
  GLOBAL = 'global',
  TOP_LAYER = 'top',
  MID_LAYER = 'mid',
  BOTTOM_LAYER = 'bottom'
}

/**
 * Whiteboard configuration
 */
export interface WhiteboardConfig {
  /** Path to the workspace directory */
  workspacePath: string
  /** Enable version history tracking */
  enableVersioning: boolean
  /** Cache timeout in milliseconds */
  cacheTimeout: number
}

/**
 * Whiteboard metadata
 * Tracks version and modification information
 */
export interface WhiteboardMetadata {
  /** Full file path */
  path: string
  /** Whiteboard type */
  type: WhiteboardType
  /** Owner agent ID (for layer-specific whiteboards) */
  ownerId?: string
  /** Version number for optimistic locking */
  version: number
  /** Agent ID who last modified */
  lastModifiedBy: string
  /** Timestamp of last modification */
  lastModifiedAt: number
}

/**
 * Whiteboard path identifier
 * Used for permission checking and file resolution
 */
export interface WhiteboardPath {
  /** Whiteboard type */
  type: WhiteboardType
  /** Owner agent ID (required for mid/bottom layer) */
  ownerId?: string
}

/**
 * File lock information
 */
export interface FileLock {
  /** Unique lock identifier */
  lockId: string
  /** Path to the locked whiteboard */
  whiteboardPath: string
  /** Agent ID holding the lock */
  agentId: string
  /** Timestamp when lock was acquired */
  acquiredAt: number
  /** Timestamp when lock expires */
  expiresAt: number
}

/**
 * Whiteboard section structure (parsed from Markdown)
 */
export interface WhiteboardSection {
  /** Section title */
  title: string
  /** Heading level (1-6) */
  level: number
  /** Section content tokens */
  content: string
}

/**
 * Parsed whiteboard AST
 */
export interface WhiteboardAST {
  /** All sections in the whiteboard */
  sections: WhiteboardSection[]
}

/**
 * Milestone extracted from whiteboard
 */
export interface Milestone {
  /** Milestone description */
  description: string
  /** Completion status */
  completed: boolean
}

/**
 * Decision extracted from whiteboard
 */
export interface Decision {
  /** Decision ID */
  id: string
  /** Decision description */
  description: string
  /** Proposer agent ID */
  proposer: string
  /** Signers who approved */
  signers: string[]
  /** Decision status */
  status: 'pending' | 'approved' | 'rejected'
}
