/**
 * TUI Main App Component
 *
 * Main terminal user interface component that displays the two-panel layout.
 */

import React, { useState, useEffect } from 'react'
import { Box, Text, useInput } from 'ink'
import type { TUIProps, LogEntry } from './types.js'
import type { SDKTeamStatus } from '@magf/core'
import { AgentStatus } from './components/AgentStatus.js'
import { ExecutionLog } from './components/ExecutionLog.js'

/**
 * Main TUI App component
 */
export function App({ team }: TUIProps): React.ReactElement {
  const [status, setStatus] = useState<SDKTeamStatus | null>(null)
  const [logs, setLogs] = useState<LogEntry[]>([])
  const [error, setError] = useState<string | null>(null)

  // Update status every second
  useEffect(() => {
    const interval = setInterval(() => {
      try {
        const newStatus = team.getStatus()
        setStatus(newStatus)
      } catch (err) {
        // No active task yet or task completed
        if (err instanceof Error) {
          setError(err.message)
        }
      }
    }, 1000)

    return () => clearInterval(interval)
  }, [team])

  // Listen to log events
  useEffect(() => {
    const logHandler = (...args: unknown[]) => {
      const message = args[0] as string
      const entry: LogEntry = {
        timestamp: new Date().toLocaleTimeString(),
        message,
        level: 'info',
      }
      setLogs((prev) => [...prev.slice(-99), entry]) // Keep last 100 logs
    }

    team.on('log', logHandler)
    team.on('agent:created', (...args: unknown[]) => {
      const agent = args[0] as any
      logHandler(`Agent created: ${agent.config.name}`)
    })
    team.on('heartbeat', (...args: unknown[]) => {
      const n = args[0] as number
      logHandler(`Heartbeat #${n}`)
    })

    return () => {
      team.off('log', logHandler)
    }
  }, [team])

  // Handle keyboard input
  useInput((input, key) => {
    if (input === 'p' || input === 'P') {
      team.pause().catch((err) => setError(err.message))
    }
    if (input === 'r' || input === 'R') {
      team.resume().catch((err) => setError(err.message))
    }
    if (input === 'c' || input === 'C') {
      team.cancel().then(() => process.exit(0)).catch((err) => setError(err.message))
    }
    if (input === 'q' || input === 'Q') {
      process.exit(0)
    }
    if (key.ctrl && input === 'c') {
      team.cancel().then(() => process.exit(0)).catch(() => process.exit(1))
    }
  })

  if (!status) {
    return (
      <Box flexDirection="column" padding={1}>
        <Text>Starting multi-agent team...</Text>
        {error && <Text color="red">Error: {error}</Text>}
      </Box>
    )
  }

  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Header */}
      <Box borderStyle="single" paddingX={1}>
        <Text bold>Multi-Agent Governance Framework</Text>
        <Text> | Task: {status.taskId.slice(0, 8)}</Text>
        <Text> | Status: {status.status}</Text>
        <Text> | Heartbeat: #{status.currentHeartbeat}</Text>
      </Box>

      {/* Main content */}
      <Box flexGrow={1} flexDirection="row">
        {/* Left panel: Execution log */}
        <Box width="60%">
          <ExecutionLog logs={logs} />
        </Box>

        {/* Right panel: Agent status */}
        <Box width="40%">
          <AgentStatus agents={status.agents} />
        </Box>
      </Box>

      {/* Footer */}
      <Box borderStyle="single" paddingX={1}>
        <Text>[P]ause [R]esume [C]ancel [Q]uit</Text>
      </Box>
    </Box>
  )
}
