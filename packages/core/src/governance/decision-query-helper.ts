/**
 * Decision Query Helper - Utilities for querying decisions
 *
 * Provides convenient methods for querying and filtering decisions.
 */

import type { Decision } from '../types/index.js'
import type { DecisionRepository } from '../persistence/repositories/decision-repository.js'

/**
 * Decision statistics
 */
export interface DecisionStats {
  total: number
  pending: number
  approved: number
  rejected: number
}

/**
 * Decision Query Helper class
 */
export class DecisionQueryHelper {
  constructor(
    private decisionRepo: DecisionRepository,
    private taskId: string
  ) {}

  /**
   * Gets pending decisions for a specific agent
   *
   * @param agentId - Agent ID
   * @returns Array of pending decisions requiring the agent's signature
   */
  getPendingDecisionsForAgent(agentId: string): Decision[] {
    const allPending = this.decisionRepo.getByStatus(this.taskId, 'pending')

    return allPending.filter(
      (d) =>
        d.requireSigners.includes(agentId) &&
        !d.signers.includes(agentId) &&
        !d.vetoers.includes(agentId)
    )
  }

  /**
   * Gets all decisions proposed by a specific agent
   *
   * @param proposerId - Proposer agent ID
   * @returns Array of decisions
   */
  getDecisionsByProposer(proposerId: string): Decision[] {
    const allDecisions = this.decisionRepo.getByTask(this.taskId)
    return allDecisions.filter((d) => d.proposerId === proposerId)
  }

  /**
   * Gets recent decisions
   *
   * @param limit - Maximum number of decisions to return
   * @returns Array of recent decisions
   */
  getRecentDecisions(limit: number = 10): Decision[] {
    const allDecisions = this.decisionRepo.getByTask(this.taskId)
    return allDecisions.slice(0, limit)
  }

  /**
   * Gets decision statistics
   *
   * @returns Decision statistics
   */
  getDecisionStats(): DecisionStats {
    const allDecisions = this.decisionRepo.getByTask(this.taskId)

    const stats: DecisionStats = {
      total: allDecisions.length,
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    for (const decision of allDecisions) {
      switch (decision.status) {
        case 'pending':
          stats.pending++
          break
        case 'approved':
          stats.approved++
          break
        case 'rejected':
          stats.rejected++
          break
      }
    }

    return stats
  }
}
