/**
 * AgentStatus Component
 *
 * Displays the status of all agents grouped by layer.
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { AgentStatusSummary, AgentStatus as Status } from '@magf/core'

interface AgentStatusProps {
  agents: AgentStatusSummary[]
}

/**
 * Get status icon for agent
 */
function getStatusIcon(status: Status): string {
  const statusMap: Record<string, string> = {
    IDLE: '●',
    WORKING: '◉',
    BLOCKED: '◐',
    FAILED: '✗',
  }
  return statusMap[status] || '○'
}

/**
 * AgentStatus component
 */
export function AgentStatus({ agents }: AgentStatusProps): React.ReactElement {
  const topAgents = agents.filter((a) => a.layer === 'top')
  const midAgents = agents.filter((a) => a.layer === 'mid')
  const bottomAgents = agents.filter((a) => a.layer === 'bottom')

  return (
    <Box flexDirection="column" borderStyle="single" paddingX={1}>
      <Text bold underline>
        Agent Status ({agents.length})
      </Text>

      {/* Top Layer */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="cyan">
          Top Layer:
        </Text>
        {topAgents.map((agent) => (
          <Text key={agent.id}>
            {getStatusIcon(agent.status)} {agent.name}
          </Text>
        ))}
      </Box>

      {/* Mid Layer */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="yellow">
          Mid Layer:
        </Text>
        {midAgents.map((agent) => (
          <Text key={agent.id}>
            {getStatusIcon(agent.status)} {agent.name}
          </Text>
        ))}
      </Box>

      {/* Bottom Layer */}
      <Box flexDirection="column" marginTop={1}>
        <Text bold color="green">
          Bottom Layer:
        </Text>
        {bottomAgents.slice(0, 5).map((agent) => (
          <Text key={agent.id}>
            {getStatusIcon(agent.status)} {agent.name}
          </Text>
        ))}
        {bottomAgents.length > 5 && (
          <Text dimColor>... and {bottomAgents.length - 5} more</Text>
        )}
      </Box>
    </Box>
  )
}
