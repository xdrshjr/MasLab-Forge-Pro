/**
 * TUI Entry Point
 *
 * Starts the terminal user interface for monitoring agent teams.
 */

import React from 'react'
import { render } from 'ink'
import { App } from './App.js'
import type { AgentTeam } from '@magf/core'

/**
 * Start the TUI
 *
 * @param team - AgentTeam instance to monitor
 */
export function startTUI(team: AgentTeam): void {
  render(<App team={team} />)
}
