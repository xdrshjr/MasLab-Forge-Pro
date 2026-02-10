/**
 * Whiteboard Parser Tests
 *
 * Tests for Markdown parsing and data extraction.
 */

import { describe, it, expect } from 'vitest'
import { WhiteboardParser } from '../src/whiteboard/parser.js'

describe('WhiteboardParser', () => {
  const parser = new WhiteboardParser()

  describe('Section Parsing', () => {
    it('should parse markdown into sections', () => {
      const markdown = `# Section 1
Content 1

## Section 1.1
Content 1.1

# Section 2
Content 2`

      const ast = parser.parse(markdown)

      expect(ast.sections).toHaveLength(3)
      expect(ast.sections[0].title).toBe('Section 1')
      expect(ast.sections[0].level).toBe(1)
      expect(ast.sections[1].title).toBe('Section 1.1')
      expect(ast.sections[1].level).toBe(2)
      expect(ast.sections[2].title).toBe('Section 2')
      expect(ast.sections[2].level).toBe(1)
    })

    it('should handle empty content', () => {
      const markdown = ''
      const ast = parser.parse(markdown)
      expect(ast.sections).toHaveLength(0)
    })

    it('should handle content without headings', () => {
      const markdown = 'Just some text\nwithout headings'
      const ast = parser.parse(markdown)
      expect(ast.sections).toHaveLength(0)
    })
  })

  describe('Milestone Extraction', () => {
    it('should extract milestones from checklist', () => {
      const markdown = `# Milestones
- [x] Milestone 1
- [ ] Milestone 2
- [X] Milestone 3`

      const ast = parser.parse(markdown)
      const milestones = parser.extractMilestones(ast)

      expect(milestones).toHaveLength(3)
      expect(milestones[0].description).toBe('Milestone 1')
      expect(milestones[0].completed).toBe(true)
      expect(milestones[1].description).toBe('Milestone 2')
      expect(milestones[1].completed).toBe(false)
      expect(milestones[2].completed).toBe(true)
    })

    it('should return empty array if no milestones section', () => {
      const markdown = `# Other Section
Content here`

      const ast = parser.parse(markdown)
      const milestones = parser.extractMilestones(ast)

      expect(milestones).toHaveLength(0)
    })

    it('should handle Chinese milestone section', () => {
      const markdown = `# 里程碑
- [x] 完成任务1
- [ ] 完成任务2`

      const ast = parser.parse(markdown)
      const milestones = parser.extractMilestones(ast)

      expect(milestones).toHaveLength(2)
    })
  })

  describe('Decision Extraction', () => {
    it('should extract decisions from decision section', () => {
      const markdown = `# Key Decisions

### Decision #1
- **Content**: Implement feature X
- **Proposer**: agent-1
- **Signers**: agent-2, agent-3
- **Status**: Approved

### Decision #2
- **Content**: Refactor module Y
- **Proposer**: agent-2
- **Status**: Pending`

      const ast = parser.parse(markdown)
      const decisions = parser.extractDecisions(ast)

      expect(decisions).toHaveLength(2)
      expect(decisions[0].id).toBe('decision-1')
      expect(decisions[0].description).toBe('Implement feature X')
      expect(decisions[0].proposer).toBe('agent-1')
      expect(decisions[0].signers).toEqual(['agent-2', 'agent-3'])
      expect(decisions[0].status).toBe('approved')
    })

    it('should return empty array if no decisions section', () => {
      const markdown = `# Other Section
Content here`

      const ast = parser.parse(markdown)
      const decisions = parser.extractDecisions(ast)

      expect(decisions).toHaveLength(0)
    })
  })

  describe('Section Finding', () => {
    it('should find section by title', () => {
      const markdown = `# Task Overview
Content 1

## Milestones
Content 2`

      const ast = parser.parse(markdown)
      const section = parser.findSection(ast, 'milestones')

      expect(section).toBeDefined()
      expect(section?.title).toBe('Milestones')
    })

    it('should return undefined for non-existent section', () => {
      const markdown = `# Task Overview
Content`

      const ast = parser.parse(markdown)
      const section = parser.findSection(ast, 'nonexistent')

      expect(section).toBeUndefined()
    })

    it('should be case-insensitive', () => {
      const markdown = `# Task Overview
Content`

      const ast = parser.parse(markdown)
      const section = parser.findSection(ast, 'TASK OVERVIEW')

      expect(section).toBeDefined()
    })
  })

  describe('Section Text Extraction', () => {
    it('should extract plain text from section', () => {
      const markdown = `# Section
Line 1
Line 2
Line 3`

      const ast = parser.parse(markdown)
      const text = parser.getSectionText(ast.sections[0])

      expect(text).toContain('Line 1')
      expect(text).toContain('Line 2')
      expect(text).toContain('Line 3')
    })
  })
})
