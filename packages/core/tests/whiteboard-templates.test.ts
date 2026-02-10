/**
 * Whiteboard Templates Tests
 *
 * Tests for template generation and filling.
 */

import { describe, it, expect } from 'vitest'
import { WhiteboardTemplates } from '../src/whiteboard/templates.js'

describe('WhiteboardTemplates', () => {
  describe('Template Retrieval', () => {
    it('should get global template', () => {
      const template = WhiteboardTemplates.getTemplate('global')
      expect(template).toContain('# Global Whiteboard')
      expect(template).toContain('## Task Overview')
      expect(template).toContain('## Core Objectives')
      expect(template).toContain('## Team Structure')
    })

    it('should get layer template', () => {
      const template = WhiteboardTemplates.getTemplate('layer')
      expect(template).toContain('## Basic Information')
      expect(template).toContain('## Current Tasks')
      expect(template).toContain('## Execution Log')
    })
  })

  describe('Template Filling', () => {
    it('should fill template with provided data', () => {
      const template = 'Hello {name}, you are {age} years old'
      const data = { name: 'Alice', age: 30 }

      const filled = WhiteboardTemplates.fillTemplate(template, data)
      expect(filled).toBe('Hello Alice, you are 30 years old')
    })

    it('should handle multiple occurrences of same placeholder', () => {
      const template = '{name} says hello. {name} is happy.'
      const data = { name: 'Bob' }

      const filled = WhiteboardTemplates.fillTemplate(template, data)
      expect(filled).toBe('Bob says hello. Bob is happy.')
    })

    it('should leave unfilled placeholders as-is', () => {
      const template = 'Hello {name}, you are {age} years old'
      const data = { name: 'Alice' }

      const filled = WhiteboardTemplates.fillTemplate(template, data)
      expect(filled).toContain('Alice')
      expect(filled).toContain('{age}')
    })

    it('should handle empty data', () => {
      const template = 'Hello {name}'
      const data = {}

      const filled = WhiteboardTemplates.fillTemplate(template, data)
      expect(filled).toBe('Hello {name}')
    })
  })

  describe('Global Whiteboard Creation', () => {
    it('should create global whiteboard with defaults', () => {
      const whiteboard = WhiteboardTemplates.createGlobalWhiteboard({})

      expect(whiteboard).toContain('# Global Whiteboard - Untitled Task')
      expect(whiteboard).toContain('**Task ID**: task-unknown')
      expect(whiteboard).toContain('**Mode**: auto')
    })

    it('should create global whiteboard with custom data', () => {
      const whiteboard = WhiteboardTemplates.createGlobalWhiteboard({
        taskName: 'Build TODO App',
        taskId: 'task-123',
        mode: 'semi-auto',
        status: 'running'
      })

      expect(whiteboard).toContain('# Global Whiteboard - Build TODO App')
      expect(whiteboard).toContain('**Task ID**: task-123')
      expect(whiteboard).toContain('**Mode**: semi-auto')
      expect(whiteboard).toContain('**Status**: running')
    })

    it('should include team structure placeholders', () => {
      const whiteboard = WhiteboardTemplates.createGlobalWhiteboard({
        topAgent1: 'Planner',
        role1: 'Strategic Planning',
        midAgent1: 'Architect',
        midRole1: 'Technical Architecture'
      })

      expect(whiteboard).toContain('- Planner: Strategic Planning')
      expect(whiteboard).toContain('- Architect: Technical Architecture')
    })
  })

  describe('Layer Whiteboard Creation', () => {
    it('should create layer whiteboard with defaults', () => {
      const whiteboard = WhiteboardTemplates.createLayerWhiteboard({})

      expect(whiteboard).toContain('# Layer - Agent')
      expect(whiteboard).toContain('**Agent ID**: agent-unknown')
      expect(whiteboard).toContain('**Role**: Undefined role')
    })

    it('should create layer whiteboard with custom data', () => {
      const whiteboard = WhiteboardTemplates.createLayerWhiteboard({
        layerName: 'Mid Layer',
        roleName: 'Frontend Lead',
        agentId: 'mid-frontend',
        role: 'Frontend Development',
        responsibilities: 'UI/UX implementation',
        supervisor: 'top-planner',
        subordinates: 'bot-1, bot-2'
      })

      expect(whiteboard).toContain('# Mid Layer - Frontend Lead')
      expect(whiteboard).toContain('**Agent ID**: mid-frontend')
      expect(whiteboard).toContain('**Role**: Frontend Development')
      expect(whiteboard).toContain('**Responsibilities**: UI/UX implementation')
      expect(whiteboard).toContain('**Supervisor**: top-planner')
      expect(whiteboard).toContain('**Subordinates**: bot-1, bot-2')
    })
  })

  describe('Template Constants', () => {
    it('should have global template constant', () => {
      expect(WhiteboardTemplates.GLOBAL_TEMPLATE).toBeDefined()
      expect(typeof WhiteboardTemplates.GLOBAL_TEMPLATE).toBe('string')
    })

    it('should have layer template constant', () => {
      expect(WhiteboardTemplates.LAYER_TEMPLATE).toBeDefined()
      expect(typeof WhiteboardTemplates.LAYER_TEMPLATE).toBe('string')
    })
  })
})
