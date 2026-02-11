/**
 * Multi-Agent Governance Framework - Core Package
 *
 * This is the main entry point for the @magf/core package.
 * It exports all public APIs for building multi-agent systems with governance.
 */

// Type definitions
export * from './types/index.js'

// Persistence layer
export * from './persistence/index.js'

// Logging system
export * from './logging/index.js'

// Communication system
export * from './communication/index.js'

// Whiteboard system
export * from './whiteboard/index.js'

// Agent system
export * from './agents/index.js'

// Governance system
export * from './governance/index.js'

// Version information
export const VERSION = '0.1.0'

/**
 * Framework metadata
 */
export const FRAMEWORK_INFO = {
  name: 'Multi-Agent Governance Framework',
  version: VERSION,
  description: 'A framework for building governed multi-agent systems',
} as const
