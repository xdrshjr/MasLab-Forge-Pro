# TODO Task 09: pi-mono Integration & Error Recovery

## Task Position
- **Phase**: Integration
- **Order**: Task 9 of 10

## Task Overview
Integrate the pi-mono ecosystem packages (@mariozechner/pi-agent-core, pi-ai, pi-coding-agent) into the bottom-layer agents to provide actual code execution capabilities. Implement comprehensive error recovery strategies including retry logic, peer takeover, and escalation mechanisms.

## Specification Traceability
- **Related Documents**: `master-plan.md`, `specs/06-14-合并规范.md`
- **Related Sections**:
  - Master Plan Section 3.1 "Core Dependencies" (pi-mono packages)
  - Master Plan Section 7.1 "External Dependencies"
  - Merged Spec "Spec 07: Error Recovery"
  - Merged Spec "Spec 13: pi-mono Integration"
- **Relationship**: This task implements the pi-mono integration strategy from Spec 13 and error recovery mechanisms from Spec 07. It connects the abstract agent framework to concrete execution capabilities (pi-coding-agent for code generation, pi-ai for LLM calls), enabling bottom-layer agents to actually perform coding tasks. The error recovery system ensures robustness through retries, peer assistance, and supervisor escalation.

## TODO Checklist

### 1. Set Up pi-mono Dependencies
Install and configure pi-mono packages.

**Pseudocode**:
```
// In packages/core/package.json
{
    "dependencies": {
        "@mariozechner/pi-agent-core": "^1.0.0",
        "@mariozechner/pi-ai": "^1.0.0",
        "@mariozechner/pi-coding-agent": "^1.0.0"
    }
}

// Install
npm install

// Create type definitions if needed
// types/pi-mono.d.ts
declare module '@mariozechner/pi-agent-core' {
    export class PiAgentCore {
        constructor(config: PiAgentCoreConfig)
        execute(params: ExecuteParams): Promise<ExecuteResult>
    }

    export interface PiAgentCoreConfig {
        model: string
        temperature?: number
        systemPrompt?: string
    }

    export interface ExecuteParams {
        task: string
        context?: any
    }

    export interface ExecuteResult {
        success: boolean
        output: any
        error?: string
    }
}

declare module '@mariozechner/pi-ai' {
    export class PiAI {
        constructor(config: PiAIConfig)
        call(prompt: string): Promise<string>
    }

    export interface PiAIConfig {
        model: string
        apiKey?: string
        temperature?: number
    }
}

declare module '@mariozechner/pi-coding-agent' {
    export class PiCodingAgent {
        constructor(config: PiCodingAgentConfig)
        execute(params: CodingTaskParams): Promise<CodingResult>
    }

    export interface PiCodingAgentConfig {
        model: string
        tools: string[]
    }

    export interface CodingTaskParams {
        task: string
        context?: any
        tools?: string[]
    }

    export interface CodingResult {
        success: boolean
        output: string
        files?: Array<{ path: string, content: string }>
        error?: string
    }
}
```

### 2. Create pi-agent-core Wrapper
Wrap pi-agent-core for top and mid-layer agents.

**Pseudocode**:
```
import { PiAgentCore } from '@mariozechner/pi-agent-core'
import { PiAI } from '@mariozechner/pi-ai'

class PiAgentCoreWrapper {
    private core: PiAgentCore
    private ai: PiAI

    constructor(config: {
        model: string
        temperature?: number
        systemPrompt?: string
    }):
        this.core = new PiAgentCore({
            model: config.model || 'claude-3-5-sonnet',
            temperature: config.temperature || 0.7,
            systemPrompt: config.systemPrompt
        })

        this.ai = new PiAI({
            model: config.model || 'claude-3-5-sonnet',
            apiKey: process.env.ANTHROPIC_API_KEY,
            temperature: config.temperature || 0.7
        })

    async function plan(task: string, context: any): Promise<string>:
        prompt = `
Plan how to accomplish this task:

Task: ${task}
Context: ${JSON.stringify(context, null, 2)}

Provide a step-by-step plan.
        `

        return await this.ai.call(prompt)

    async function execute(task: string, context: any): Promise<any>:
        result = await this.core.execute({
            task,
            context
        })

        if not result.success:
            throw new Error(result.error || 'Execution failed')

        return result.output

    async function reflect(task: string, result: any): Promise<string>:
        prompt = `
Reflect on this task execution:

Task: ${task}
Result: ${JSON.stringify(result, null, 2)}

What went well? What could be improved?
        `

        return await this.ai.call(prompt)
}
```

### 3. Integrate pi-coding-agent into BottomLayerAgent
Add code execution capabilities to bottom-layer agents.

**Pseudocode**:
```
import { PiCodingAgent } from '@mariozechner/pi-coding-agent'

class BottomLayerAgent extends BaseAgent {
    private piCodingAgent: PiCodingAgent

    constructor(config: AgentConfig, dependencies: AgentDependencies):
        super(config, dependencies)

        // Initialize pi-coding-agent
        this.piCodingAgent = new PiCodingAgent({
            model: config.config.llmModel || 'claude-3-5-sonnet',
            tools: config.tools || [
                'file_read',
                'file_write',
                'bash',
                'http_request',
                'grep',
                'glob'
            ]
        })

    protected async function executeWithTools(task: Task): Promise<ExecutionResult>:
        try:
            // Read whiteboard for context
            layerWhiteboard = await this.readWhiteboard(this.config.layer, this.config.id)
            globalWhiteboard = await this.readWhiteboard('global')

            // Execute using pi-coding-agent
            result = await this.piCodingAgent.execute({
                task: task.description,
                context: {
                    layerWhiteboard,
                    globalWhiteboard,
                    taskContext: task.context
                },
                tools: this.config.tools
            })

            if result.success:
                // Save generated files if any
                if result.files:
                    for file of result.files:
                        await this.saveGeneratedFile(file.path, file.content)

                return {
                    success: true,
                    output: result.output,
                    files: result.files
                }
            else:
                throw new Error(result.error || 'Execution failed')

        catch error:
            console.error(`[${this.config.name}] Execution error:`, error)
            return {
                success: false,
                output: '',
                error: error.message
            }

    private async function saveGeneratedFile(filePath: string, content: string): Promise<void>:
        // Save to project directory
        fullPath = path.join(this.config.projectRoot || '.', filePath)

        await fs.mkdir(path.dirname(fullPath), { recursive: true })
        await fs.writeFile(fullPath, content, 'utf-8')

        console.log(`[${this.config.name}] Generated file: ${filePath}`)
}
```

### 4. Implement Error Recovery Strategy
Create comprehensive error handling system.

**Pseudocode**:
```
enum ErrorSeverity {
    LOW = 'low',           // Retry immediately
    MEDIUM = 'medium',     // Retry with backoff
    HIGH = 'high',         // Escalate to supervisor
    CRITICAL = 'critical'  // Escalate to top layer
}

interface ErrorContext {
    error: Error
    agentId: string
    taskId: string
    attemptCount: number
    severity: ErrorSeverity
}

class ErrorRecoveryManager {
    private maxRetries: Map<ErrorSeverity, number> = new Map([
        [ErrorSeverity.LOW, 3],
        [ErrorSeverity.MEDIUM, 2],
        [ErrorSeverity.HIGH, 1],
        [ErrorSeverity.CRITICAL, 0]
    ])

    private backoffDelays: Map<ErrorSeverity, number> = new Map([
        [ErrorSeverity.LOW, 1000],      // 1 second
        [ErrorSeverity.MEDIUM, 5000],   // 5 seconds
        [ErrorSeverity.HIGH, 10000],    // 10 seconds
        [ErrorSeverity.CRITICAL, 0]
    ])

    async function handleError(errorContext: ErrorContext): Promise<RecoveryAction>:
        severity = this.classifyError(errorContext.error)
        errorContext.severity = severity

        console.log(`[ErrorRecovery] ${severity} error in ${errorContext.agentId}: ${errorContext.error.message}`)

        // Determine recovery strategy
        maxRetries = this.maxRetries.get(severity)

        if errorContext.attemptCount < maxRetries:
            // Retry with backoff
            return await this.retryWithBackoff(errorContext)

        // Exceeded retries, try alternative strategies
        return await this.escalate(errorContext)

    private function classifyError(error: Error): ErrorSeverity:
        message = error.message.toLowerCase()

        // Critical errors
        if message.includes('authentication') or
           message.includes('permission denied') or
           message.includes('api key'):
            return ErrorSeverity.CRITICAL

        // High severity
        if message.includes('timeout') or
           message.includes('connection') or
           message.includes('network'):
            return ErrorSeverity.HIGH

        // Medium severity
        if message.includes('file not found') or
           message.includes('syntax error'):
            return ErrorSeverity.MEDIUM

        // Low severity (default)
        return ErrorSeverity.LOW

    private async function retryWithBackoff(errorContext: ErrorContext): Promise<RecoveryAction>:
        delay = this.backoffDelays.get(errorContext.severity)
        backoffMultiplier = Math.pow(2, errorContext.attemptCount)  // Exponential backoff

        actualDelay = delay * backoffMultiplier

        console.log(`[ErrorRecovery] Retrying in ${actualDelay}ms (attempt ${errorContext.attemptCount + 1})`)

        await sleep(actualDelay)

        return {
            type: 'retry',
            agentId: errorContext.agentId,
            delay: actualDelay
        }

    private async function escalate(errorContext: ErrorContext): Promise<RecoveryAction>:
        severity = errorContext.severity

        if severity === ErrorSeverity.CRITICAL:
            // Escalate to top layer immediately
            return {
                type: 'escalate_to_top',
                agentId: errorContext.agentId,
                error: errorContext.error
            }

        if severity === ErrorSeverity.HIGH:
            // Try peer takeover first, then escalate to supervisor
            peerCanHelp = await this.checkPeerAvailability(errorContext.agentId)

            if peerCanHelp:
                return {
                    type: 'peer_takeover',
                    agentId: errorContext.agentId,
                    taskId: errorContext.taskId
                }
            else:
                return {
                    type: 'escalate_to_supervisor',
                    agentId: errorContext.agentId,
                    error: errorContext.error
                }

        // Medium/Low: escalate to supervisor
        return {
            type: 'escalate_to_supervisor',
            agentId: errorContext.agentId,
            error: errorContext.error
        }

    private async function checkPeerAvailability(agentId: string): Promise<boolean>:
        agent = this.agentPool.getAgent(agentId)
        if not agent:
            return false

        peers = this.agentPool.getAgentsByLayer(agent.config.layer)
            .filter(p => p.config.id !== agentId)

        for peer of peers:
            if peer.getStatus() === AgentStatus.IDLE:
                return true

        return false
}
```

### 5. Implement Peer Takeover Mechanism
Enable agents to help each other.

**Pseudocode**:
```
class PeerTakeoverCoordinator {
    constructor(
        private agentPool: AgentPool,
        private messageBus: MessageBus
    )

    async function initiateTaskeover(
        failedAgentId: string,
        taskId: string
    ): Promise<boolean>:
        failedAgent = this.agentPool.getAgent(failedAgentId)

        if not failedAgent:
            return false

        // Find available peers
        peers = this.agentPool.getAgentsByLayer(failedAgent.config.layer)
            .filter(p => p.config.id !== failedAgentId and p.getStatus() === AgentStatus.IDLE)

        if peers.length === 0:
            console.log('[PeerTakeover] No available peers')
            return false

        // Request help from first available peer
        peer = peers[0]

        this.messageBus.sendMessage({
            id: generateUUID(),
            from: 'system',
            to: peer.config.id,
            type: MessageType.PEER_HELP_REQUEST,
            content: {
                helpType: 'take_over_task',
                failedAgentId,
                taskId,
                task: failedAgent.currentTask
            },
            timestamp: Date.now(),
            priority: MessagePriority.HIGH
        })

        // Wait for peer response (with timeout)
        response = await this.waitForPeerResponse(peer.config.id, 10000)

        if response and response.accepted:
            console.log(`[PeerTakeover] ${peer.config.id} accepted takeover`)
            return true
        else:
            console.log(`[PeerTakeover] ${peer.config.id} declined or timed out`)
            return false

    private async function waitForPeerResponse(
        peerId: string,
        timeoutMs: number
    ): Promise<{ accepted: boolean } | null>:
        return new Promise((resolve) => {
            timeout = setTimeout(() => resolve(null), timeoutMs)

            // Listen for response
            listener = (message: Message) => {
                if message.from === peerId and
                   message.type === MessageType.PEER_HELP_RESPONSE:
                    clearTimeout(timeout)
                    resolve(message.content)
            }

            this.messageBus.on('message', listener)
        })
}
```

### 6. Implement Supervisor Escalation
Create escalation workflow to supervisors.

**Pseudocode**:
```
class SupervisorEscalationHandler {
    constructor(
        private agentPool: AgentPool,
        private messageBus: MessageBus,
        private governanceEngine: GovernanceEngine
    )

    async function escalateToSupervisor(
        agentId: string,
        error: Error
    ): Promise<void>:
        agent = this.agentPool.getAgent(agentId)

        if not agent or not agent.config.supervisor:
            // No supervisor, escalate to top layer
            await this.escalateToTopLayer(agentId, error)
            return

        supervisor = this.agentPool.getAgent(agent.config.supervisor)

        if not supervisor:
            console.error(`Supervisor ${agent.config.supervisor} not found`)
            return

        // Send escalation message
        this.messageBus.sendMessage({
            id: generateUUID(),
            from: 'system',
            to: supervisor.config.id,
            type: MessageType.ISSUE_ESCALATION,
            content: {
                agentId,
                error: {
                    message: error.message,
                    stack: error.stack
                },
                metrics: agent.getMetrics(),
                proposedSolution: await this.proposeSolution(agentId, error)
            },
            timestamp: Date.now(),
            priority: MessagePriority.URGENT
        })

        console.log(`[Escalation] ${agentId} escalated to supervisor ${supervisor.config.id}`)

    async function escalateToTopLayer(
        agentId: string,
        error: Error
    ): Promise<void>:
        topLayerAgents = this.agentPool.getAgentsByLayer('top')

        if topLayerAgents.length === 0:
            console.error('No top-layer agents available for escalation')
            return

        // Send to all top-layer agents for consultation
        for topAgent of topLayerAgents:
            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: topAgent.config.id,
                type: MessageType.ISSUE_ESCALATION,
                content: {
                    agentId,
                    error: {
                        message: error.message,
                        stack: error.stack
                    },
                    severity: ErrorSeverity.CRITICAL,
                    requiresDecision: true
                },
                timestamp: Date.now(),
                priority: MessagePriority.URGENT
            })

        console.log(`[Escalation] ${agentId} escalated to top layer (critical)`)

    private async function proposeSolution(agentId: string, error: Error): Promise<string>:
        // Use LLM to suggest solution
        prompt = `
An agent encountered this error:

Agent: ${agentId}
Error: ${error.message}

Suggest a recovery action:
1. Replace agent
2. Reassign task to peer
3. Modify task parameters
4. Pause and await manual intervention

Provide brief recommendation.
        `

        // Would call LLM here
        return 'Recommend replacing agent due to persistent failure'
}
```

### 7. Add Agent Replacement with State Transfer
Enable seamless agent replacement.

**Pseudocode**:
```
class AgentReplacementManager {
    constructor(
        private teamManager: TeamManager,
        private agentPool: AgentPool
    )

    async function replaceAgent(
        failedAgentId: string,
        reason: string
    ): Promise<BaseAgent>:
        failedAgent = this.agentPool.getAgent(failedAgentId)

        if not failedAgent:
            throw new Error(`Agent ${failedAgentId} not found`)

        console.log(`[Replacement] Replacing ${failedAgentId}: ${reason}`)

        // Capture current state
        state = this.captureAgentState(failedAgent)

        // Create replacement
        newAgent = await this.teamManager.replaceAgent(failedAgentId)

        // Transfer state
        await this.transferState(state, newAgent)

        console.log(`[Replacement] ${failedAgentId} replaced with ${newAgent.config.id}`)

        return newAgent

    private function captureAgentState(agent: BaseAgent): AgentState:
        return {
            currentTask: agent.currentTask,
            taskQueue: agent.taskQueue || [],
            whiteboardContent: await agent.readWhiteboard(agent.config.layer, agent.config.id),
            metrics: agent.getMetrics(),
            subordinates: agent.config.subordinates
        }

    private async function transferState(state: AgentState, newAgent: BaseAgent): Promise<void>:
        // Transfer current task
        if state.currentTask:
            newAgent.currentTask = state.currentTask

        // Transfer task queue
        if state.taskQueue:
            newAgent.taskQueue = [...state.taskQueue]

        // Write whiteboard with context
        if state.whiteboardContent:
            await newAgent.writeWhiteboard(`
## Replacement Context

Previous agent encountered issues. Continuing from:

${state.whiteboardContent}

## Current Status
- Replacement agent initialized
- Task queue: ${state.taskQueue.length} tasks
- Resuming execution...
            `)

        console.log(`[Replacement] State transferred to ${newAgent.config.id}`)
}
```

### 8. Integrate Error Recovery with Agent Lifecycle
Hook error recovery into agent heartbeat and execution.

**Pseudocode**:
```
// In BaseAgent class

protected async function handleError(error: Error): Promise<void>:
    errorContext: ErrorContext = {
        error,
        agentId: this.config.id,
        taskId: this.currentTask?.id || 'unknown',
        attemptCount: this.retryCount,
        severity: ErrorSeverity.LOW  // Will be classified
    }

    // Use error recovery manager
    recoveryAction = await this.errorRecoveryManager.handleError(errorContext)

    switch recoveryAction.type:
        case 'retry':
            this.retryCount++
            console.log(`[${this.config.name}] Retrying after ${recoveryAction.delay}ms`)
            return  // Will retry on next heartbeat

        case 'peer_takeover':
            console.log(`[${this.config.name}] Requesting peer takeover`)
            success = await this.peerTakeoverCoordinator.initiateTakeover(
                this.config.id,
                this.currentTask.id
            )

            if success:
                // Peer accepted, clear current task
                this.currentTask = null
                this.stateMachine.transition(this, AgentStatus.IDLE, 'peer takeover')
            else:
                // Peer unavailable, escalate
                await this.supervisorEscalationHandler.escalateToSupervisor(
                    this.config.id,
                    error
                )

        case 'escalate_to_supervisor':
            await this.supervisorEscalationHandler.escalateToSupervisor(
                this.config.id,
                error
            )
            this.stateMachine.transition(this, AgentStatus.BLOCKED, 'awaiting supervisor')

        case 'escalate_to_top':
            await this.supervisorEscalationHandler.escalateToTopLayer(
                this.config.id,
                error
            )
            this.stateMachine.transition(this, AgentStatus.BLOCKED, 'awaiting top layer')
```

### 9. Add Execution Monitoring and Timeout
Implement timeout protection for long-running operations.

**Pseudocode**:
```
class ExecutionMonitor {
    private activeExecutions: Map<string, {
        agentId: string
        startTime: number
        timeout: NodeJS.Timeout
    }> = new Map()

    function startMonitoring(
        executionId: string,
        agentId: string,
        timeoutMs: number,
        onTimeout: () => void
    ): void:
        timeout = setTimeout(() => {
            this.handleTimeout(executionId)
            onTimeout()
        }, timeoutMs)

        this.activeExecutions.set(executionId, {
            agentId,
            startTime: Date.now(),
            timeout
        })

    function stopMonitoring(executionId: string): void:
        execution = this.activeExecutions.get(executionId)
        if execution:
            clearTimeout(execution.timeout)
            this.activeExecutions.delete(executionId)

    private function handleTimeout(executionId: string): Promise<void>:
        execution = this.activeExecutions.get(executionId)
        if not execution:
            return

        duration = Date.now() - execution.startTime
        console.error(`[ExecutionMonitor] Timeout after ${duration}ms: ${executionId}`)

        // Trigger error recovery
        await this.errorRecoveryManager.handleError({
            error: new Error(`Execution timeout after ${duration}ms`),
            agentId: execution.agentId,
            taskId: executionId,
            attemptCount: 0,
            severity: ErrorSeverity.HIGH
        })

        this.activeExecutions.delete(executionId)
}

// Usage in BottomLayerAgent
protected async function executeCurrentTask(): Promise<void>:
    executionId = generateUUID()

    // Start monitoring
    this.executionMonitor.startMonitoring(
        executionId,
        this.config.id,
        this.config.config.timeoutMs,
        () => {
            console.log(`[${this.config.name}] Task execution timed out`)
        }
    )

    try:
        result = await this.executeWithTools(this.currentTask)
        // ... handle result ...
    finally:
        this.executionMonitor.stopMonitoring(executionId)
```

### 10. Write Comprehensive Tests
Test pi-mono integration and error recovery.

**Pseudocode**:
```
describe('PiCodingAgent Integration', () => {
    it('should execute code generation task', async () => {
        const agent = new BottomLayerAgent(config, dependencies)
        await agent.initialize()

        const task = {
            id: 'task-1',
            description: 'Create a function that adds two numbers',
            context: {}
        }

        const result = await agent.executeWithTools(task)

        expect(result.success).toBe(true)
        expect(result.output).toContain('function')
    })

    it('should save generated files to project directory', async () => {
        const agent = new BottomLayerAgent({ ...config, projectRoot: '/tmp/test' }, dependencies)
        const task = { description: 'Create index.js with hello world' }

        await agent.executeWithTools(task)

        const fileExists = fs.existsSync('/tmp/test/index.js')
        expect(fileExists).toBe(true)
    })
})

describe('ErrorRecoveryManager', () => {
    it('should classify error severity', () => {
        const manager = new ErrorRecoveryManager()

        const authError = new Error('Authentication failed')
        const severity = manager.classifyError(authError)
        expect(severity).toBe(ErrorSeverity.CRITICAL)

        const timeoutError = new Error('Connection timeout')
        const severity2 = manager.classifyError(timeoutError)
        expect(severity2).toBe(ErrorSeverity.HIGH)
    })

    it('should retry with exponential backoff', async () => {
        const manager = new ErrorRecoveryManager()

        const errorContext = {
            error: new Error('Temporary failure'),
            agentId: 'bot-1',
            taskId: 'task-1',
            attemptCount: 1,
            severity: ErrorSeverity.MEDIUM
        }

        const action = await manager.handleError(errorContext)

        expect(action.type).toBe('retry')
        expect(action.delay).toBe(10000)  // 5000 * 2^1
    })

    it('should escalate after max retries', async () => {
        const manager = new ErrorRecoveryManager()

        const errorContext = {
            error: new Error('Persistent failure'),
            agentId: 'bot-1',
            taskId: 'task-1',
            attemptCount: 3,  // Exceeded max
            severity: ErrorSeverity.MEDIUM
        }

        const action = await manager.handleError(errorContext)

        expect(action.type).toBe('escalate_to_supervisor')
    })
})

describe('PeerTakeoverCoordinator', () => {
    it('should successfully transfer task to peer', async () => {
        const coordinator = new PeerTakeoverCoordinator(agentPool, messageBus)

        const failedAgent = createTestAgent('bot-1')
        const peerAgent = createIdleTestAgent('bot-2')

        agentPool.addAgent(failedAgent)
        agentPool.addAgent(peerAgent)

        const success = await coordinator.initiateTakeover('bot-1', 'task-1')

        expect(success).toBe(true)
        expect(peerAgent.currentTask).toBeDefined()
    })

    it('should return false if no peers available', async () => {
        const coordinator = new PeerTakeoverCoordinator(agentPool, messageBus)

        const failedAgent = createTestAgent('bot-1')
        agentPool.addAgent(failedAgent)
        // No peers added

        const success = await coordinator.initiateTakeover('bot-1', 'task-1')

        expect(success).toBe(false)
    })
})

describe('AgentReplacementManager', () => {
    it('should replace agent and transfer state', async () => {
        const manager = new AgentReplacementManager(teamManager, agentPool)

        const failedAgent = createTestAgent('bot-1')
        failedAgent.currentTask = mockTask

        agentPool.addAgent(failedAgent)

        const newAgent = await manager.replaceAgent('bot-1', 'Persistent errors')

        expect(newAgent.config.id).not.toBe('bot-1')
        expect(newAgent.currentTask).toEqual(mockTask)
    })
})

describe('ExecutionMonitor', () => {
    it('should trigger timeout callback', async () => {
        const monitor = new ExecutionMonitor()
        let timedOut = false

        monitor.startMonitoring('exec-1', 'bot-1', 100, () => {
            timedOut = true
        })

        await sleep(150)

        expect(timedOut).toBe(true)
    })

    it('should cancel timeout when stopped', async () => {
        const monitor = new ExecutionMonitor()
        let timedOut = false

        monitor.startMonitoring('exec-1', 'bot-1', 100, () => {
            timedOut = true
        })

        monitor.stopMonitoring('exec-1')

        await sleep(150)

        expect(timedOut).toBe(false)
    })
})

describe('End-to-End Error Recovery', () => {
    it('should recover from temporary failure via retry', async () => {
        const agent = new BottomLayerAgent(config, dependencies)
        agent.simulateFailureCount = 2  // Fail first 2 times

        await agent.initialize()

        const task = { description: 'Simple task' }

        await agent.executeCurrentTask()

        // Should succeed after retries
        expect(agent.getMetrics().tasksCompleted).toBe(1)
    })

    it('should escalate persistent failure to supervisor', async () => {
        const agent = new BottomLayerAgent(config, dependencies)
        agent.simulateFailureCount = 10  // Always fail

        await agent.initialize()

        const task = { description: 'Failing task' }

        await agent.executeCurrentTask()

        // Should have sent escalation message
        const supervisorMessages = messageBus.getMessages(agent.config.supervisor)
        expect(supervisorMessages.some(m => m.type === MessageType.ISSUE_ESCALATION)).toBe(true)
    })
})
```

## Dependencies
- **Prerequisites**: Task 05 (Agent base classes), Task 08 (Team management)
- **Following Tasks**: Task 10 (TUI/CLI need fully functional agents)

## Acceptance Criteria
- [ ] pi-mono packages installed and type definitions created
- [ ] PiAgentCoreWrapper provides plan/execute/reflect for top/mid layers
- [ ] PiCodingAgent integrated into BottomLayerAgent for code execution
- [ ] Generated files saved to project directory
- [ ] ErrorRecoveryManager classifies error severity correctly
- [ ] Retry logic uses exponential backoff
- [ ] Peer takeover successfully transfers tasks when available
- [ ] Supervisor escalation sends ISSUE_ESCALATION messages
- [ ] Top-layer escalation for critical errors
- [ ] Agent replacement preserves task state
- [ ] ExecutionMonitor enforces timeouts (default 30s)
- [ ] All error recovery paths tested
- [ ] Unit tests cover >70% of integration and recovery code
- [ ] Integration tests verify end-to-end error recovery workflows
- [ ] pi-coding-agent successfully generates and executes code
