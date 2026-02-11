/**
 * Requirement Manager
 *
 * Conducts multi-round Q&A to clarify task requirements before
 * generating the agent team structure.
 */

import type { ExecutionMode } from '../types/index.js'
import type { TaskContext } from './types.js'

/**
 * Configuration for requirement clarification
 */
export interface RequirementManagerConfig {
  maxRounds: number
  questionsPerRound: number
}

/**
 * Manages task requirement clarification through Q&A
 */
export class RequirementManager {
  private maxRounds: number
  private questionsPerRound: number

  constructor(config: RequirementManagerConfig = { maxRounds: 3, questionsPerRound: 10 }) {
    this.maxRounds = config.maxRounds
    this.questionsPerRound = config.questionsPerRound
  }

  /**
   * Clarify task requirements through multi-round Q&A
   */
  clarify(taskDescription: string, mode: ExecutionMode): TaskContext {
    const taskContext: TaskContext = {
      id: this.generateUUID(),
      description: taskDescription,
      type: this.inferTaskType(taskDescription),
      requirements: [],
      constraints: {},
      clarificationHistory: [],
      mode,
    }

    // Multi-round Q&A
    for (let round = 0; round < this.maxRounds; round++) {
      const questions = this.generateQuestions(taskContext, round)

      let answers: string[]
      if (mode === 'semi-auto') {
        // Interactive mode: ask user
        answers = this.askUser(questions)
      } else {
        // Auto mode: generate reasonable answers
        answers = this.autoGenerateAnswers(questions, taskContext)
      }

      // Record Q&A
      for (let i = 0; i < questions.length; i++) {
        const question = questions[i]
        const answer = answers[i]
        if (question && answer) {
          taskContext.clarificationHistory.push({
            question,
            answer,
          })
        }
      }

      // Extract requirements
      const newRequirements = this.extractRequirements(questions, answers)
      taskContext.requirements.push(...newRequirements)
    }

    return taskContext
  }

  /**
   * Infer task type from description
   */
  private inferTaskType(description: string): string {
    // Simple keyword-based classification for now
    // In production, this would use LLM
    const lowerDesc = description.toLowerCase()

    if (
      lowerDesc.includes('build') ||
      lowerDesc.includes('create') ||
      lowerDesc.includes('implement') ||
      lowerDesc.includes('develop')
    ) {
      return 'development'
    }

    if (
      lowerDesc.includes('research') ||
      lowerDesc.includes('analyze') ||
      lowerDesc.includes('study')
    ) {
      return 'research'
    }

    if (lowerDesc.includes('test') || lowerDesc.includes('qa') || lowerDesc.includes('validate')) {
      return 'testing'
    }

    if (
      lowerDesc.includes('setup') ||
      lowerDesc.includes('configure') ||
      lowerDesc.includes('deploy')
    ) {
      return 'infrastructure'
    }

    if (
      lowerDesc.includes('document') ||
      lowerDesc.includes('write docs') ||
      lowerDesc.includes('guide')
    ) {
      return 'documentation'
    }

    return 'development' // Default
  }

  /**
   * Generate clarifying questions for a round
   */
  private generateQuestions(_taskContext: TaskContext, round: number): string[] {
    // In production, this would use LLM to generate contextual questions
    // For now, return template questions based on task type and round

    const questions: string[] = []

    if (round === 0) {
      // First round: basic requirements
      questions.push('What is the primary goal of this task?')
      questions.push('What are the key deliverables?')
      questions.push('Are there any specific technologies or frameworks to use?')
      questions.push('What is the expected timeline?')
      questions.push('Are there any constraints or limitations?')
      questions.push('Who is the target audience or user?')
      questions.push('What defines success for this task?')
      questions.push('Are there any dependencies on other systems?')
      questions.push('What is the priority level?')
      questions.push('Are there any security or compliance requirements?')
    } else if (round === 1) {
      // Second round: technical details
      questions.push('What is the expected scale or performance requirement?')
      questions.push('Should this integrate with existing systems?')
      questions.push('What error handling approach should be used?')
      questions.push('Are there any specific coding standards to follow?')
      questions.push('What testing strategy should be employed?')
      questions.push('Should documentation be included?')
      questions.push('What is the deployment strategy?')
      questions.push('Are there any monitoring or logging requirements?')
      questions.push('What is the maintenance plan?')
      questions.push('Are there any accessibility requirements?')
    } else {
      // Third round: refinement
      questions.push('Are there any edge cases to consider?')
      questions.push('What is the fallback strategy if something fails?')
      questions.push('Should there be any configuration options?')
      questions.push('What is the upgrade/migration path?')
      questions.push('Are there any internationalization needs?')
      questions.push('What analytics or metrics should be tracked?')
      questions.push('Are there any legal or licensing considerations?')
      questions.push('What is the support model?')
      questions.push('Are there any training or onboarding needs?')
      questions.push('What is the long-term vision for this?')
    }

    return questions.slice(0, this.questionsPerRound)
  }

  /**
   * Ask user for answers (interactive mode)
   */
  private askUser(questions: string[]): string[] {
    // In production, this would integrate with TUI or CLI for user input
    // For now, return placeholder answers
    console.log('\n=== Requirement Clarification ===')
    console.log('Please answer the following questions:\n')

    const answers: string[] = []
    for (const question of questions) {
      console.log(`Q: ${question}`)
      // In real implementation, would await user input
      answers.push('User would provide answer here')
    }

    return answers
  }

  /**
   * Auto-generate reasonable answers (auto mode)
   */
  private autoGenerateAnswers(questions: string[], taskContext: TaskContext): string[] {
    // In production, this would use LLM to generate contextual answers
    // For now, return reasonable default answers based on task type

    const answers: string[] = []

    for (const question of questions) {
      if (question.includes('goal') || question.includes('deliverable')) {
        answers.push(
          `Complete the ${taskContext.type} task as described: ${taskContext.description}`
        )
      } else if (question.includes('timeline')) {
        answers.push('Complete within reasonable timeframe, no strict deadline')
      } else if (question.includes('technology') || question.includes('framework')) {
        answers.push('Use modern best practices and standard tools')
      } else if (question.includes('constraint') || question.includes('limitation')) {
        answers.push('No specific constraints, follow general best practices')
      } else if (question.includes('success')) {
        answers.push('Task is completed correctly with good quality')
      } else if (question.includes('testing')) {
        answers.push('Include basic testing where appropriate')
      } else if (question.includes('documentation')) {
        answers.push('Include inline comments and basic documentation')
      } else {
        answers.push('Use reasonable defaults and best practices')
      }
    }

    return answers
  }

  /**
   * Extract concrete requirements from Q&A pairs
   */
  private extractRequirements(questions: string[], answers: string[]): string[] {
    // In production, this would use LLM to extract structured requirements
    // For now, combine questions and answers into requirement statements

    const requirements: string[] = []

    for (let i = 0; i < questions.length; i++) {
      const question = questions[i]
      const answer = answers[i]

      // Skip if question or answer is undefined
      if (!question || !answer) {
        continue
      }

      // Skip generic or empty answers
      if (
        answer.includes('reasonable') ||
        answer.includes('best practices') ||
        answer.includes('would provide')
      ) {
        continue
      }

      // Create requirement statement
      const requirement = `${question.replace('?', '')}: ${answer}`
      requirements.push(requirement)
    }

    return requirements
  }

  /**
   * Generate UUID for task ID
   */
  private generateUUID(): string {
    return `task-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
  }
}
