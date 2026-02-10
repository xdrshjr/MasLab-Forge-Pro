# TODO Task 10: TUI, CLI & SDK Finalization

## Task Position
- **Phase**: User Interface & Integration
- **Order**: Task 10 of 10

## Task Overview
Implement the complete user-facing interface: Terminal UI (TUI) using Ink for real-time monitoring, Command-Line Interface (CLI) using Commander for task management, and finalize the SDK API for programmatic integration. This is the culmination of all previous tasks, providing users with accessible ways to interact with the multi-agent framework.

## Specification Traceability
- **Related Documents**: `master-plan.md`, `specs/06-14-合并规范.md`
- **Related Sections**:
  - Master Plan Section 2 "Core Goals" (SDK + TUI)
  - Merged Spec "Spec 10: SDK API Design"
  - Merged Spec "Spec 11: TUI Interface Design"
  - Merged Spec "Spec 12: CLI Command Design"
- **Relationship**: This task implements the user-facing interfaces from Specs 10-12, providing both interactive (TUI) and command-line (CLI) interfaces for the framework. It completes the SDK API from Spec 10, creates the two-panel TUI from Spec 11 (left: execution log, right: agent status), and implements all CLI commands from Spec 12 (start, status, pause, resume, cancel, logs).

## TODO Checklist

### 1. Finalize SDK API
Complete the main AgentTeam API for programmatic use.

**Pseudocode**:
```
export interface AgentTeamConfig {
    mode: 'auto' | 'semi-auto'
    heartbeatInterval?: number  // Default: 4000ms
    maxBottomAgents?: number    // Default: 5
    databasePath?: string       // Default: './.agent-workspace/task.db'
    workspacePath?: string      // Default: './.agent-workspace'
    projectRoot?: string        // Default: '.'
    llmModel?: string           // Default: 'claude-3-5-sonnet'
}

export interface TaskResult {
    success: boolean
    taskId: string
    duration: number
    output: any
    error?: string
    metrics: {
        totalAgents: number
        tasksCompleted: number
        tasksFailed: number
        decisionsApproved: number
        decisionsRejected: number
    }
}

export interface TeamStatus {
    taskId: string
    status: TaskLifecycleStatus
    currentHeartbeat: number
    elapsedTime: number
    teamSize: number
    agents: AgentStatusSummary[]
    recentMessages: Message[]
    whiteboard: string
}

export class AgentTeam {
    constructor(config: AgentTeamConfig)

    // === Main API ===

    async function start(taskDescription: string): Promise<TaskResult>:
        console.log('Starting multi-agent team...')

        // 1. Initialize all systems
        await this.initialize()

        // 2. Start task
        taskId = await this.lifecycleManager.startTask(taskDescription, this.config.mode)
        this.currentTaskId = taskId

        // 3. Wait for completion or user intervention
        result = await this.waitForCompletion(taskId)

        // 4. Cleanup
        await this.cleanup()

        return result

    async function pause(): Promise<void>:
        if not this.currentTaskId:
            throw new Error('No active task')

        await this.lifecycleManager.pauseTask(this.currentTaskId)

    async function resume(): Promise<void>:
        if not this.currentTaskId:
            throw new Error('No active task')

        await this.lifecycleManager.resumeTask(this.currentTaskId)

    async function cancel(): Promise<void>:
        if not this.currentTaskId:
            throw new Error('No active task')

        await this.lifecycleManager.cancelTask(this.currentTaskId)

    // === Status & Monitoring ===

    function getStatus(): TeamStatus:
        if not this.currentTaskId:
            throw new Error('No active task')

        task = this.lifecycleManager.getActiveTask(this.currentTaskId)

        return {
            taskId: this.currentTaskId,
            status: task.status,
            currentHeartbeat: this.messageBus.getCurrentHeartbeat(),
            elapsedTime: this.messageBus.getCurrentHeartbeat() * this.config.heartbeatInterval,
            teamSize: task.team.size,
            agents: this.getAgentStatuses(task.team),
            recentMessages: this.getRecentMessages(10),
            whiteboard: await this.whiteboardSystem.read('global')
        }

    function getAgents(): BaseAgent[]:
        if not this.currentTaskId:
            return []

        task = this.lifecycleManager.getActiveTask(this.currentTaskId)
        return Array.from(task.team.values())

    // === Event Listening ===

    function on(event: string, callback: Function): void:
        this.eventEmitter.on(event, callback)

    // Events:
    // - 'heartbeat': (heartbeatNumber: number) => void
    // - 'agent:created': (agent: BaseAgent) => void
    // - 'agent:failed': (agentId: string, error: Error) => void
    // - 'decision:pending': (decision: Decision) => void
    // - 'decision:approved': (decisionId: string) => void
    // - 'task:completed': (result: TaskResult) => void

    // === Internal Methods ===

    private async function initialize(): Promise<void>:
        // Initialize database
        this.database = new DatabaseManager(this.config.databasePath)
        await this.database.initialize()

        // Initialize whiteboard system
        this.whiteboardSystem = new WhiteboardSystem({
            workspacePath: this.config.workspacePath,
            enableVersioning: true
        })

        // Initialize message bus
        this.messageBus = new MessageBus({
            heartbeatInterval: this.config.heartbeatInterval
        }, this.database)

        // Initialize governance engine
        this.governanceEngine = new GovernanceEngine(
            this.database,
            this.messageBus,
            this.whiteboardSystem,
            { /* governance config */ }
        )

        // Initialize agent pool
        this.agentPool = new AgentPool()

        // Initialize team manager
        this.teamManager = new TeamManager(
            new RoleGenerator(),
            this.agentPool,
            this.governanceEngine,
            {
                messageBus: this.messageBus,
                whiteboardSystem: this.whiteboardSystem,
                governanceEngine: this.governanceEngine,
                database: this.database
            }
        )

        // Initialize lifecycle manager
        this.lifecycleManager = new TaskLifecycleManager(
            new RequirementManager(),
            this.teamManager,
            this.messageBus,
            this.database
        )

        console.log('Agent team initialized')

    private async function waitForCompletion(taskId: string): Promise<TaskResult>:
        return new Promise((resolve, reject) => {
            // Listen for task completion
            this.on('task:completed', (result: TaskResult) => {
                if result.taskId === taskId:
                    resolve(result)
            })

            // Listen for task failure
            this.on('task:failed', (result: TaskResult) => {
                if result.taskId === taskId:
                    resolve(result)
            })

            // Set timeout (e.g., 2 hours)
            setTimeout(() => {
                reject(new Error('Task timeout after 2 hours'))
            }, 2 * 60 * 60 * 1000)
        })

    private async function cleanup(): Promise<void>:
        // Stop message bus
        this.messageBus.stop()

        // Close database
        await this.database.close()

        console.log('Cleanup complete')
}

// Export main API
export default AgentTeam
export { AgentTeam }
```

### 2. Implement TUI Layout with Ink
Create the two-panel terminal interface.

**Pseudocode**:
```
import { render, Box, Text, useEffect, useState } from 'ink'

interface TUIProps {
    team: AgentTeam
}

function App({ team }: TUIProps) {
    const [status, setStatus] = useState<TeamStatus | null>(null)
    const [logs, setLogs] = useState<string[]>([])

    // Update status every second
    useEffect(() => {
        const interval = setInterval(() => {
            try {
                const newStatus = team.getStatus()
                setStatus(newStatus)
            } catch (error) {
                // No active task yet
            }
        }, 1000)

        return () => clearInterval(interval)
    }, [team])

    // Listen to log events
    useEffect(() => {
        const logHandler = (log: string) => {
            setLogs(prev => [...prev.slice(-100), log])  // Keep last 100 logs
        }

        team.on('log', logHandler)
        team.on('agent:created', (agent) => logHandler(`Agent created: ${agent.config.name}`))
        team.on('heartbeat', (n) => logHandler(`Heartbeat #${n}`))

        return () => {
            team.off('log', logHandler)
        }
    }, [team])

    if not status:
        return <Text>Starting...</Text>

    return (
        <Box flexDirection="column" height="100%" width="100%">
            {/* Header */}
            <Box borderStyle="single" padding={1}>
                <Text bold>Multi-Agent Governance Framework</Text>
                <Text> | Task: {status.taskId.slice(0, 8)}</Text>
                <Text> | Status: {status.status}</Text>
                <Text> | Heartbeat: #{status.currentHeartbeat}</Text>
            </Box>

            {/* Main content */}
            <Box flexGrow={1} flexDirection="row">
                {/* Left panel: Execution log */}
                <Box flexDirection="column" width="60%" borderStyle="single" padding={1}>
                    <Text bold underline>Execution Log</Text>
                    <Box flexDirection="column" flexGrow={1} overflow="scroll">
                        {logs.slice(-20).map((log, i) => (
                            <Text key={i} dimColor>{log}</Text>
                        ))}
                    </Box>
                </Box>

                {/* Right panel: Agent status */}
                <Box flexDirection="column" width="40%" borderStyle="single" padding={1}>
                    <Text bold underline>Agent Status ({status.teamSize})</Text>

                    {/* Group by layer */}
                    <Box flexDirection="column" marginTop={1}>
                        <Text bold color="cyan">Top Layer:</Text>
                        {status.agents
                            .filter(a => a.layer === 'top')
                            .map(a => (
                                <Text key={a.id}>
                                    {getStatusIcon(a.status)} {a.name}
                                </Text>
                            ))
                        }
                    </Box>

                    <Box flexDirection="column" marginTop={1}>
                        <Text bold color="yellow">Mid Layer:</Text>
                        {status.agents
                            .filter(a => a.layer === 'mid')
                            .map(a => (
                                <Text key={a.id}>
                                    {getStatusIcon(a.status)} {a.name}
                                </Text>
                            ))
                        }
                    </Box>

                    <Box flexDirection="column" marginTop={1}>
                        <Text bold color="green">Bottom Layer:</Text>
                        {status.agents
                            .filter(a => a.layer === 'bottom')
                            .slice(0, 5)  // Show first 5
                            .map(a => (
                                <Text key={a.id}>
                                    {getStatusIcon(a.status)} {a.name}
                                </Text>
                            ))
                        }
                        {status.agents.filter(a => a.layer === 'bottom').length > 5 && (
                            <Text dimColor>... and {status.agents.filter(a => a.layer === 'bottom').length - 5} more</Text>
                        )}
                    </Box>

                    {/* Recent messages */}
                    <Box flexDirection="column" marginTop={1}>
                        <Text bold underline>Recent Messages:</Text>
                        {status.recentMessages.slice(-5).map((msg, i) => (
                            <Text key={i} dimColor>
                                [{msg.from.slice(0, 6)}→{msg.to.slice(0, 6)}] {msg.type}
                            </Text>
                        ))}
                    </Box>
                </Box>
            </Box>

            {/* Footer */}
            <Box borderStyle="single" padding={1}>
                <Text>Commands: [P]ause [R]esume [C]ancel [W]hiteboard [L]ogs [Q]uit</Text>
            </Box>
        </Box>
    )
}

function getStatusIcon(status: AgentStatus): string {
    switch (status) {
        case AgentStatus.IDLE: return '●'
        case AgentStatus.WORKING: return '◉'
        case AgentStatus.BLOCKED: return '◐'
        case AgentStatus.FAILED: return '✗'
        default: return '○'
    }
}

// Start TUI
export function startTUI(team: AgentTeam): void {
    render(<App team={team} />)
}
```

### 3. Implement CLI Commands
Create command-line interface using Commander.

**Pseudocode**:
```
#!/usr/bin/env node

import { Command } from 'commander'
import { AgentTeam } from '@magf/core'
import { startTUI } from './tui'

const program = new Command()

program
    .name('magf')
    .description('Multi-Agent Governance Framework CLI')
    .version('1.0.0')

// === START COMMAND ===

program
    .command('start <task>')
    .description('Start a new multi-agent task')
    .option('-m, --mode <mode>', 'Execution mode: auto or semi-auto', 'auto')
    .option('--max-agents <number>', 'Maximum bottom agents', '5')
    .option('--no-tui', 'Disable TUI, show minimal output')
    .option('--db <path>', 'Database path', './.agent-workspace/task.db')
    .option('--workspace <path>', 'Workspace path', './.agent-workspace')
    .action(async (task, options) => {
        const team = new AgentTeam({
            mode: options.mode,
            maxBottomAgents: parseInt(options.maxAgents),
            databasePath: options.db,
            workspacePath: options.workspace
        })

        if options.tui:
            // Start with TUI
            startTUI(team)
            await team.start(task)
        else:
            // Minimal output
            console.log('Starting task...')
            const result = await team.start(task)
            console.log(`Task ${result.success ? 'completed' : 'failed'}`)
            console.log(JSON.stringify(result, null, 2))
    })

// === STATUS COMMAND ===

program
    .command('status')
    .description('Show current task status')
    .option('--agents', 'Show detailed agent information')
    .option('--whiteboard', 'Show global whiteboard content')
    .action(async (options) => {
        const team = loadActiveTeam()

        if not team:
            console.log('No active task')
            return

        const status = team.getStatus()

        console.log(`Task: ${status.taskId}`)
        console.log(`Status: ${status.status}`)
        console.log(`Heartbeat: #${status.currentHeartbeat}`)
        console.log(`Team Size: ${status.teamSize}`)

        if options.agents:
            console.log('\n=== Agents ===')
            for agent of status.agents:
                console.log(`${agent.layer.toUpperCase().padEnd(8)} ${agent.name.padEnd(25)} ${agent.status}`)

        if options.whiteboard:
            console.log('\n=== Global Whiteboard ===')
            console.log(status.whiteboard)
    })

// === PAUSE/RESUME/CANCEL COMMANDS ===

program
    .command('pause')
    .description('Pause the current task')
    .action(async () => {
        const team = loadActiveTeam()
        if team:
            await team.pause()
            console.log('Task paused')
        else:
            console.log('No active task')
    })

program
    .command('resume')
    .description('Resume the paused task')
    .action(async () => {
        const team = loadActiveTeam()
        if team:
            await team.resume()
            console.log('Task resumed')
        else:
            console.log('No active task')
    })

program
    .command('cancel')
    .description('Cancel the current task')
    .action(async () => {
        const team = loadActiveTeam()
        if team:
            await team.cancel()
            console.log('Task cancelled')
        else:
            console.log('No active task')
    })

// === LOGS COMMAND ===

program
    .command('logs')
    .description('View system logs')
    .option('--category <category>', 'Log category', 'message-bus')
    .option('--tail <lines>', 'Number of lines to show', '50')
    .action(async (options) => {
        const logPath = `.agent-workspace/logs/${options.category}.log`

        if not fs.existsSync(logPath):
            console.log(`Log file not found: ${logPath}`)
            return

        const lines = parseInt(options.tail)
        const content = fs.readFileSync(logPath, 'utf-8')
        const logLines = content.split('\n').slice(-lines)

        logLines.forEach(line => console.log(line))
    })

// === HISTORY COMMAND ===

program
    .command('history')
    .description('View task history')
    .option('--task <taskId>', 'Show specific task details')
    .action(async (options) => {
        const db = new DatabaseManager('./.agent-workspace/task.db')
        await db.initialize()

        if options.task:
            const task = await db.get('tasks', options.task)
            if task:
                console.log(JSON.stringify(task, null, 2))
            else:
                console.log('Task not found')
        else:
            const tasks = await db.query('tasks', {})
            console.log(`Total tasks: ${tasks.length}\n`)

            for task of tasks.slice(-10):  // Last 10 tasks
                const duration = task.completed_at ? task.completed_at - task.created_at : null
                console.log(`${task.id.slice(0, 8)} | ${task.status.padEnd(12)} | ${task.description.slice(0, 40)}${duration ? ` | ${duration}ms` : ''}`)
    })

// === CONFIG COMMAND ===

program
    .command('config <action> [key] [value]')
    .description('Manage configuration')
    .action((action, key, value) => {
        const configPath = './.agent-workspace/config.json'

        switch action:
            case 'show':
                if fs.existsSync(configPath):
                    const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
                    console.log(JSON.stringify(config, null, 2))
                else:
                    console.log('No configuration file found')
                break

            case 'set':
                if not key or not value:
                    console.log('Usage: magf config set <key> <value>')
                    return

                let config = {}
                if fs.existsSync(configPath):
                    config = JSON.parse(fs.readFileSync(configPath, 'utf-8'))

                config[key] = value
                fs.writeFileSync(configPath, JSON.stringify(config, null, 2))
                console.log(`Set ${key} = ${value}`)
                break

            default:
                console.log('Unknown action. Use: show, set')
    })

program.parse()

// Helper function to load active team
function loadActiveTeam(): AgentTeam | null {
    // Check for active task in database
    const db = new DatabaseManager('./.agent-workspace/task.db')
    db.initialize()

    const activeTasks = db.query('tasks', { status: 'running' })

    if activeTasks.length === 0:
        return null

    // Reconstruct team (simplified - full implementation would restore state)
    const team = new AgentTeam({ mode: 'auto' })
    return team
}
```

### 4. Add Interactive Input Handler for TUI
Handle keyboard input for TUI commands.

**Pseudocode**:
```
import { useInput } from 'ink'

function App({ team }: TUIProps) {
    // ... existing state ...

    useInput((input, key) => {
        if input === 'p' or input === 'P':
            team.pause()
                .then(() => console.log('Task paused'))
                .catch(err => console.error('Pause failed:', err))

        if input === 'r' or input === 'R':
            team.resume()
                .then(() => console.log('Task resumed'))
                .catch(err => console.error('Resume failed:', err))

        if input === 'c' or input === 'C':
            team.cancel()
                .then(() => {
                    console.log('Task cancelled')
                    process.exit(0)
                })
                .catch(err => console.error('Cancel failed:', err))

        if input === 'w' or input === 'W':
            // Show whiteboard in separate view
            showWhiteboardView(team)

        if input === 'l' or input === 'L':
            // Show logs in separate view
            showLogsView()

        if input === 'q' or input === 'Q':
            if confirm('Are you sure you want to quit? (y/n)'):
                process.exit(0)

        if key.ctrl and input === 'c':
            // Ctrl+C: graceful shutdown
            team.cancel()
                .then(() => process.exit(0))
                .catch(() => process.exit(1))
    })

    // ... existing render ...
}
```

### 5. Create Example Usage Scripts
Provide example scripts for common use cases.

**Pseudocode**:
```
// examples/simple-todo-app.js

import { AgentTeam } from '@magf/core'

async function main() {
    const team = new AgentTeam({
        mode: 'auto',
        maxBottomAgents: 5
    })

    // Listen to events
    team.on('heartbeat', (n) => {
        if n % 10 === 0:
            console.log(`Heartbeat #${n}`)
    })

    team.on('agent:created', (agent) => {
        console.log(`Agent created: ${agent.config.name}`)
    })

    team.on('decision:approved', (decisionId) => {
        console.log(`Decision ${decisionId} approved`)
    })

    // Start task
    const result = await team.start(`
        Create a simple TODO app with the following features:
        - Add new TODOs
        - Mark TODOs as complete
        - Delete TODOs
        - List all TODOs

        Use Express.js for the backend and SQLite for storage.
    `)

    console.log('Task completed!')
    console.log(result)
}

main().catch(console.error)
```

### 6. Add Progress Indicators
Show task progress in TUI.

**Pseudocode**:
```
import { Text, Spinner } from 'ink'

function ProgressIndicator({ status }: { status: TeamStatus }) {
    // Calculate progress based on milestones or tasks completed
    const progress = calculateProgress(status)

    return (
        <Box>
            {status.status === 'running' && <Spinner type="dots" />}
            <Text> Progress: {progress}%</Text>
        </Box>
    )
}

function calculateProgress(status: TeamStatus): number {
    // Parse global whiteboard for milestones
    const milestones = extractMilestones(status.whiteboard)
    const completed = milestones.filter(m => m.completed).length
    const total = milestones.length

    return total > 0 ? Math.round((completed / total) * 100) : 0
}
```

### 7. Create Configuration File Support
Allow persistent configuration.

**Pseudocode**:
```
// .magf.config.json

{
    "mode": "auto",
    "maxBottomAgents": 5,
    "heartbeatInterval": 4000,
    "databasePath": "./.agent-workspace/task.db",
    "workspacePath": "./.agent-workspace",
    "projectRoot": ".",
    "llmModel": "claude-3-5-sonnet",
    "governance": {
        "signatureThreshold": 0.67,
        "electionInterval": 50,
        "warningThreshold": 3
    }
}

// Load configuration
function loadConfig(): AgentTeamConfig {
    const defaultConfig: AgentTeamConfig = {
        mode: 'auto',
        maxBottomAgents: 5,
        // ... defaults
    }

    const configPath = './.magf.config.json'

    if fs.existsSync(configPath):
        const userConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        return { ...defaultConfig, ...userConfig }

    return defaultConfig
}
```

### 8. Add Documentation Generation
Create usage documentation.

**Pseudocode**:
```
// scripts/generate-docs.ts

function generateAPIDocs(): void {
    // Extract JSDoc comments and generate markdown
    const api = [
        {
            class: 'AgentTeam',
            methods: [
                { name: 'start', description: '...', params: '...', returns: '...' },
                { name: 'pause', description: '...', params: '...', returns: '...' },
                // ...
            ]
        }
    ]

    const markdown = `
# API Documentation

## AgentTeam

Main SDK class for managing multi-agent teams.

### Constructor

\`\`\`typescript
new AgentTeam(config: AgentTeamConfig)
\`\`\`

${api[0].methods.map(m => `
### ${m.name}

${m.description}

**Parameters**: ${m.params}
**Returns**: ${m.returns}
`).join('\n')}
    `

    fs.writeFileSync('docs/api/AgentTeam.md', markdown)
}
```

### 9. Package for Distribution
Prepare packages for npm publication.

**Pseudocode**:
```
// packages/core/package.json
{
    "name": "@magf/core",
    "version": "1.0.0",
    "main": "./dist/index.cjs",
    "module": "./dist/index.js",
    "types": "./dist/index.d.ts",
    "exports": {
        ".": {
            "require": "./dist/index.cjs",
            "import": "./dist/index.js",
            "types": "./dist/index.d.ts"
        }
    },
    "files": [
        "dist"
    ],
    "scripts": {
        "build": "tsup",
        "prepublishOnly": "npm run build"
    }
}

// packages/cli/package.json
{
    "name": "@magf/cli",
    "version": "1.0.0",
    "bin": {
        "magf": "./dist/cli.js"
    },
    "dependencies": {
        "@magf/core": "^1.0.0",
        "commander": "^11.1.0",
        "ink": "^4.4.0"
    }
}

// Publish
npm publish --access public
```

### 10. Write End-to-End Tests
Test complete user workflows.

**Pseudocode**:
```
describe('SDK End-to-End', () => {
    it('should complete simple task via SDK', async () => {
        const team = new AgentTeam({ mode: 'auto' })

        const result = await team.start('Create a function that adds two numbers')

        expect(result.success).toBe(true)
        expect(result.output).toBeDefined()
    }, 120000)  // 2 minute timeout

    it('should support pause and resume', async () => {
        const team = new AgentTeam({ mode: 'auto' })

        // Start task in background
        const taskPromise = team.start('Long-running task')

        // Wait a bit, then pause
        await sleep(5000)
        await team.pause()

        const status1 = team.getStatus()
        expect(status1.status).toBe('paused')

        // Resume
        await team.resume()

        const status2 = team.getStatus()
        expect(status2.status).toBe('running')

        // Wait for completion
        await taskPromise
    }, 300000)  // 5 minute timeout
})

describe('CLI End-to-End', () => {
    it('should run task via CLI', async () => {
        const { stdout } = await exec('magf start "Create hello world function" --no-tui')

        expect(stdout).toContain('completed')
    }, 120000)

    it('should show status via CLI', async () => {
        // Start task
        exec('magf start "Simple task" --no-tui &')

        // Wait a bit
        await sleep(5000)

        // Check status
        const { stdout } = await exec('magf status')

        expect(stdout).toContain('Task:')
        expect(stdout).toContain('Status:')
    })
})

describe('TUI', () => {
    it('should render TUI without errors', async () => {
        const team = new AgentTeam({ mode: 'auto' })

        // Test rendering
        const { lastFrame } = render(<App team={team} />)

        expect(lastFrame()).toContain('Multi-Agent Governance Framework')
    })
})
```

## Dependencies
- **Prerequisites**: All previous tasks (01-09) must be complete
- **Following Tasks**: None - this is the final task

## Acceptance Criteria
- [ ] AgentTeam SDK API complete with start/pause/resume/cancel
- [ ] Event system working (heartbeat, agent:created, task:completed, etc.)
- [ ] TUI renders two-panel layout (execution log + agent status)
- [ ] TUI updates in real-time (1s refresh rate)
- [ ] TUI keyboard commands work (P, R, C, W, L, Q)
- [ ] CLI commands implemented: start, status, pause, resume, cancel, logs, history, config
- [ ] CLI --no-tui flag provides minimal output
- [ ] Configuration file support (.magf.config.json)
- [ ] Example scripts provided and working
- [ ] Progress indicators show task progress
- [ ] Packages ready for npm publication
- [ ] API documentation generated
- [ ] End-to-end tests pass
- [ ] README with quick start guide
- [ ] Can run: `npx @magf/cli start "Create TODO app"` successfully
