/**
 * Whiteboard Parser
 *
 * Parses Markdown whiteboard content into structured data.
 * Extracts sections, milestones, and decisions from whiteboard files.
 */

import type {
  WhiteboardAST,
  WhiteboardSection,
  Milestone,
  Decision
} from './types.js'

/**
 * Whiteboard parser
 * Parses Markdown content into structured sections and extracts key information
 */
export class WhiteboardParser {
  /**
   * Parse Markdown content into AST
   *
   * @param markdown - Markdown content to parse
   * @returns Parsed whiteboard AST
   */
  parse(markdown: string): WhiteboardAST {
    const sections = this.buildSections(markdown)
    return { sections }
  }

  /**
   * Build sections from Markdown content
   * Splits content by headings and groups content under each heading
   *
   * @param markdown - Markdown content
   * @returns Array of sections
   */
  private buildSections(markdown: string): WhiteboardSection[] {
    const sections: WhiteboardSection[] = []
    const lines = markdown.split('\n')

    let currentSection: WhiteboardSection | null = null

    for (const line of lines) {
      // Match H1 and H2 headings only for main sections
      const headingMatch = line.match(/^(#{1,2})\s+(.+)$/)

      if (headingMatch && headingMatch[1] && headingMatch[2]) {
        // Save previous section
        if (currentSection) {
          sections.push(currentSection)
        }

        // Start new section
        const level = headingMatch[1].length
        const title = headingMatch[2].trim()

        currentSection = {
          title,
          level,
          content: ''
        }
      } else if (currentSection) {
        // Add line to current section content (including subsections)
        currentSection.content += line + '\n'
      }
    }

    // Add last section
    if (currentSection) {
      sections.push(currentSection)
    }

    return sections
  }

  /**
   * Extract milestones from whiteboard AST
   * Looks for checklist items in "Milestones" section
   *
   * @param ast - Parsed whiteboard AST
   * @returns Array of milestones
   */
  extractMilestones(ast: WhiteboardAST): Milestone[] {
    const milestonesSection = ast.sections.find(
      (s) =>
        s.title.toLowerCase().includes('milestone') ||
        s.title.toLowerCase().includes('里程碑')
    )

    if (!milestonesSection) {
      return []
    }

    const milestones: Milestone[] = []
    const lines = milestonesSection.content.split('\n')

    for (const line of lines) {
      // Match checklist items: - [ ] or - [x]
      const checkboxMatch = line.match(/^-\s+\[([ xX])\]\s+(.+)$/)
      if (checkboxMatch && checkboxMatch[1] && checkboxMatch[2]) {
        const completed = checkboxMatch[1].toLowerCase() === 'x'
        const description = checkboxMatch[2].trim()
        milestones.push({ description, completed })
      }
    }

    return milestones
  }

  /**
   * Extract decisions from whiteboard AST
   * Looks for decision entries in "Key Decisions" or "Decisions" section
   *
   * @param ast - Parsed whiteboard AST
   * @returns Array of decisions
   */
  extractDecisions(ast: WhiteboardAST): Decision[] {
    const decisionsSection = ast.sections.find(
      (s) =>
        s.title.toLowerCase().includes('decision') ||
        s.title.toLowerCase().includes('决策')
    )

    if (!decisionsSection) {
      return []
    }

    const decisions: Decision[] = []
    const content = decisionsSection.content

    // Split by subsections (### Decision #N)
    const lines = content.split('\n')
    let currentDecision: Partial<Decision> | null = null
    let currentId = ''

    for (const line of lines) {
      // Check for decision header
      const headerMatch = line.match(/###\s+Decision\s+#(\d+)/i)
      if (headerMatch && headerMatch[1]) {
        // Save previous decision
        if (currentDecision && currentDecision.description && currentId) {
          decisions.push({
            id: `decision-${currentId}`,
            description: currentDecision.description,
            proposer: currentDecision.proposer || 'unknown',
            signers: currentDecision.signers || [],
            status: currentDecision.status || 'pending'
          })
        }

        // Start new decision
        currentId = headerMatch[1]
        currentDecision = {}
        continue
      }

      // Extract fields from bullet points
      if (currentDecision) {
        const contentMatch = line.match(/^-\s+\*\*Content\*\*:\s*(.+)/i)
        const proposerMatch = line.match(/^-\s+\*\*Proposer\*\*:\s*(.+)/i)
        const signersMatch = line.match(/^-\s+\*\*Signers\*\*:\s*(.+)/i)
        const statusMatch = line.match(/^-\s+\*\*Status\*\*:\s*(.+)/i)

        if (contentMatch && contentMatch[1]) {
          currentDecision.description = contentMatch[1].trim()
        } else if (proposerMatch && proposerMatch[1]) {
          currentDecision.proposer = proposerMatch[1].trim()
        } else if (signersMatch && signersMatch[1]) {
          currentDecision.signers = signersMatch[1]
            .split(',')
            .map((s) => s.trim())
        } else if (statusMatch && statusMatch[1]) {
          currentDecision.status = this.parseDecisionStatus(
            statusMatch[1].trim()
          )
        }
      }
    }

    // Save last decision
    if (currentDecision && currentDecision.description && currentId) {
      decisions.push({
        id: `decision-${currentId}`,
        description: currentDecision.description,
        proposer: currentDecision.proposer || 'unknown',
        signers: currentDecision.signers || [],
        status: currentDecision.status || 'pending'
      })
    }

    return decisions
  }

  /**
   * Parse decision status string
   *
   * @param statusStr - Status string
   * @returns Normalized status
   */
  private parseDecisionStatus(
    statusStr: string
  ): 'pending' | 'approved' | 'rejected' {
    const lower = statusStr.toLowerCase()
    if (lower.includes('approved') || lower.includes('批准')) {
      return 'approved'
    } else if (lower.includes('rejected') || lower.includes('否决')) {
      return 'rejected'
    }
    return 'pending'
  }

  /**
   * Find section by title
   *
   * @param ast - Parsed whiteboard AST
   * @param title - Section title to search for (case-insensitive)
   * @returns Section or undefined if not found
   */
  findSection(ast: WhiteboardAST, title: string): WhiteboardSection | undefined {
    const lowerTitle = title.toLowerCase()
    return ast.sections.find((s) => s.title.toLowerCase().includes(lowerTitle))
  }

  /**
   * Get section content as plain text
   *
   * @param section - Section to extract text from
   * @returns Plain text content
   */
  getSectionText(section: WhiteboardSection): string {
    return section.content.trim()
  }
}
