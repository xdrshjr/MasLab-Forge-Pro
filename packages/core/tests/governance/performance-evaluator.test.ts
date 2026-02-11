/**
 * Tests for PerformanceEvaluator
 */

import { describe, it, expect } from 'vitest'
import { PerformanceEvaluator } from '../../src/governance/performance-evaluator.js'
import type { AgentMetrics } from '../../src/types/index.js'

describe('PerformanceEvaluator', () => {
  const evaluator = new PerformanceEvaluator()

  describe('calculateScore', () => {
    it('should calculate perfect score for perfect metrics', () => {
      const metrics: AgentMetrics = {
        tasksCompleted: 10,
        tasksFailed: 0,
        averageTaskDuration: 0,
        messagesProcessed: 50,
        heartbeatsResponded: 100,
        heartbeatsMissed: 0,
        warningsReceived: 0,
        lastActiveTimestamp: Date.now(),
        performanceScore: 0,
      }

      const score = evaluator.calculateScore(metrics)

      expect(score.successRate).toBe(1)
      expect(score.overallScore).toBeGreaterThan(90)
    })

    it('should calculate low score for poor metrics', () => {
      const metrics: AgentMetrics = {
        tasksCompleted: 2,
        tasksFailed: 8,
        averageTaskDuration: 60000,
        messagesProcessed: 10,
        heartbeatsResponded: 50,
        heartbeatsMissed: 50,
        warningsReceived: 3,
        lastActiveTimestamp: Date.now(),
        performanceScore: 0,
      }

      const score = evaluator.calculateScore(metrics)

      expect(score.successRate).toBe(0.2)
      expect(score.overallScore).toBeLessThan(40)
    })

    it('should weight success rate at 40%', () => {
      const metrics: AgentMetrics = {
        tasksCompleted: 10,
        tasksFailed: 0,
        averageTaskDuration: 60000, // Poor responsiveness
        messagesProcessed: 50,
        heartbeatsResponded: 50,
        heartbeatsMissed: 50, // Poor reliability
        warningsReceived: 0,
        lastActiveTimestamp: Date.now(),
        performanceScore: 0,
      }

      const score = evaluator.calculateScore(metrics)

      // Success rate is 100%, contributing 40 points
      expect(score.successRate).toBe(1)
      // Overall should be around 40 + low responsiveness + low reliability
      expect(score.overallScore).toBeGreaterThan(40)
      expect(score.overallScore).toBeLessThan(60)
    })
  })
})
