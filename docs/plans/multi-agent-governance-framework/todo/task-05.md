# TODO Task 05: Agent Base Classes & Lifecycle Management

## Task Position
- **Phase**: Agent Core
- **Order**: Task 5 of 10

## Task Overview
Implement the foundational Agent base class with complete lifecycle management, state machine, and layer-specific implementations (TopLayerAgent, MidLayerAgent, BottomLayerAgent). This establishes the core agent model that all intelligent agents in the system will extend.

## Specification Traceability
- **Related Documents**: `specs/01-架构设计.md`, `specs/02-Agent模型.md`
- **Related Sections**:
  - Architecture Design Section 2.2 "Layer Responsibilities Matrix"
  - Agent Model Spec Section 2 "Agent Base Class Design"
  - Agent Model Spec Section 3-5 "Top/Mid/Bottom Layer Agents"
  - Agent Model Spec Section 6 "Agent State Machine"
- **Relationship**: This task implements the complete agent model from Spec 02, creating the BaseAgent abstract class and three concrete layer-specific implementations. It establishes the lifecycle hooks (initialize, onHeartbeat, shutdown), state machine transitions, and the differentiated capabilities of each layer as defined in the architecture.

## TODO Checklist

### 1. Define Agent Data Structures
Create all types and interfaces for agent configuration and state.

**Pseudocode**:
```
type AgentLayer = 'top' | 'mid' | 'bottom'

type AgentCapability =
    | 'plan'
    | 'execute'
    | 'reflect'
    | 'tool_call'
    | 'code_gen'
    | 'test_exec'
    | 'review'
    | 'coordinate'
    | 'delegate'
    | 'arbitrate'

enum AgentStatus {
    INITIALIZING = 'initializing',
    IDLE = 'idle',
    WORKING = 'working',
    WAITING_APPROVAL = 'waiting_approval',
    BLOCKED = 'blocked',
    FAILED = 'failed',
    SHUTTING_DOWN = 'shutting_down',
    TERMINATED = 'terminated'
}

interface AgentConfig {
    id: string
    name: string
    layer: AgentLayer
    role: string  // Dynamic role description
    supervisor?: string
    subordinates: string[]
    capabilities: AgentCapability[]
    config: {
        llmModel?: string
        temperature?: number
        maxRetries: number
        timeoutMs: number
    }
}

interface AgentMetrics {
    tasksCompleted: number
    tasksFailed: number
    averageTaskDuration: number
    messagesProcessed: number
    heartbeatsResponded: number
    heartbeatsMissed: number
    warningsReceived: number
    lastActiveTimestamp: number
    performanceScore: number
}

interface AgentDependencies {
    messageBus: MessageBus
    whiteboardSystem: WhiteboardSystem
    governanceEngine: GovernanceEngine
    database: Database
}
```

### 2. Implement Agent State Machine
Create state transition logic with validation.

**Pseudocode**:
```
class AgentStateMachine {
    private allowedTransitions: Map<AgentStatus, AgentStatus[]> = new Map([
        [AgentStatus.INITIALIZING, [AgentStatus.IDLE, AgentStatus.FAILED]],
        [AgentStatus.IDLE, [AgentStatus.WORKING, AgentStatus.WAITING_APPROVAL, AgentStatus.SHUTTING_DOWN]],
        [AgentStatus.WORKING, [AgentStatus.IDLE, AgentStatus.BLOCKED, AgentStatus.FAILED, AgentStatus.WAITING_APPROVAL]],
        [AgentStatus.WAITING_APPROVAL, [AgentStatus.WORKING, AgentStatus.IDLE, AgentStatus.BLOCKED]],
        [AgentStatus.BLOCKED, [AgentStatus.WORKING, AgentStatus.FAILED]],
        [AgentStatus.FAILED, [AgentStatus.WORKING, AgentStatus.TERMINATED]],
        [AgentStatus.SHUTTING_DOWN, [AgentStatus.TERMINATED]],
        [AgentStatus.TERMINATED, []]
    ])

    function canTransition(from: AgentStatus, to: AgentStatus): boolean:
        allowed = this.allowedTransitions.get(from)
        return allowed?.includes(to) || false

    function transition(
        agent: BaseAgent,
        to: AgentStatus,
        reason: string
    ): void:
        from = agent.getStatus()

        if not this.canTransition(from, to):
            throw new Error(`Invalid transition: ${from} -> ${to}`)

        console.log(`[${agent.config.name}] State: ${from} -> ${to} (${reason})`)

        agent.status = to
        agent.database.logStateTransition(agent.config.id, from, to, reason)

        // Trigger state change event
        agent.onStateChange(from, to)
}
```

### 3. Implement BaseAgent Abstract Class
Create the foundational agent class with core lifecycle methods.

**Pseudocode**:
```
abstract class BaseAgent {
    protected config: AgentConfig
    protected status: AgentStatus
    protected metrics: AgentMetrics
    protected messageBus: MessageBus
    protected whiteboardSystem: WhiteboardSystem
    protected governanceEngine: GovernanceEngine
    protected database: Database
    protected stateMachine: AgentStateMachine
    protected messageQueue: Message[] = []
    private retryCount: number = 0

    constructor(config: AgentConfig, dependencies: AgentDependencies):
        this.config = config
        this.status = AgentStatus.INITIALIZING
        this.metrics = this.initializeMetrics()
        this.messageBus = dependencies.messageBus
        this.whiteboardSystem = dependencies.whiteboardSystem
        this.governanceEngine = dependencies.governanceEngine
        this.database = dependencies.database
        this.stateMachine = new AgentStateMachine()

    // === Public Lifecycle Methods ===

    async function initialize(): Promise<void>:
        console.log(`[${this.config.name}] Initializing...`)

        // Register with message bus
        this.messageBus.registerAgent(this.config.id)

        // Create whiteboard
        await this.whiteboardSystem.createWhiteboard(
            this.config.layer,
            this.config.id
        )

        // Subclass initialization
        await this.onInitialize()

        this.stateMachine.transition(this, AgentStatus.IDLE, 'initialization complete')
        this.metrics.lastActiveTimestamp = Date.now()

    async function onHeartbeat(heartbeatNumber: number): Promise<void>:
        try:
            // 1. Read messages
            messages = this.messageBus.getMessages(this.config.id)
            this.messageQueue.push(...messages)

            // 2. Update status
            if this.messageQueue.length > 0:
                this.stateMachine.transition(this, AgentStatus.WORKING, 'processing messages')

            // 3. Read whiteboard
            whiteboardContent = await this.readWhiteboard(this.config.layer)

            // 4. Process (subclass logic)
            await this.onProcess(this.messageQueue, whiteboardContent)

            // 5. Clear processed messages
            this.messageQueue = []

            // 6. Update metrics
            this.metrics.heartbeatsResponded++
            this.metrics.lastActiveTimestamp = Date.now()

            // 7. Send heartbeat acknowledgment
            this.sendMessage('system', MessageType.HEARTBEAT_ACK, { heartbeatNumber })

            // 8. Return to idle if no more work
            if this.status === AgentStatus.WORKING:
                this.stateMachine.transition(this, AgentStatus.IDLE, 'work complete')

        catch error:
            console.error(`[${this.config.name}] Heartbeat error:`, error)
            this.metrics.heartbeatsMissed++
            await this.handleError(error)

    async function shutdown(): Promise<void>:
        console.log(`[${this.config.name}] Shutting down...`)
        this.stateMachine.transition(this, AgentStatus.SHUTTING_DOWN, 'shutdown requested')

        // Subclass cleanup
        await this.onShutdown()

        // Unregister from message bus
        this.messageBus.unregisterAgent(this.config.id)

        this.stateMachine.transition(this, AgentStatus.TERMINATED, 'shutdown complete')

    // === Message Operations ===

    function sendMessage(to: string, type: MessageType, content: any): void:
        message = {
            id: generateUUID(),
            from: this.config.id,
            to,
            type,
            content,
            timestamp: Date.now()
        }

        this.messageBus.sendMessage(message)
        this.metrics.messagesProcessed++

    function broadcastMessage(type: MessageType, content: any): void:
        this.sendMessage('broadcast', type, content)

    // === Whiteboard Operations ===

    async function readWhiteboard(layer: string, agentId?: string): Promise<string>:
        return await this.whiteboardSystem.read(layer, agentId)

    async function writeWhiteboard(content: string): Promise<void>:
        await this.whiteboardSystem.write(
            this.config.layer,
            content,
            this.config.id
        )

    async function appendToGlobalWhiteboard(content: string): Promise<void>:
        await this.whiteboardSystem.append('global', content, this.config.id)

    // === Decision Operations ===

    async function proposeDecision(
        content: any,
        requireSigners: string[]
    ): Promise<Decision>:
        return await this.governanceEngine.submitDecision({
            id: generateUUID(),
            proposerId: this.config.id,
            content,
            requireSigners,
            status: 'pending',
            createdAt: Date.now()
        })

    async function signDecision(decisionId: string): Promise<void>:
        await this.governanceEngine.signDecision(decisionId, this.config.id)

    async function vetoDecision(decisionId: string, reason: string): Promise<void>:
        await this.governanceEngine.vetoDecision(decisionId, this.config.id, reason)

    // === State Query ===

    function getStatus(): AgentStatus:
        return this.status

    function getMetrics(): AgentMetrics:
        return { ...this.metrics }

    // === Error Handling ===

    protected async function handleError(error: Error): Promise<void>:
        console.error(`[${this.config.name}] Error:`, error)

        // Retry logic
        if this.retryCount < this.config.config.maxRetries:
            this.retryCount++
            console.log(`[${this.config.name}] Retry ${this.retryCount}/${this.config.config.maxRetries}`)
            return

        // Exceeded retries, report failure
        this.stateMachine.transition(this, AgentStatus.FAILED, 'retry limit exceeded')
        this.metrics.tasksFailed++

        if this.config.supervisor:
            this.sendMessage(this.config.supervisor, MessageType.ERROR_REPORT, {
                error: error.message,
                stack: error.stack,
                metrics: this.metrics
            })

    // === Abstract Methods (Subclasses Must Implement) ===

    protected abstract async function onInitialize(): Promise<void>
    protected abstract async function onProcess(messages: Message[], whiteboardContent: string): Promise<void>
    protected abstract async function onShutdown(): Promise<void>
    protected abstract function getResponsibilitiesDescription(): string

    // === Helper Methods ===

    protected function generateSystemPrompt(): string:
        return `
You are ${this.config.name}, a ${this.config.layer}-layer agent.
Role: ${this.config.role}
Capabilities: ${this.config.capabilities.join(', ')}

Responsibilities:
${this.getResponsibilitiesDescription()}

Collaboration rules:
- Communicate via message bus
- Share information via whiteboards
- Major decisions require signatures
- Report issues to supervisor
- Respond to heartbeats every 4 seconds
        `.trim()

    private function initializeMetrics(): AgentMetrics:
        return {
            tasksCompleted: 0,
            tasksFailed: 0,
            averageTaskDuration: 0,
            messagesProcessed: 0,
            heartbeatsResponded: 0,
            heartbeatsMissed: 0,
            warningsReceived: 0,
            lastActiveTimestamp: Date.now(),
            performanceScore: 100
        }
}
```

### 4. Implement TopLayerAgent
Create top-layer agent with strategic decision capabilities.

**Pseudocode**:
```
interface TopLayerAgentConfig extends AgentConfig {
    powerType: 'power_a' | 'power_b' | 'power_c'
    voteWeight: number
    signatureAuthority: string[]
}

class TopLayerAgent extends BaseAgent {
    protected powerType: string
    protected voteWeight: number
    protected signatureAuthority: string[]

    protected async function onInitialize(): Promise<void>:
        console.log(`[${this.config.name}] Power type: ${this.powerType}`)
        await this.waitForRoleAssignment()

    protected async function onProcess(
        messages: Message[],
        whiteboardContent: string
    ): Promise<void>:
        // 1. Handle signature requests
        signatureRequests = messages.filter(m => m.type === MessageType.SIGNATURE_REQUEST)
        for request of signatureRequests:
            await this.reviewAndSign(request)

        // 2. Handle mid-layer reports
        midReports = messages.filter(m =>
            m.type === MessageType.PROGRESS_REPORT and m.from.startsWith('mid-')
        )
        if midReports.length > 0:
            await this.reviewMidLayerProgress(midReports)

        // 3. Handle conflict arbitration
        conflicts = messages.filter(m => m.type === MessageType.CONFLICT_REPORT)
        for conflict of conflicts:
            await this.arbitrateConflict(conflict)

        // 4. Monitor overall progress
        globalWhiteboard = await this.readWhiteboard('global')
        await this.evaluateOverallProgress(globalWhiteboard)

        // 5. Initiate peer consultation if needed
        if this.detectIssue():
            await this.initiatePeerConsultation()

    protected async function onShutdown(): Promise<void>:
        // Log final report
        await this.writeWhiteboard(`
## Final Report - ${this.config.name}

- Decisions Signed: ${this.metrics.decisionsSigned}
- Decisions Vetoed: ${this.metrics.decisionsVetoed}
- Conflicts Arbitrated: ${this.metrics.conflictsArbitrated}
        `)

    protected function getResponsibilitiesDescription(): string:
        return `
- Approve major technical proposals and task allocations
- Monitor mid-layer leader progress
- Arbitrate conflicts between layers
- Evaluate overall task progress and quality
- Collaborate with other top-layer powers for major decisions
        `.trim()

    // === Top-Layer Specific Methods ===

    private async function reviewAndSign(request: Message): Promise<void>:
        decision = request.content.decision

        // Use LLM to evaluate
        shouldSign = await this.evaluateDecision(decision)

        if shouldSign:
            await this.signDecision(decision.id)
            console.log(`[${this.config.name}] Signed decision ${decision.id}`)
        else:
            await this.vetoDecision(decision.id, 'Risk assessment failed')
            console.log(`[${this.config.name}] Vetoed decision ${decision.id}`)

    private async function arbitrateConflict(conflict: Message): Promise<void>:
        parties = conflict.content.parties
        issue = conflict.content.issue

        // Consult other top-layer agents
        otherTopAgents = this.getOtherTopLayerAgents()
        votes = await this.collectVotes(otherTopAgents, conflict)

        // Majority decision
        resolution = this.calculateResolution(votes)

        // Publish result
        await this.appendToGlobalWhiteboard(`
## Arbitration Result

Conflict: ${issue}
Parties: ${parties.join(', ')}
Resolution: ${resolution}
Votes: ${votes}
Arbitrator: ${this.config.name}
Time: ${new Date().toISOString()}
        `)

        // Notify parties
        for party of parties:
            this.sendMessage(party, MessageType.ARBITRATION_RESULT, { resolution })
}
```

### 5. Implement MidLayerAgent
Create mid-layer agent with tactical planning capabilities.

**Pseudocode**:
```
interface MidLayerAgentConfig extends AgentConfig {
    domain: string
    maxSubordinates: number
}

class MidLayerAgent extends BaseAgent {
    protected domain: string
    protected taskQueue: Task[] = []
    protected subordinateStatus: Map<string, AgentStatus> = new Map()

    protected async function onInitialize(): Promise<void>:
        console.log(`[${this.config.name}] Domain: ${this.domain}`)
        await this.waitForSubordinateAssignment()
        this.taskQueue = []

    protected async function onProcess(
        messages: Message[],
        whiteboardContent: string
    ): Promise<void>:
        // 1. Receive tasks from top layer
        taskAssignments = messages.filter(m =>
            m.type === MessageType.TASK_ASSIGN and m.from.startsWith('top-')
        )
        for assignment of taskAssignments:
            this.taskQueue.push(assignment.content.task)

        // 2. Delegate to subordinates
        if this.taskQueue.length > 0:
            await this.delegateTasksToSubordinates()

        // 3. Collect subordinate progress
        subordinateReports = messages.filter(m =>
            m.type === MessageType.PROGRESS_REPORT and
            this.config.subordinates.includes(m.from)
        )
        await this.aggregateSubordinateProgress(subordinateReports)

        // 4. Coordinate with peers
        peerMessages = messages.filter(m => m.type === MessageType.PEER_COORDINATION)
        for peerMsg of peerMessages:
            await this.coordinateWithPeer(peerMsg)

        // 5. Escalate issues if needed
        issues = await this.detectIssues()
        if issues.length > 0:
            await this.escalateToTopLayer(issues)

        // 6. Report to top layer periodically
        if this.shouldReport():
            await this.reportToTopLayer()

    protected async function onShutdown(): Promise<void>:
        if this.taskQueue.length > 0:
            console.warn(`[${this.config.name}] Shutting down with ${this.taskQueue.length} pending tasks`)

    protected function getResponsibilitiesDescription(): string:
        return `
- Receive tasks from top layer and decompose into subtasks
- Assign subtasks to bottom-layer agents
- Monitor subordinate progress and quality
- Coordinate with peer mid-layer agents
- Detect issues and escalate to top layer
- Report overall progress periodically
        `.trim()

    // === Mid-Layer Specific Methods ===

    private async function delegateTasksToSubordinates(): Promise<void>:
        // Use LLM to decompose tasks
        decomposition = await this.decomposeTask(this.taskQueue)

        // Assign subtasks
        for subtask of decomposition.subtasks:
            assigneeId = subtask.assignee
            this.sendMessage(assigneeId, MessageType.TASK_ASSIGN, { task: subtask })
            console.log(`[${this.config.name}] Assigned to ${assigneeId}: ${subtask.description}`)

        // Update whiteboard
        await this.writeWhiteboard(`
## Task Allocation Plan

${decomposition.subtasks.map(st => `- [${st.assignee}] ${st.description}`).join('\n')}
        `)

        this.taskQueue = []

    private async function aggregateSubordinateProgress(reports: Message[]): Promise<void>:
        for report of reports:
            agentId = report.from
            progress = report.content.progress

            this.subordinateStatus.set(agentId, progress.status)

            await this.appendToWhiteboard(`
- [${agentId}] ${progress.status}: ${progress.description} (${progress.percentage}%)
            `)
}
```

### 6. Implement BottomLayerAgent
Create bottom-layer agent with execution capabilities.

**Pseudocode**:
```
interface BottomLayerAgentConfig extends AgentConfig {
    tools: string[]
}

class BottomLayerAgent extends BaseAgent {
    protected currentTask: Task | null = null
    protected tools: string[]

    protected async function onInitialize(): Promise<void>:
        console.log(`[${this.config.name}] Tools: ${this.tools.join(', ')}`)

    protected async function onProcess(
        messages: Message[],
        whiteboardContent: string
    ): Promise<void>:
        // 1. Receive task from mid-layer
        taskAssignments = messages.filter(m =>
            m.type === MessageType.TASK_ASSIGN and m.from === this.config.supervisor
        )
        if taskAssignments.length > 0:
            this.currentTask = taskAssignments[0].content.task

        // 2. Execute current task
        if this.currentTask and this.status === AgentStatus.IDLE:
            await this.executeCurrentTask()

        // 3. Help peers if requested
        peerRequests = messages.filter(m => m.type === MessageType.PEER_HELP_REQUEST)
        for request of peerRequests:
            await this.helpPeer(request)

        // 4. Respond to supervisor queries
        supervisorQueries = messages.filter(m =>
            m.type === MessageType.STATUS_QUERY and m.from === this.config.supervisor
        )
        if supervisorQueries.length > 0:
            await this.reportStatus()

    protected async function onShutdown(): Promise<void>:
        if this.currentTask:
            console.warn(`[${this.config.name}] Shutting down with incomplete task`)

    protected function getResponsibilitiesDescription(): string:
        return `
- Receive specific tasks from mid-layer supervisor
- Execute tasks using available tools
- Record execution results to whiteboard
- Report progress and results to supervisor
- Collaborate with peers when needed
        `.trim()

    // === Bottom-Layer Specific Methods ===

    private async function executeCurrentTask(): Promise<void>:
        if not this.currentTask:
            return

        this.stateMachine.transition(this, AgentStatus.WORKING, 'executing task')
        console.log(`[${this.config.name}] Executing: ${this.currentTask.description}`)

        try:
            // Execute using tools (will integrate pi-coding-agent in Task 09)
            result = await this.executeWithTools(this.currentTask)

            // Update whiteboard
            await this.writeWhiteboard(`
## Task Execution Result

Task: ${this.currentTask.description}
Status: ${result.success ? 'Success' : 'Failed'}
Output:
\`\`\`
${result.output}
\`\`\`
            `)

            // Report to supervisor
            this.sendMessage(this.config.supervisor!, MessageType.PROGRESS_REPORT, {
                taskId: this.currentTask.id,
                status: result.success ? 'completed' : 'failed',
                result
            })

            // Update metrics
            if result.success:
                this.metrics.tasksCompleted++
            else:
                this.metrics.tasksFailed++

            this.currentTask = null
            this.stateMachine.transition(this, AgentStatus.IDLE, 'task complete')

        catch error:
            console.error(`[${this.config.name}] Task execution failed:`, error)
            await this.handleError(error)

    private async function helpPeer(request: Message): Promise<void>:
        peerId = request.from
        helpType = request.content.helpType

        if helpType === 'share_knowledge':
            knowledge = await this.readWhiteboard(this.config.layer)
            this.sendMessage(peerId, MessageType.PEER_HELP_RESPONSE, { knowledge })
        else if helpType === 'take_over_task':
            if this.status === AgentStatus.IDLE and not this.currentTask:
                this.currentTask = request.content.task
                this.sendMessage(peerId, MessageType.PEER_HELP_RESPONSE, { accepted: true })
            else:
                this.sendMessage(peerId, MessageType.PEER_HELP_RESPONSE, {
                    accepted: false,
                    reason: 'busy'
                })
}
```

### 7. Implement Agent Pool Manager
Create management for agent lifecycle and registry.

**Pseudocode**:
```
class AgentPool {
    private agents: Map<string, BaseAgent> = new Map()
    private maxAgents: number = 50

    async function createAgent(
        config: AgentConfig,
        dependencies: AgentDependencies
    ): Promise<BaseAgent>:
        if this.agents.size >= this.maxAgents:
            throw new Error(`Agent pool full (max ${this.maxAgents})`)

        // Create appropriate agent type
        const AgentClass = this.getAgentClass(config.layer)
        agent = new AgentClass(config, dependencies)

        await agent.initialize()

        this.agents.set(agent.config.id, agent)
        console.log(`Agent created: ${agent.config.id}`)

        return agent

    async function destroyAgent(agentId: string): Promise<void>:
        agent = this.agents.get(agentId)
        if not agent:
            return

        await agent.shutdown()
        this.agents.delete(agentId)
        console.log(`Agent destroyed: ${agentId}`)

    function getAgent(agentId: string): BaseAgent | undefined:
        return this.agents.get(agentId)

    function getAllAgents(): BaseAgent[]:
        return Array.from(this.agents.values())

    function getAgentsByLayer(layer: AgentLayer): BaseAgent[]:
        return this.getAllAgents().filter(a => a.config.layer === layer)

    private function getAgentClass(layer: AgentLayer): typeof BaseAgent:
        switch layer:
            case 'top':
                return TopLayerAgent
            case 'mid':
                return MidLayerAgent
            case 'bottom':
                return BottomLayerAgent
            default:
                throw new Error(`Unknown layer: ${layer}`)
}
```

### 8. Implement Capability Registry
Create system for registering and validating agent capabilities.

**Pseudocode**:
```
interface Capability {
    name: string
    description: string
    requiredLayer: AgentLayer[]
    execute: (agent: BaseAgent, context: any) => Promise<any>
}

class CapabilityRegistry {
    private capabilities: Map<string, Capability> = new Map()

    function register(capability: Capability): void:
        this.capabilities.set(capability.name, capability)

    function get(name: string): Capability | undefined:
        return this.capabilities.get(name)

    function canExecute(agentLayer: AgentLayer, capabilityName: string): boolean:
        capability = this.get(capabilityName)
        if not capability:
            return false

        return capability.requiredLayer.includes(agentLayer)

    function listCapabilities(agentLayer: AgentLayer): Capability[]:
        return Array.from(this.capabilities.values())
            .filter(c => c.requiredLayer.includes(agentLayer))
}

// Register built-in capabilities
const capabilityRegistry = new CapabilityRegistry()

capabilityRegistry.register({
    name: 'plan',
    description: 'Decompose tasks and create plans',
    requiredLayer: ['top', 'mid', 'bottom'],
    execute: async (agent, context) => {
        // Planning logic
    }
})

capabilityRegistry.register({
    name: 'arbitrate',
    description: 'Resolve conflicts and make final decisions',
    requiredLayer: ['top'],
    execute: async (agent, context) => {
        // Arbitration logic
    }
})
```

### 9. Add Agent Metrics Calculator
Implement performance score calculation.

**Pseudocode**:
```
class AgentMetricsCalculator {
    function calculatePerformanceScore(agent: BaseAgent): number:
        metrics = agent.getMetrics()

        // Success rate (40%)
        totalTasks = metrics.tasksCompleted + metrics.tasksFailed
        successRate = totalTasks > 0 ? metrics.tasksCompleted / totalTasks : 1
        successScore = successRate * 40

        // Responsiveness (30%)
        responsivenessScore = this.calculateResponsiveness(metrics) * 30

        // Reliability (30%)
        totalHeartbeats = metrics.heartbeatsResponded + metrics.heartbeatsMissed
        reliabilityRate = totalHeartbeats > 0 ? metrics.heartbeatsResponded / totalHeartbeats : 1
        reliabilityScore = reliabilityRate * 30

        return successScore + responsivenessScore + reliabilityScore

    private function calculateResponsiveness(metrics: AgentMetrics): number:
        maxTime = 60000  // 60 seconds
        score = 1 - Math.min(metrics.averageTaskDuration / maxTime, 1)
        return score
}
```

### 10. Write Comprehensive Tests
Test all agent functionality.

**Pseudocode**:
```
describe('BaseAgent', () => {
    it('should initialize correctly', async () => {
        const agent = new TestAgent(config, dependencies)
        await agent.initialize()

        expect(agent.getStatus()).toBe(AgentStatus.IDLE)
        expect(agent.getMetrics().heartbeatsResponded).toBe(0)
    })

    it('should process messages on heartbeat', async () => {
        const agent = new TestAgent(config, dependencies)
        await agent.initialize()

        messageBus.sendMessage(createTestMessage(agent.config.id))

        await agent.onHeartbeat(1)

        expect(agent.getMetrics().heartbeatsResponded).toBe(1)
        expect(agent.getMetrics().messagesProcessed).toBeGreaterThan(0)
    })

    it('should handle errors with retry', async () => {
        const agent = new TestAgent(config, dependencies)
        agent.simulateError = true

        await agent.onHeartbeat(1)
        await agent.onHeartbeat(2)
        await agent.onHeartbeat(3)
        await agent.onHeartbeat(4)  // Should exceed retry limit

        expect(agent.getStatus()).toBe(AgentStatus.FAILED)
    })
})

describe('AgentStateMachine', () => {
    it('should allow valid transitions', () => {
        const sm = new AgentStateMachine()

        expect(sm.canTransition(AgentStatus.IDLE, AgentStatus.WORKING)).toBe(true)
        expect(sm.canTransition(AgentStatus.WORKING, AgentStatus.IDLE)).toBe(true)
    })

    it('should reject invalid transitions', () => {
        const sm = new AgentStateMachine()

        expect(sm.canTransition(AgentStatus.IDLE, AgentStatus.TERMINATED)).toBe(false)
    })
})

describe('TopLayerAgent', () => {
    it('should review and sign decisions', async () => {
        const agent = new TopLayerAgent(config, dependencies)
        await agent.initialize()

        const decision = createTestDecision()
        const signatureRequest = createSignatureRequest(decision)

        await agent.onProcess([signatureRequest], '')

        expect(governanceEngine.getDecision(decision.id).signers).toContain(agent.config.id)
    })
})

describe('MidLayerAgent', () => {
    it('should delegate tasks to subordinates', async () => {
        const agent = new MidLayerAgent(config, dependencies)
        agent.config.subordinates = ['bot-1', 'bot-2']
        await agent.initialize()

        const taskAssignment = createTaskAssignment(agent.config.id, largeTask)

        await agent.onProcess([taskAssignment], '')

        // Verify subtasks were sent to subordinates
        const bot1Messages = messageBus.getMessages('bot-1')
        const bot2Messages = messageBus.getMessages('bot-2')

        expect(bot1Messages.length + bot2Messages.length).toBeGreaterThan(0)
    })
})

describe('BottomLayerAgent', () => {
    it('should execute tasks and report results', async () => {
        const agent = new BottomLayerAgent(config, dependencies)
        await agent.initialize()

        const taskAssignment = createTaskAssignment(agent.config.id, simpleTask)

        await agent.onProcess([taskAssignment], '')

        // Wait for execution
        await sleep(1000)

        // Check report was sent to supervisor
        const supervisorMessages = messageBus.getMessages(agent.config.supervisor)
        expect(supervisorMessages.some(m => m.type === MessageType.PROGRESS_REPORT)).toBe(true)
    })
})

describe('AgentPool', () => {
    it('should create and destroy agents', async () => {
        const pool = new AgentPool()

        const agent = await pool.createAgent(config, dependencies)
        expect(pool.getAgent(agent.config.id)).toBeDefined()

        await pool.destroyAgent(agent.config.id)
        expect(pool.getAgent(agent.config.id)).toBeUndefined()
    })

    it('should enforce max agent limit', async () => {
        const pool = new AgentPool()
        pool.maxAgents = 2

        await pool.createAgent(config1, dependencies)
        await pool.createAgent(config2, dependencies)

        await expect(pool.createAgent(config3, dependencies)).rejects.toThrow('Agent pool full')
    })
})
```

## Dependencies
- **Prerequisites**: Task 03 (Message bus), Task 04 (Whiteboard system)
- **Following Tasks**: Task 06 (Governance mechanisms need agents)

## Acceptance Criteria
- [ ] BaseAgent abstract class with complete lifecycle methods
- [ ] TopLayerAgent with strategic decision and arbitration capabilities
- [ ] MidLayerAgent with tactical planning and delegation capabilities
- [ ] BottomLayerAgent with task execution capabilities
- [ ] AgentStateMachine enforces valid state transitions
- [ ] All agents respond to heartbeats within 4 second cycle
- [ ] Agents can send/receive messages via message bus
- [ ] Agents can read/write whiteboards with proper permissions
- [ ] Error handling with retry logic (max 3 retries)
- [ ] AgentPool manages agent lifecycle (create/destroy)
- [ ] CapabilityRegistry validates layer-specific capabilities
- [ ] Performance metrics calculated correctly
- [ ] Unit tests cover >70% of agent code
- [ ] Integration tests verify multi-agent collaboration
- [ ] State transitions logged to database for audit
