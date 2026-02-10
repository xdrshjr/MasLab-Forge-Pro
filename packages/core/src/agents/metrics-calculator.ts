/**
 * Agent Metrics Calculator
 *
 * Calculates performance scores for agents based on various metrics
 * including success rate, responsiveness, and reliability.
 */

import type { AgentMetrics } from '../types/index.js'
import type { BaseAgent } from './base-agent.js'

/**
 * Performance score breakdown
 */
export interface PerformanceScoreBreakdown {
  successScore: number
  responsivenessScore: number
  reliabilityScore: number
  overallScore: number
}

/**
 * Calculates agent performance metrics
 */
export class AgentMetricsCalculator {
  /**
   * Calculate overall performance score (0-100)
   */
  calculatePerformanceScore(agent: BaseAgent): number {
    const metrics = agent.getMetrics()
    const breakdown = this.calculateScoreBreakdown(metrics)
    return breakdown.overallScore
  }

  /**
   * Calculate detailed score breakdown
   */
  calculateScoreBreakdown(metrics: AgentMetrics): PerformanceScoreBreakdown {
    // Success rate (40% weight)
    const successScore = this.calculateSuccessScore(metrics) * 40

    // Responsiveness (30% weight)
    const responsivenessScore = this.calculateResponsiveness(metrics) * 30

    // Reliability (30% weight)
    const reliabilityScore = this.calculateReliability(metrics) * 30

    const overallScore = successScore + responsivenessScore + reliabilityScore

    return {
      successScore,
      responsivenessScore,
      reliabilityScore,
      overallScore: Math.round(overallScore),
    }
  }

  /**
   * Calculate success score (0-1)
   */
  private calculateSuccessScore(metrics: AgentMetrics): number {
    const totalTasks = metrics.tasksCompleted + metrics.tasksFailed
    if (totalTasks === 0) {
      return 1 // No tasks yet, assume perfect score
    }

    const successRate = metrics.tasksCompleted / totalTasks
    return successRate
  }

  /**
   * Calculate responsiveness score (0-1)
   */
  private calculateResponsiveness(metrics: AgentMetrics): number {
    // Lower average task duration = higher score
    const maxTime = 60000 // 60 seconds baseline
    if (metrics.averageTaskDuration === 0) {
      return 1 // No tasks yet, assume perfect score
    }

    const score = 1 - Math.min(metrics.averageTaskDuration / maxTime, 1)
    return Math.max(score, 0)
  }

  /**
   * Calculate reliability score (0-1)
   */
  private calculateReliability(metrics: AgentMetrics): number {
    const totalHeartbeats = metrics.heartbeatsResponded + metrics.heartbeatsMissed
    if (totalHeartbeats === 0) {
      return 1 // No heartbeats yet, assume perfect score
    }

    const reliabilityRate = metrics.heartbeatsResponded / totalHeartbeats

    // Apply penalty for warnings
    const warningPenalty = Math.min(metrics.warningsReceived * 0.1, 0.5)

    return Math.max(reliabilityRate - warningPenalty, 0)
  }

  /**
   * Update agent performance score
   */
  updatePerformanceScore(agent: BaseAgent): void {
    const score = this.calculatePerformanceScore(agent)
    const metrics = agent.getMetrics()
    metrics.performanceScore = score
  }

  /**
   * Get performance rating based on score
   */
  getPerformanceRating(score: number): string {
    if (score >= 90) return 'Excellent'
    if (score >= 80) return 'Good'
    if (score >= 70) return 'Satisfactory'
    if (score >= 60) return 'Fair'
    if (score >= 40) return 'Poor'
    return 'Critical'
  }

  /**
   * Check if agent should be promoted
   */
  shouldPromote(metrics: AgentMetrics): boolean {
    return (
      metrics.performanceScore >= 80 &&
      metrics.tasksCompleted >= 10 &&
      metrics.warningsReceived === 0
    )
  }

  /**
   * Check if agent should be demoted
   */
  shouldDemote(metrics: AgentMetrics): boolean {
    return metrics.performanceScore < 60 || metrics.warningsReceived >= 2
  }

  /**
   * Check if agent should be dismissed
   */
  shouldDismiss(metrics: AgentMetrics): boolean {
    return metrics.performanceScore < 40 || metrics.warningsReceived >= 3
  }
}
