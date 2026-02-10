/**
 * Whiteboard Renderer
 *
 * Renders whiteboard content for terminal display.
 * Provides formatted output with syntax highlighting for TUI.
 */

import { WhiteboardParser } from './parser.js'

/**
 * ANSI color codes for terminal output
 */
const colors = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  gray: '\x1b[90m',
  yellow: '\x1b[33m'
}

/**
 * Whiteboard renderer
 * Formats whiteboard content for terminal display
 */
export class WhiteboardRenderer {
  private parser: WhiteboardParser

  constructor() {
    this.parser = new WhiteboardParser()
  }

  /**
   * Render whiteboard for TUI display
   * Formats Markdown with colors and truncates if needed
   *
   * @param markdown - Markdown content to render
   * @param maxLines - Maximum number of lines to display (0 = unlimited)
   * @returns Formatted string for terminal display
   */
  renderForTUI(markdown: string, maxLines: number = 20): string {
    const ast = this.parser.parse(markdown)
    let output = ''
    let lineCount = 0

    for (const section of ast.sections) {
      if (maxLines > 0 && lineCount >= maxLines) {
        output += colors.gray + '\n... (truncated) ...\n' + colors.reset
        break
      }

      // Render section title
      const indent = '  '.repeat(section.level - 1)
      output +=
        colors.bold +
        colors.cyan +
        `\n${indent}${section.title}\n` +
        colors.reset
      lineCount++

      // Render section content
      const contentLines = this.renderContent(section.content)
      const lines = contentLines.split('\n')

      for (const line of lines) {
        if (maxLines > 0 && lineCount >= maxLines) {
          break
        }
        output += line + '\n'
        lineCount++
      }
    }

    return output
  }

  /**
   * Render section content with formatting
   *
   * @param content - Section content
   * @returns Formatted content
   */
  private renderContent(content: string): string {
    const lines = content.split('\n')
    let output = ''

    for (const line of lines) {
      // Checklist items
      const checkboxMatch = line.match(/^(\s*)-\s+\[([ xX])\]\s+(.+)$/)
      if (checkboxMatch && checkboxMatch[1] !== undefined && checkboxMatch[2] && checkboxMatch[3]) {
        const indent = checkboxMatch[1]
        const checked = checkboxMatch[2].toLowerCase() === 'x'
        const text = checkboxMatch[3]
        const checkbox = checked
          ? colors.green + '✓' + colors.reset
          : colors.gray + '☐' + colors.reset
        output += `${indent}  ${checkbox} ${text}\n`
        continue
      }

      // List items
      if (line.match(/^\s*[-*]\s+/)) {
        output += colors.yellow + line + colors.reset + '\n'
        continue
      }

      // Bold text
      let formattedLine = line.replace(
        /\*\*(.+?)\*\*/g,
        colors.bold + '$1' + colors.reset
      )

      // Code blocks (inline)
      formattedLine = formattedLine.replace(
        /`(.+?)`/g,
        colors.gray + '$1' + colors.reset
      )

      output += formattedLine + '\n'
    }

    return output
  }

  /**
   * Render whiteboard as plain text (no colors)
   *
   * @param markdown - Markdown content
   * @returns Plain text output
   */
  renderPlainText(markdown: string): string {
    return markdown
  }

  /**
   * Render summary of whiteboard
   * Shows only section titles and key metrics
   *
   * @param markdown - Markdown content
   * @returns Summary string
   */
  renderSummary(markdown: string): string {
    const ast = this.parser.parse(markdown)
    let output = colors.bold + 'Whiteboard Summary:\n' + colors.reset

    for (const section of ast.sections) {
      const indent = '  '.repeat(section.level - 1)
      output += `${indent}- ${section.title}\n`
    }

    // Add metrics
    const milestones = this.parser.extractMilestones(ast)
    const completedMilestones = milestones.filter((m) => m?.completed).length

    if (milestones.length > 0) {
      output +=
        colors.cyan +
        `\nMilestones: ${completedMilestones}/${milestones.length} completed\n` +
        colors.reset
    }

    return output
  }
}
