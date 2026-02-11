/**
 * Performance Evaluator - Calculates agent performance scores
 *
 * Evaluates agents based on:
 * - Success rate (40%): tasks completed vs failed
 * - Responsiveness (30%): average task duration
 * - Reliability (30%): heartbeat response rate
 */

import type { AgentMetrics, PerformanceScore } from '../types/index.js'

/**
 * Performance Evaluator class
 */
export class PerformanceEvaluator {
  /**
   * Calculates performance score for an agent
   *
   * @param metrics - Agent performance metrics
   * @returns Performance score breakdown
   */
  calculateScore(metrics: AgentMetrics): PerformanceScore {
    // Success rate (40%)
    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed
    const successRate = totalTasks > 0 ? metrics.tasksCompleted / totalTasks : 1
    const successScore = successRate * 40

    // Responsiveness (30%)
    const responsiveness = this.calculateResponsiveness(metrics)
    const responsivenessScore = responsiveness * 30

    // Reliability (30%)
    const totalHeartbeats = metrics.heartbeatsResponded + metrics.heartbeatsMissed
    const reliability = totalHeartbeats > 0 ? metrics.heartbeatsResponded / totalHeartbeats : 1
    const reliabilityScore = reliability * 30

    const overallScore = successScore + responsivenessScore + reliabilityScore

    return {
      agentId: '', // Will be set by caller
      tasksCompleted: metrics.tasksCompleted,
      tasksFailed: metrics.tasksFailed,
      successRate,
      averageResponseTime: metrics.averageTaskDuration,
      collaborationScore: this.calculateCollaborationScore(metrics),
      overallScore,
    }
  }

  /**
   * Calculates responsiveness score (0-1)
   *
   * @param metrics - Agent metrics
   * @returns Responsiveness score
   */
  private calculateResponsiveness(metrics: AgentMetrics): number {
    const maxTime = 60000 // 60 seconds
    const score = 1 - Math.min(metrics.averageTaskDuration / maxTime, 1)
    return Math.max(score, 0)
  }

  /**
   * Calculates collaboration score (0-1)
   *
   * @param _metrics - Agent metrics (unused in current implementation)
   * @returns Collaboration score
   */
  private calculateCollaborationScore(_metrics: AgentMetrics): number {
    // Based on message processing rate
    // Simplified version returns 0.8
    // TODO: Implement based on peer interactions, message response rate
    return 0.8
  }
}
