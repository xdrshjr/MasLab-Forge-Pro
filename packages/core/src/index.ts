/**
 * Multi-Agent Governance Framework - Core Package
 *
 * This is the main entry point for the @magf/core package.
 * It exports all public APIs, types, and utilities for building
 * multi-agent systems with governance mechanisms.
 *
 * @packageDocumentation
 */

// Export all type definitions
export * from './types/index.js'

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
