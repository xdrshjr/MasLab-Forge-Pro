/**
 * ExecutionLog Component
 *
 * Displays the execution log with recent messages.
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { LogEntry } from '../types.js'

interface ExecutionLogProps {
  logs: LogEntry[]
}

/**
 * ExecutionLog component
 */
export function ExecutionLog({ logs }: ExecutionLogProps): React.ReactElement {
  const recentLogs = logs.slice(-20) // Show last 20 logs

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold underline>
        Execution Log
      </Text>
      <Box flexDirection="column" flexGrow={1}>
        {recentLogs.map((log, i) => (
          <Text key={i} dimColor>
            [{log.timestamp}] {log.message}
          </Text>
        ))}
      </Box>
    </Box>
  )
}
