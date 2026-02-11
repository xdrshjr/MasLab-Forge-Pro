#!/usr/bin/env node

/**
 * Multi-Agent Governance Framework CLI
 *
 * Command-line interface for managing multi-agent teams.
 * This is the main entry point for the CLI tool.
 */

import { Command } from 'commander'
import { AgentTeam } from '@magf/core'
import { startTUI } from './tui/start.js'
import { loadConfig, getConfigValue, setConfigValue } from './config.js'

const VERSION = '0.1.0'

const program = new Command()

program
  .name('magf')
  .description('Multi-Agent Governance Framework - CLI for managing agent teams')
  .version(VERSION)

program
  .command('start <task>')
  .description('Start a new multi-agent task')
  .option('-m, --mode <mode>', 'Execution mode: auto or semi-auto', 'auto')
  .option('--max-agents <number>', 'Maximum number of bottom-layer agents', '5')
  .option('--no-tui', 'Disable TUI, show minimal output')
  .option('--db <path>', 'Database path', './.agent-workspace/task.db')
  .option('--workspace <path>', 'Workspace path', './.agent-workspace')
  .action(
    async (
      task: string,
      options: { mode: string; maxAgents: string; tui: boolean; db: string; workspace: string }
    ) => {
      const config = loadConfig()

      const team = new AgentTeam({
        ...config,
        mode: options.mode as 'auto' | 'semi-auto',
        maxBottomAgents: parseInt(options.maxAgents),
        databasePath: options.db,
        workspacePath: options.workspace,
      })

      if (options.tui) {
        // Start with TUI
        startTUI(team)
        await team.start(task)
      } else {
        // Minimal output
        console.log('Starting task...')
        try {
          const result = await team.start(task)
          console.log(`Task ${result.success ? 'completed' : 'failed'}`)
          console.log(JSON.stringify(result, null, 2))
        } catch (error) {
          console.error('Error:', error instanceof Error ? error.message : String(error))
          process.exit(1)
        }
      }
    }
  )

program
  .command('status')
  .description('Show current task status')
  .option('--agents', 'Show agent details')
  .option('--whiteboard', 'Show whiteboard content')
  .action((options: { agents?: boolean; whiteboard?: boolean }) => {
    console.log('Status command')
    if (options.agents) console.log('Showing agent details...')
    if (options.whiteboard) console.log('Showing whiteboard...')
  })

program
  .command('pause')
  .description('Pause the current task')
  .action(() => {
    console.log('Pausing task...')
  })

program
  .command('resume')
  .description('Resume a paused task')
  .action(() => {
    console.log('Resuming task...')
  })

program
  .command('cancel')
  .description('Cancel the current task')
  .action(() => {
    console.log('Cancelling task...')
  })

program
  .command('logs')
  .description('View system logs')
  .option('--category <category>', 'Log category', 'message-bus')
  .option('--tail <lines>', 'Number of lines to show', '50')
  .action(async (options: { category: string; tail: string }) => {
    const fs = await import('node:fs')
    const logPath = `.agent-workspace/logs/${options.category}.log`

    if (!fs.existsSync(logPath)) {
      console.log(`Log file not found: ${logPath}`)
      return
    }

    const lines = parseInt(options.tail)
    const content = fs.readFileSync(logPath, 'utf-8')
    const logLines = content.split('\n').slice(-lines)

    logLines.forEach((line) => console.log(line))
  })

program
  .command('history')
  .description('View task history')
  .option('--task <taskId>', 'Show specific task details')
  .action((options: { task?: string }) => {
    console.log('Task history (implementation pending - requires database integration)')
    if (options.task) {
      console.log(`Task ID: ${options.task}`)
    }
  })

program
  .command('config <action> [key] [value]')
  .description('Manage configuration (actions: show, set)')
  .action((action: string, key?: string, value?: string) => {
    const configPath = './.magf.config.json'

    switch (action) {
      case 'show': {
        const config = loadConfig(configPath)
        console.log(JSON.stringify(config, null, 2))
        break
      }

      case 'set': {
        if (!key || !value) {
          console.error('Usage: magf config set <key> <value>')
          process.exit(1)
        }
        setConfigValue(key, value, configPath)
        console.log(`Set ${key} = ${value}`)
        break
      }

      case 'get': {
        if (!key) {
          console.error('Usage: magf config get <key>')
          process.exit(1)
        }
        const val = getConfigValue(key, configPath)
        console.log(val)
        break
      }

      default:
        console.error('Unknown action. Use: show, set, get')
        process.exit(1)
    }
  })

program.parse()
