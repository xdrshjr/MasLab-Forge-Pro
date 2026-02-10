/**
 * Unit tests for core type definitions
 *
 * These tests verify that the type system is working correctly
 * and that basic type guards and utilities function as expected.
 */

import { describe, it, expect } from 'vitest'
import { AgentStatus, MessageType, MessagePriority, VERSION, FRAMEWORK_INFO } from '../src/index'

describe('Core Types', () => {
  describe('AgentStatus', () => {
    it('should have all expected status values', () => {
      expect(AgentStatus.INITIALIZING).toBe('initializing')
      expect(AgentStatus.IDLE).toBe('idle')
      expect(AgentStatus.WORKING).toBe('working')
      expect(AgentStatus.FAILED).toBe('failed')
      expect(AgentStatus.TERMINATED).toBe('terminated')
    })
  })

  describe('MessageType', () => {
    it('should have task-related message types', () => {
      expect(MessageType.TASK_ASSIGN).toBe('task_assign')
      expect(MessageType.TASK_COMPLETE).toBe('task_complete')
      expect(MessageType.TASK_FAIL).toBe('task_fail')
    })

    it('should have governance-related message types', () => {
      expect(MessageType.SIGNATURE_REQUEST).toBe('signature_request')
      expect(MessageType.SIGNATURE_APPROVE).toBe('signature_approve')
      expect(MessageType.SIGNATURE_VETO).toBe('signature_veto')
    })
  })

  describe('MessagePriority', () => {
    it('should have numeric priority values in ascending order', () => {
      expect(MessagePriority.LOW).toBe(0)
      expect(MessagePriority.NORMAL).toBe(1)
      expect(MessagePriority.HIGH).toBe(2)
      expect(MessagePriority.URGENT).toBe(3)
    })
  })
})

describe('Framework Metadata', () => {
  it('should export version information', () => {
    expect(VERSION).toBe('0.1.0')
  })

  it('should export framework info', () => {
    expect(FRAMEWORK_INFO.name).toBe('Multi-Agent Governance Framework')
    expect(FRAMEWORK_INFO.version).toBe('0.1.0')
    expect(FRAMEWORK_INFO.description).toBeTruthy()
  })
})
