/**
 * Tests for RequestResponseHelper
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestResponseHelper } from '../../src/communication/request-response.js'
import { MessageType } from '../../src/types/index.js'
import type { Message } from '../../src/types/index.js'

describe('RequestResponseHelper', () => {
  let helper: RequestResponseHelper
  let sentMessages: Message[]

  beforeEach(() => {
    helper = new RequestResponseHelper()
    sentMessages = []
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  const mockSendMessage = (message: Message) => {
    sentMessages.push(message)
  }

  describe('sendRequest', () => {
    it('should send a request message with embedded requestId', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        5000
      )

      expect(sentMessages).toHaveLength(1)
      expect(sentMessages[0].from).toBe('agent-1')
      expect(sentMessages[0].to).toBe('agent-2')
      expect(sentMessages[0].type).toBe(MessageType.SIGNATURE_REQUEST)
      expect(sentMessages[0].content).toHaveProperty('requestId')
      expect(sentMessages[0].content).toHaveProperty('data', 'test')

      // Cleanup
      vi.runAllTimers()
      await expect(requestPromise).rejects.toThrow()
    })

    it('should resolve when response is received', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        5000
      )

      const requestId = (sentMessages[0].content as any).requestId

      // Simulate response
      const response: Message = {
        id: 'msg-2',
        taskId: 'task-1',
        from: 'agent-2',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { requestId, result: 'approved' },
        timestamp: Date.now(),
      }

      helper.handleResponse(response)

      const result = await requestPromise
      expect(result).toEqual({ requestId, result: 'approved' })
    })

    it('should reject on timeout', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        1000
      )

      vi.advanceTimersByTime(1001)

      await expect(requestPromise).rejects.toThrow(
        'Request timeout: agent-2 did not respond within 1000ms'
      )
    })

    it('should use default timeout of 10000ms', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' }
      )

      vi.advanceTimersByTime(9999)
      expect(helper.getPendingCount()).toBe(1)

      vi.advanceTimersByTime(2)
      await expect(requestPromise).rejects.toThrow('Request timeout')
    })

    it('should handle multiple concurrent requests', async () => {
      const request1 = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req1' },
        5000
      )

      const request2 = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-3',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req2' },
        5000
      )

      expect(sentMessages).toHaveLength(2)
      expect(helper.getPendingCount()).toBe(2)

      const requestId1 = (sentMessages[0].content as any).requestId
      const requestId2 = (sentMessages[1].content as any).requestId

      // Respond to second request first
      helper.handleResponse({
        id: 'msg-2',
        taskId: 'task-1',
        from: 'agent-3',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { requestId: requestId2, result: 'req2-response' },
        timestamp: Date.now(),
      })

      const result2 = await request2
      expect(result2).toEqual({ requestId: requestId2, result: 'req2-response' })
      expect(helper.getPendingCount()).toBe(1)

      // Respond to first request
      helper.handleResponse({
        id: 'msg-3',
        taskId: 'task-1',
        from: 'agent-2',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { requestId: requestId1, result: 'req1-response' },
        timestamp: Date.now(),
      })

      const result1 = await request1
      expect(result1).toEqual({ requestId: requestId1, result: 'req1-response' })
      expect(helper.getPendingCount()).toBe(0)
    })
  })

  describe('handleResponse', () => {
    it('should ignore response without requestId', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response: Message = {
        id: 'msg-1',
        taskId: 'task-1',
        from: 'agent-2',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { result: 'approved' },
        timestamp: Date.now(),
      }

      helper.handleResponse(response)

      expect(consoleWarnSpy).toHaveBeenCalledWith('Received response without requestId')
      consoleWarnSpy.mockRestore()
    })

    it('should ignore response for unknown request', () => {
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const response: Message = {
        id: 'msg-1',
        taskId: 'task-1',
        from: 'agent-2',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { requestId: 'unknown-request-id', result: 'approved' },
        timestamp: Date.now(),
      }

      helper.handleResponse(response)

      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Received response for unknown request: unknown-request-id'
      )
      consoleWarnSpy.mockRestore()
    })

    it('should clear timeout when handling response', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        5000
      )

      const requestId = (sentMessages[0].content as any).requestId

      // Respond immediately
      helper.handleResponse({
        id: 'msg-2',
        taskId: 'task-1',
        from: 'agent-2',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { requestId, result: 'approved' },
        timestamp: Date.now(),
      })

      await requestPromise

      // Advance time past timeout - should not reject
      vi.advanceTimersByTime(6000)
      expect(helper.getPendingCount()).toBe(0)
    })
  })

  describe('cancelRequest', () => {
    it('should cancel a pending request', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        5000
      )

      const requestId = (sentMessages[0].content as any).requestId

      helper.cancelRequest(requestId)

      await expect(requestPromise).rejects.toThrow('Request cancelled')
      expect(helper.getPendingCount()).toBe(0)
    })

    it('should handle cancelling non-existent request', () => {
      expect(() => helper.cancelRequest('non-existent-id')).not.toThrow()
    })

    it('should clear timeout when cancelling', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        5000
      )

      const requestId = (sentMessages[0].content as any).requestId

      helper.cancelRequest(requestId)

      await expect(requestPromise).rejects.toThrow('Request cancelled')

      // Advance time - should not cause additional errors
      vi.advanceTimersByTime(6000)
    })
  })

  describe('cancelAllRequests', () => {
    it('should cancel all pending requests', async () => {
      const request1 = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req1' },
        5000
      )

      const request2 = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-3',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req2' },
        5000
      )

      const request3 = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-4',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req3' },
        5000
      )

      expect(helper.getPendingCount()).toBe(3)

      helper.cancelAllRequests()

      await expect(request1).rejects.toThrow('All requests cancelled')
      await expect(request2).rejects.toThrow('All requests cancelled')
      await expect(request3).rejects.toThrow('All requests cancelled')

      expect(helper.getPendingCount()).toBe(0)
    })

    it('should handle cancelling when no requests pending', () => {
      expect(() => helper.cancelAllRequests()).not.toThrow()
      expect(helper.getPendingCount()).toBe(0)
    })
  })

  describe('getPendingCount', () => {
    it('should return 0 initially', () => {
      expect(helper.getPendingCount()).toBe(0)
    })

    it('should return correct count of pending requests', () => {
      helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req1' },
        5000
      )

      expect(helper.getPendingCount()).toBe(1)

      helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-3',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'req2' },
        5000
      )

      expect(helper.getPendingCount()).toBe(2)
    })

    it('should decrement when request completes', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        5000
      )

      expect(helper.getPendingCount()).toBe(1)

      const requestId = (sentMessages[0].content as any).requestId

      helper.handleResponse({
        id: 'msg-2',
        taskId: 'task-1',
        from: 'agent-2',
        to: 'agent-1',
        type: MessageType.SIGNATURE_APPROVE,
        content: { requestId, result: 'approved' },
        timestamp: Date.now(),
      })

      await requestPromise

      expect(helper.getPendingCount()).toBe(0)
    })

    it('should decrement when request times out', async () => {
      const requestPromise = helper.sendRequest(
        mockSendMessage,
        'agent-1',
        'agent-2',
        'task-1',
        MessageType.SIGNATURE_REQUEST,
        { data: 'test' },
        1000
      )

      expect(helper.getPendingCount()).toBe(1)

      vi.advanceTimersByTime(1001)

      await expect(requestPromise).rejects.toThrow()

      expect(helper.getPendingCount()).toBe(0)
    })
  })
})
