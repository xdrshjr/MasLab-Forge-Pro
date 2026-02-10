/**
 * Agent State Machine
 *
 * Manages valid state transitions for agents and enforces
 * state transition rules to maintain system consistency.
 */

import { AgentStatus } from '../types/index.js'
import type { BaseAgent } from './base-agent.js'

/**
 * Defines allowed state transitions for agents
 */
export class AgentStateMachine {
  private allowedTransitions: Map<AgentStatus, AgentStatus[]>

  constructor() {
    this.allowedTransitions = new Map([
      [AgentStatus.INITIALIZING, [AgentStatus.IDLE, AgentStatus.FAILED]],
      [
        AgentStatus.IDLE,
        [AgentStatus.WORKING, AgentStatus.WAITING_APPROVAL, AgentStatus.SHUTTING_DOWN],
      ],
      [
        AgentStatus.WORKING,
        [AgentStatus.IDLE, AgentStatus.BLOCKED, AgentStatus.FAILED, AgentStatus.WAITING_APPROVAL],
      ],
      [AgentStatus.WAITING_APPROVAL, [AgentStatus.WORKING, AgentStatus.IDLE, AgentStatus.BLOCKED]],
      [AgentStatus.BLOCKED, [AgentStatus.WORKING, AgentStatus.FAILED]],
      [AgentStatus.FAILED, [AgentStatus.WORKING, AgentStatus.TERMINATED]],
      [AgentStatus.SHUTTING_DOWN, [AgentStatus.TERMINATED]],
      [AgentStatus.TERMINATED, []],
    ])
  }

  /**
   * Check if a state transition is valid
   */
  canTransition(from: AgentStatus, to: AgentStatus): boolean {
    const allowed = this.allowedTransitions.get(from)
    return allowed?.includes(to) ?? false
  }

  /**
   * Perform a state transition with validation
   */
  transition(agent: BaseAgent, to: AgentStatus, reason: string): void {
    const from = agent.getStatus()

    if (!this.canTransition(from, to)) {
      throw new Error(
        `Invalid state transition: ${from} -> ${to} for agent ${agent.getConfig().id}`
      )
    }

    console.log(`[${agent.getConfig().name}] State transition: ${from} -> ${to} (${reason})`)

    // Update agent status
    agent.setStatus(to)

    // Log state transition to database
    agent.logStateTransition(from, to, reason)

    // Trigger state change event
    agent.onStateChange(from, to)
  }

  /**
   * Get all allowed transitions from a given state
   */
  getAllowedTransitions(from: AgentStatus): AgentStatus[] {
    return this.allowedTransitions.get(from) ?? []
  }
}
