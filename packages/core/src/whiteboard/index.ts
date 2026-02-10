/**
 * Whiteboard System - Main Export
 *
 * Exports all whiteboard system components for use by other modules.
 */

export { WhiteboardSystem } from './system.js'
export { WhiteboardPermissionChecker } from './permissions.js'
export { FileLockManager } from './locks.js'
export { OptimisticLockManager } from './optimistic-lock.js'
export { WhiteboardTemplates } from './templates.js'
export { WhiteboardParser } from './parser.js'
export { WhiteboardRenderer } from './renderer.js'

// Export types
export type {
  WhiteboardConfig,
  WhiteboardPath,
  WhiteboardMetadata,
  FileLock,
  WhiteboardSection,
  WhiteboardAST,
  Milestone,
  Decision as WhiteboardDecision
} from './types.js'

// Export enum
export { WhiteboardType } from './types.js'

export type { AgentInfo, AgentRegistry } from './permissions.js'
export type { TemplateData } from './templates.js'
