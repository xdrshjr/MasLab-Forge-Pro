/**
 * Type definitions for pi-mono ecosystem packages
 *
 * These are placeholder types for the planned integration with:
 * - @mariozechner/pi-agent-core
 * - @mariozechner/pi-ai
 * - @mariozechner/pi-coding-agent
 *
 * Note: These packages are not yet available. This file provides
 * type definitions for future integration.
 */

// ===== @mariozechner/pi-agent-core =====

export interface PiAgentCoreConfig {
  model: string
  temperature?: number
  systemPrompt?: string
}

export interface ExecuteParams {
  task: string
  context?: Record<string, unknown>
}

export interface ExecuteResult {
  success: boolean
  output: unknown
  error?: string
}

export interface PiAgentCore {
  execute(params: ExecuteParams): Promise<ExecuteResult>
}

// ===== @mariozechner/pi-ai =====

export interface PiAIConfig {
  model: string
  apiKey?: string
  temperature?: number
}

export interface PiAI {
  call(prompt: string): Promise<string>
}

// ===== @mariozechner/pi-coding-agent =====

export interface PiCodingAgentConfig {
  model: string
  tools: string[]
}

export interface CodingTaskParams {
  task: string
  context?: Record<string, unknown>
  tools?: string[]
}

export interface GeneratedFile {
  path: string
  content: string
}

export interface CodingResult {
  success: boolean
  output: string
  files?: GeneratedFile[]
  error?: string
}

export interface PiCodingAgent {
  execute(params: CodingTaskParams): Promise<CodingResult>
}
