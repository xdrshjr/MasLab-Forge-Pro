/**
 * Configuration Module
 *
 * Handles loading and saving configuration files.
 */

import fs from 'node:fs'
import path from 'node:path'
import type { AgentTeamConfig } from '@magf/core'

/**
 * Default configuration
 */
const DEFAULT_CONFIG: AgentTeamConfig = {
  mode: 'auto',
  heartbeatInterval: 4000,
  maxBottomAgents: 5,
  databasePath: './.agent-workspace/task.db',
  workspacePath: './.agent-workspace',
  projectRoot: '.',
  llmModel: 'claude-3-5-sonnet',
  governance: {
    signatureThreshold: 0.67,
    electionInterval: 50,
    warningThreshold: 3,
  },
}

/**
 * Load configuration from file
 *
 * @param configPath - Path to config file
 * @returns Configuration object
 */
export function loadConfig(configPath = './.magf.config.json'): AgentTeamConfig {
  if (!fs.existsSync(configPath)) {
    return DEFAULT_CONFIG
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8')
    const userConfig = JSON.parse(content) as Partial<AgentTeamConfig>
    return { ...DEFAULT_CONFIG, ...userConfig }
  } catch (error) {
    console.error(`Failed to load config from ${configPath}:`, error)
    return DEFAULT_CONFIG
  }
}

/**
 * Save configuration to file
 *
 * @param config - Configuration object
 * @param configPath - Path to config file
 */
export function saveConfig(config: AgentTeamConfig, configPath = './.magf.config.json'): void {
  try {
    const dir = path.dirname(configPath)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
  } catch (error) {
    console.error(`Failed to save config to ${configPath}:`, error)
  }
}

/**
 * Get config value by key
 *
 * @param key - Config key (supports dot notation)
 * @param configPath - Path to config file
 * @returns Config value
 */
export function getConfigValue(key: string, configPath = './.magf.config.json'): unknown {
  const config = loadConfig(configPath)
  const keys = key.split('.')
  let value: unknown = config

  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = (value as Record<string, unknown>)[k]
    } else {
      return undefined
    }
  }

  return value
}

/**
 * Set config value by key
 *
 * @param key - Config key (supports dot notation)
 * @param value - Config value
 * @param configPath - Path to config file
 */
export function setConfigValue(
  key: string,
  value: unknown,
  configPath = './.magf.config.json'
): void {
  const config = loadConfig(configPath)
  const keys = key.split('.')

  if (keys.length === 0) {
    throw new Error('Invalid config key')
  }

  let target: Record<string, unknown> = config as Record<string, unknown>

  for (let i = 0; i < keys.length - 1; i++) {
    const k = keys[i]
    if (!k) continue

    if (!(k in target) || typeof target[k] !== 'object') {
      target[k] = {}
    }
    target = target[k] as Record<string, unknown>
  }

  const lastKey = keys[keys.length - 1]
  if (lastKey) {
    target[lastKey] = value
  }

  saveConfig(config, configPath)
}
