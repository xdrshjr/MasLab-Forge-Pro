/**
 * Whiteboard Permission Checker
 *
 * Implements the permission model for whiteboard access control.
 * Different agent layers have different read/write permissions.
 */

import type { AgentLayer } from '../types/index.js'
import { WhiteboardType, type WhiteboardPath } from './types.js'

/**
 * Agent information needed for permission checking
 */
export interface AgentInfo {
  id: string
  layer: AgentLayer
  supervisor?: string
}

/**
 * Agent registry interface for looking up agent information
 */
export interface AgentRegistry {
  getAgent(agentId: string): AgentInfo | undefined
}

/**
 * Whiteboard permission checker
 * Enforces read/write/append permissions based on agent layer and ownership
 */
export class WhiteboardPermissionChecker {
  constructor(private agentRegistry: AgentRegistry) {}

  /**
   * Check if an agent can read a whiteboard
   *
   * Permission rules:
   * - Global: all agents can read
   * - Top layer: all agents can read
   * - Mid layer: top can read all, mid can read all, bottom can only read supervisor's
   * - Bottom layer: top and mid can read all, bottom can only read own
   */
  canRead(agentId: string, whiteboardPath: WhiteboardPath): boolean {
    const agent = this.agentRegistry.getAgent(agentId)
    if (!agent) {
      return false
    }

    const { type, ownerId } = whiteboardPath

    // Global whiteboard: all can read
    if (type === WhiteboardType.GLOBAL) {
      return true
    }

    // Top layer whiteboard: all can read
    if (type === WhiteboardType.TOP_LAYER) {
      return true
    }

    // Mid layer whiteboard
    if (type === WhiteboardType.MID_LAYER) {
      // Top agents can read all mid whiteboards
      if (agent.layer === 'top') {
        return true
      }

      // Mid agents can read all mid whiteboards
      if (agent.layer === 'mid') {
        return true
      }

      // Bottom agents can only read their supervisor's whiteboard
      if (agent.layer === 'bottom') {
        return agent.supervisor === ownerId
      }

      return false
    }

    // Bottom layer whiteboard
    if (type === WhiteboardType.BOTTOM_LAYER) {
      // Top and mid can read all bottom whiteboards
      if (agent.layer === 'top' || agent.layer === 'mid') {
        return true
      }

      // Bottom can only read own whiteboard
      if (agent.layer === 'bottom') {
        return agent.id === ownerId
      }

      return false
    }

    return false
  }

  /**
   * Check if an agent can write to a whiteboard
   *
   * Permission rules:
   * - Global: only top layer can write
   * - Top layer: only top agents can write
   * - Mid layer: only owner can write
   * - Bottom layer: only owner can write
   */
  canWrite(agentId: string, whiteboardPath: WhiteboardPath): boolean {
    const agent = this.agentRegistry.getAgent(agentId)
    if (!agent) {
      return false
    }

    const { type, ownerId } = whiteboardPath

    // Global whiteboard: only top layer can write
    if (type === WhiteboardType.GLOBAL) {
      return agent.layer === 'top'
    }

    // Top layer whiteboard: only top agents can write
    if (type === WhiteboardType.TOP_LAYER) {
      return agent.layer === 'top'
    }

    // Mid layer whiteboard: only owner can write
    if (type === WhiteboardType.MID_LAYER) {
      return agent.layer === 'mid' && agent.id === ownerId
    }

    // Bottom layer whiteboard: only owner can write
    if (type === WhiteboardType.BOTTOM_LAYER) {
      return agent.layer === 'bottom' && agent.id === ownerId
    }

    return false
  }

  /**
   * Check if an agent can append to a whiteboard
   *
   * Permission rules:
   * - Global: top and mid can append
   * - For others: same as canWrite
   */
  canAppend(agentId: string, whiteboardPath: WhiteboardPath): boolean {
    const agent = this.agentRegistry.getAgent(agentId)
    if (!agent) {
      return false
    }

    const { type } = whiteboardPath

    // Global whiteboard: top and mid can append
    if (type === WhiteboardType.GLOBAL) {
      return agent.layer === 'top' || agent.layer === 'mid'
    }

    // For other whiteboards, append permission is same as write
    return this.canWrite(agentId, whiteboardPath)
  }
}
