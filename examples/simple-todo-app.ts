/**
 * Simple TODO App Example
 *
 * Demonstrates basic usage of the AgentTeam SDK to create a TODO application.
 */

import { AgentTeam } from '@magf/core'

async function main() {
  // Create agent team with configuration
  const team = new AgentTeam({
    mode: 'auto',
    maxBottomAgents: 5,
    heartbeatInterval: 4000,
  })

  // Listen to events
  team.on('heartbeat', (...args: unknown[]) => {
    const n = args[0] as number
    if (n % 10 === 0) {
      console.log(`Heartbeat #${n}`)
    }
  })

  team.on('agent:created', (...args: unknown[]) => {
    const agent = args[0] as any
    console.log(`Agent created: ${agent.config.name}`)
  })

  team.on('decision:approved', (...args: unknown[]) => {
    const decisionId = args[0] as string
    console.log(`Decision ${decisionId} approved`)
  })

  team.on('log', (...args: unknown[]) => {
    const message = args[0] as string
    console.log(`[LOG] ${message}`)
  })

  // Start task
  console.log('Starting TODO app creation task...')

  try {
    const result = await team.start(`
      Create a simple TODO application with the following features:
      - Add new TODOs
      - Mark TODOs as complete
      - Delete TODOs
      - List all TODOs

      Use Express.js for the backend and SQLite for storage.
      Include basic error handling and input validation.
    `)

    console.log('\n=== Task Completed ===')
    console.log(`Success: ${result.success}`)
    console.log(`Duration: ${result.duration}ms`)
    console.log(`Metrics:`, result.metrics)

    if (result.error) {
      console.error(`Error: ${result.error}`)
    }
  } catch (error) {
    console.error('Task failed:', error)
    process.exit(1)
  }
}

main().catch(console.error)
