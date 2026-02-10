/**
 * Whiteboard Templates
 *
 * Provides Markdown templates for different whiteboard types.
 * Templates include placeholders that can be filled with task-specific data.
 */

/**
 * Template data for filling placeholders
 */
export interface TemplateData {
  [key: string]: string | number | boolean
}

/**
 * Whiteboard templates
 * Provides pre-defined Markdown structures for each whiteboard type
 */
export class WhiteboardTemplates {
  /**
   * Global whiteboard template
   * Used for task overview, objectives, team structure, and milestones
   */
  static readonly GLOBAL_TEMPLATE = `# Global Whiteboard - {taskName}

## Task Overview
- **Task ID**: {taskId}
- **Created**: {timestamp}
- **Mode**: {mode}
- **Status**: {status}

## Core Objectives
1. {objective1}
2. {objective2}

## Key Decisions

## Milestones
- [ ] Milestone 1
- [ ] Milestone 2

## Team Structure

### Top Layer (3)
- {topAgent1}: {role1}
- {topAgent2}: {role2}
- {topAgent3}: {role3}

### Mid Layer
- {midAgent1}: {midRole1}

### Bottom Layer
- {botAgent1}: {botTask1}

## Issues & Risks

## Update Log
`

  /**
   * Layer-specific whiteboard template
   * Used for top, mid, and bottom layer agent whiteboards
   */
  static readonly LAYER_TEMPLATE = `# {layerName} - {roleName}

## Basic Information
- **Agent ID**: {agentId}
- **Role**: {role}
- **Responsibilities**: {responsibilities}
- **Supervisor**: {supervisor}
- **Subordinates**: {subordinates}

## Current Tasks

## Decisions & Negotiations

## Knowledge Base

## Execution Log
`

  /**
   * Fill template with provided data
   * Replaces {placeholder} patterns with actual values
   *
   * @param template - Template string with placeholders
   * @param data - Data to fill into placeholders
   * @returns Filled template string
   */
  static fillTemplate(template: string, data: TemplateData): string {
    let result = template

    for (const [key, value] of Object.entries(data)) {
      const placeholder = `{${key}}`
      result = result.replace(new RegExp(placeholder, 'g'), String(value))
    }

    return result
  }

  /**
   * Get template for a specific whiteboard type
   *
   * @param type - Whiteboard type
   * @returns Template string
   */
  static getTemplate(type: 'global' | 'layer'): string {
    switch (type) {
      case 'global':
        return this.GLOBAL_TEMPLATE
      case 'layer':
        return this.LAYER_TEMPLATE
      default:
        return '# Whiteboard\n\n'
    }
  }

  /**
   * Create a filled global whiteboard
   *
   * @param data - Task and team data
   * @returns Filled global whiteboard content
   */
  static createGlobalWhiteboard(data: TemplateData): string {
    const defaults: TemplateData = {
      taskName: 'Untitled Task',
      taskId: 'task-unknown',
      timestamp: new Date().toISOString(),
      mode: 'auto',
      status: 'pending',
      objective1: 'Define objectives',
      objective2: 'Complete task successfully',
      topAgent1: 'Top Agent 1',
      role1: 'Role 1',
      topAgent2: 'Top Agent 2',
      role2: 'Role 2',
      topAgent3: 'Top Agent 3',
      role3: 'Role 3',
      midAgent1: 'Mid Agent 1',
      midRole1: 'Mid Role 1',
      botAgent1: 'Bot Agent 1',
      botTask1: 'Task 1',
      ...data
    }

    return this.fillTemplate(this.GLOBAL_TEMPLATE, defaults)
  }

  /**
   * Create a filled layer whiteboard
   *
   * @param data - Agent data
   * @returns Filled layer whiteboard content
   */
  static createLayerWhiteboard(data: TemplateData): string {
    const defaults: TemplateData = {
      layerName: 'Layer',
      roleName: 'Agent',
      agentId: 'agent-unknown',
      role: 'Undefined role',
      responsibilities: 'To be defined',
      supervisor: 'None',
      subordinates: 'None',
      ...data
    }

    return this.fillTemplate(this.LAYER_TEMPLATE, defaults)
  }
}
