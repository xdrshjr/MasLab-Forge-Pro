/**
 * Team Management Module
 *
 * Exports all team management components for dynamic role generation
 * and team lifecycle management.
 */

// Type definitions
export * from './types.js'

// Core components
export { RequirementManager } from './requirement-manager.js'
export type { RequirementManagerConfig } from './requirement-manager.js'

export { RoleGenerator } from './role-generator.js'

export { TeamValidator } from './team-validator.js'

export { TeamManager } from './team-manager.js'
export type { TeamManagerConfig } from './team-manager.js'

export { TaskLifecycleManager } from './task-lifecycle-manager.js'
export type { TaskLifecycleManagerConfig } from './task-lifecycle-manager.js'

export { TeamVisualizer } from './team-visualizer.js'
