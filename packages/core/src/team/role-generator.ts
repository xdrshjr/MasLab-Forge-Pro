/**
 * Role Generator
 *
 * Generates dynamic agent roles for each layer based on task context.
 * Uses LLM-powered generation to create task-appropriate team structures.
 */

import type { AgentLayer } from '../types/index.js'
import type { TaskContext, RoleDefinition } from './types.js'

/**
 * Generates dynamic roles for agent teams
 */
export class RoleGenerator {
  /**
   * Generate three top-layer roles following three-powers separation
   */
  generateTopLayerRoles(_taskContext: TaskContext): RoleDefinition[] {
    // In production, this would use LLM to generate contextual roles
    // For now, generate standard three-powers structure

    const roles: RoleDefinition[] = [
      {
        name: 'Strategic Planner',
        layer: 'top' as AgentLayer,
        responsibilities: [
          'Define overall task strategy and approach',
          'Break down high-level requirements into actionable plans',
          'Review and approve technical proposals',
          'Monitor overall progress and quality',
          'Make final decisions on architectural choices',
        ],
        capabilities: ['plan', 'reflect', 'coordinate', 'delegate', 'arbitrate'],
        signatureAuthority: ['technical_proposal', 'resource_adjustment', 'milestone_confirmation'],
      },
      {
        name: 'Execution Coordinator',
        layer: 'top' as AgentLayer,
        responsibilities: [
          'Coordinate execution across mid-layer teams',
          'Ensure timely delivery of milestones',
          'Manage resource allocation and team structure',
          'Handle escalations and blockers',
          'Facilitate communication between teams',
        ],
        capabilities: ['plan', 'reflect', 'coordinate', 'delegate', 'arbitrate'],
        signatureAuthority: ['task_allocation', 'resource_adjustment', 'milestone_confirmation'],
      },
      {
        name: 'Quality Guardian',
        layer: 'top' as AgentLayer,
        responsibilities: [
          'Review all deliverables for quality standards',
          'Ensure best practices are followed',
          'Veto decisions that compromise quality',
          'Conduct final acceptance testing',
          'Maintain documentation standards',
        ],
        capabilities: ['plan', 'reflect', 'review', 'coordinate', 'arbitrate'],
        signatureAuthority: ['technical_proposal', 'milestone_confirmation'],
      },
    ]

    return roles
  }

  /**
   * Generate mid-layer roles through top-layer negotiation
   */
  generateMidLayerRoles(
    taskContext: TaskContext,
    _topLayerRoles: RoleDefinition[]
  ): RoleDefinition[] {
    // In production, top-layer agents would propose and negotiate
    // For now, generate based on task type

    const roles: RoleDefinition[] = []

    // Determine domains based on task type
    const domains = this.determineDomains(taskContext)

    for (const domain of domains) {
      roles.push({
        name: `${domain} Lead`,
        layer: 'mid' as AgentLayer,
        responsibilities: [
          `Lead ${domain} development and implementation`,
          `Break down ${domain} tasks for bottom-layer agents`,
          `Monitor ${domain} progress and quality`,
          `Coordinate with other domain leads`,
          `Report status to top layer`,
        ],
        capabilities: ['plan', 'execute', 'reflect', 'coordinate', 'delegate'],
        domain: domain.toLowerCase(),
      })
    }

    // Validate count (2-5 roles)
    if (roles.length < 2) {
      // Add a general implementation lead
      roles.push({
        name: 'Implementation Lead',
        layer: 'mid' as AgentLayer,
        responsibilities: [
          'Lead general implementation tasks',
          'Coordinate with specialized leads',
          'Handle cross-cutting concerns',
          'Monitor overall implementation progress',
          'Report to top layer',
        ],
        capabilities: ['plan', 'execute', 'reflect', 'coordinate', 'delegate'],
        domain: 'general',
      })
    }

    if (roles.length > 5) {
      // Trim to 5 most important
      return roles.slice(0, 5)
    }

    return roles
  }

  /**
   * Generate bottom-layer roles for each mid-layer lead
   */
  generateBottomLayerRoles(midLayerRoles: RoleDefinition[]): RoleDefinition[] {
    const bottomRoles: RoleDefinition[] = []

    for (const midRole of midLayerRoles) {
      // Estimate required agents based on domain
      const agentCount = this.estimateRequiredAgents(midRole)
      const limitedCount = Math.min(agentCount, 5) // Max 5 per mid-layer

      for (let i = 0; i < limitedCount; i++) {
        bottomRoles.push({
          name: `${midRole.domain}-Agent-${i + 1}`,
          layer: 'bottom' as AgentLayer,
          responsibilities: [
            `Execute tasks assigned by ${midRole.name}`,
            'Report progress and results',
          ],
          capabilities: ['execute', 'tool_call', 'code_gen', 'test_exec'],
          tools: this.determineTools(midRole.domain),
        })
      }
    }

    // Validate total count (max 50)
    if (bottomRoles.length > 50) {
      throw new Error(`Bottom layer exceeds 50 agents limit (${bottomRoles.length})`)
    }

    return bottomRoles
  }

  /**
   * Determine domains based on task context
   */
  private determineDomains(taskContext: TaskContext): string[] {
    const domains: string[] = []

    switch (taskContext.type) {
      case 'development':
        domains.push('Backend', 'Frontend', 'Testing')
        break
      case 'research':
        domains.push('Data Collection', 'Analysis')
        break
      case 'infrastructure':
        domains.push('Configuration', 'Deployment')
        break
      case 'testing':
        domains.push('Unit Testing', 'Integration Testing')
        break
      case 'documentation':
        domains.push('Technical Writing', 'Review')
        break
      default:
        domains.push('Implementation', 'Testing')
    }

    return domains
  }

  /**
   * Estimate required agents for a domain
   */
  private estimateRequiredAgents(midRole: RoleDefinition): number {
    const complexityMap: Record<string, number> = {
      frontend: 3,
      backend: 4,
      testing: 2,
      infrastructure: 2,
      documentation: 1,
      'data collection': 2,
      analysis: 3,
      configuration: 2,
      deployment: 2,
      'unit testing': 2,
      'integration testing': 2,
      'technical writing': 2,
      review: 1,
      implementation: 3,
      general: 2,
    }

    const domain = midRole.domain?.toLowerCase() || 'general'
    return complexityMap[domain] || 2
  }

  /**
   * Determine tools for a domain
   */
  private determineTools(domain?: string): string[] {
    const toolMap: Record<string, string[]> = {
      frontend: ['file_read', 'file_write', 'bash', 'http_request'],
      backend: ['file_read', 'file_write', 'bash', 'database_query'],
      testing: ['file_read', 'bash', 'http_request'],
      infrastructure: ['bash', 'file_read', 'file_write'],
      'data collection': ['http_request', 'file_read', 'file_write'],
      analysis: ['file_read', 'file_write'],
      configuration: ['file_read', 'file_write', 'bash'],
      deployment: ['bash', 'file_read'],
      'unit testing': ['file_read', 'bash'],
      'integration testing': ['file_read', 'bash', 'http_request'],
      'technical writing': ['file_read', 'file_write'],
      review: ['file_read'],
      implementation: ['file_read', 'file_write', 'bash'],
      general: ['file_read', 'file_write', 'bash'],
    }

    const domainKey = domain?.toLowerCase() || 'general'
    return toolMap[domainKey] || ['file_read', 'file_write', 'bash']
  }
}
