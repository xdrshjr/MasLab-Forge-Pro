# TODO Task 08: Dynamic Role Generation & Team Management

## Task Position
- **Phase**: Team Management
- **Order**: Task 8 of 10

## Task Overview
Implement the dynamic role generation system that creates task-appropriate agent teams, including requirements clarification (multi-round Q&A), LLM-powered role design, team structure negotiation, and lifecycle management (agent creation, replacement, team dissolution).

## Specification Traceability
- **Related Documents**: `specs/01-架构设计.md`, `specs/06-14-合并规范.md`
- **Related Sections**:
  - Architecture Design Section 2.3 "Dynamic Generation Rules"
  - Architecture Design Section 4.1 "Task Startup Flow"
  - Merged Spec "Spec 06: Dynamic Role Generation"
- **Relationship**: This task implements the dynamic role generation system from Spec 06 and the task startup flow from Architecture Spec Section 4.1. It creates the RequirementManager for multi-round Q&A, TeamManager for generating optimal agent structures based on task context, and handles the complete agent team lifecycle from creation to dissolution.

## TODO Checklist

### 1. Define Task Context Structures
Create types for task requirements and team configuration.

**Pseudocode**:
```
interface TaskContext {
    id: string
    description: string
    type: string  // e.g., "development", "research", "infrastructure"
    requirements: string[]
    constraints: {
        timeline?: string
        resources?: string[]
        preferences?: Record<string, any>
    }
    clarificationHistory: Array<{
        question: string
        answer: string
    }>
    mode: 'auto' | 'semi-auto'
}

interface RoleDefinition {
    name: string
    layer: AgentLayer
    responsibilities: string[]
    capabilities: AgentCapability[]
    signatureAuthority?: string[]  // For top layer
    domain?: string               // For mid layer
    tools?: string[]              // For bottom layer
}

interface TeamStructure {
    topLayer: RoleDefinition[]     // Always 3
    midLayer: RoleDefinition[]     // 2-5
    bottomLayer: RoleDefinition[]  // 4-10+
}
```

### 2. Implement Requirement Manager
Create multi-round Q&A for task clarification.

**Pseudocode**:
```
class RequirementManager {
    private maxRounds: number = 3
    private questionsPerRound: number = 10

    async function clarify(taskDescription: string, mode: 'auto' | 'semi-auto'): Promise<TaskContext>:
        taskContext: TaskContext = {
            id: generateUUID(),
            description: taskDescription,
            type: await this.inferTaskType(taskDescription),
            requirements: [],
            constraints: {},
            clarificationHistory: [],
            mode
        }

        // Multi-round Q&A
        for round in range(this.maxRounds):
            questions = await this.generateQuestions(taskContext, round)

            if mode === 'semi-auto':
                // Interactive mode: ask user
                answers = await this.askUser(questions)
            else:
                // Auto mode: generate reasonable answers
                answers = await this.autoGenerateAnswers(questions, taskContext)

            // Record Q&A
            for i, question of questions.entries():
                taskContext.clarificationHistory.push({
                    question,
                    answer: answers[i]
                })

            // Extract requirements
            newRequirements = await this.extractRequirements(questions, answers)
            taskContext.requirements.push(...newRequirements)

        return taskContext

    private async function inferTaskType(description: string): Promise<string>:
        prompt = `
Analyze this task description and classify it into one of these types:
- "development": Building software, coding, implementing features
- "research": Investigating, analyzing, studying
- "infrastructure": Setting up systems, configuring environments
- "testing": Writing tests, QA, validation
- "documentation": Writing docs, guides, specifications

Task: ${description}

Return only the type name.
        `

        return await this.llm.call(prompt)

    private async function generateQuestions(
        taskContext: TaskContext,
        round: number
    ): Promise<string[]>:
        prompt = `
Based on this task context, generate ${this.questionsPerRound} clarifying questions.

Task: ${taskContext.description}
Type: ${taskContext.type}
Round: ${round + 1}/${this.maxRounds}
Previous Q&A: ${JSON.stringify(taskContext.clarificationHistory)}

Generate questions that help understand:
- Technical requirements
- Constraints and preferences
- Success criteria
- Dependencies

Return as JSON array of strings.
        `

        response = await this.llm.call(prompt)
        return JSON.parse(response)

    private async function askUser(questions: string[]): Promise<string[]>:
        // Integration with TUI or CLI for user input
        // For now, simplified console interaction
        answers = []
        for question of questions:
            answer = await prompt(question)
            answers.push(answer)
        return answers

    private async function autoGenerateAnswers(
        questions: string[],
        taskContext: TaskContext
    ): Promise<string[]>:
        prompt = `
Answer these questions based on reasonable assumptions for this task:

Task: ${taskContext.description}
Type: ${taskContext.type}

Questions:
${questions.map((q, i) => `${i + 1}. ${q}`).join('\n')}

Provide concise, practical answers.
Return as JSON array of strings.
        `

        response = await this.llm.call(prompt)
        return JSON.parse(response)

    private async function extractRequirements(
        questions: string[],
        answers: string[]
    ): Promise<string[]>:
        prompt = `
Extract concrete requirements from these Q&A pairs:

${questions.map((q, i) => `Q: ${q}\nA: ${answers[i]}`).join('\n\n')}

Return requirements as JSON array of strings.
Each requirement should be specific and actionable.
        `

        response = await this.llm.call(prompt)
        return JSON.parse(response)
}
```

### 3. Implement Role Generator
Create LLM-powered role generation for each layer.

**Pseudocode**:
```
class RoleGenerator {
    async function generateTopLayerRoles(taskContext: TaskContext): Promise<RoleDefinition[]>:
        prompt = `
Design three top-layer agent roles for this task, following three-powers separation:

Task Type: ${taskContext.type}
Description: ${taskContext.description}
Requirements: ${taskContext.requirements.join('\n- ')}

Create three roles with distinct responsibilities that balance each other.

For each role, specify:
- name: Clear, descriptive name (e.g., "Technical Planner", "Quality Guardian")
- responsibilities: 3-5 specific duties
- signatureAuthority: Types of decisions they can sign/veto

Return as JSON array of role definitions.
        `

        response = await this.llm.call(prompt)
        roles = JSON.parse(response)

        // Ensure exactly 3 roles
        if roles.length !== 3:
            throw new Error('Must generate exactly 3 top-layer roles')

        // Set layer and capabilities
        return roles.map(role => ({
            ...role,
            layer: 'top' as AgentLayer,
            capabilities: ['plan', 'reflect', 'coordinate', 'delegate', 'arbitrate']
        }))

    async function generateMidLayerRoles(
        taskContext: TaskContext,
        topLayerRoles: RoleDefinition[]
    ): Promise<RoleDefinition[]>:
        // Top layer agents propose mid-layer structure
        proposals = await Promise.all(
            topLayerRoles.map(role => this.proposeMidLayerStructure(role, taskContext))
        )

        // Negotiate and merge proposals
        prompt = `
Three top-layer agents proposed mid-layer structures:

Proposal 1 (${topLayerRoles[0].name}): ${JSON.stringify(proposals[0])}
Proposal 2 (${topLayerRoles[1].name}): ${JSON.stringify(proposals[1])}
Proposal 3 (${topLayerRoles[2].name}): ${JSON.stringify(proposals[2])}

Negotiate a consensus mid-layer structure:
- 2-5 mid-layer roles
- Clear domain responsibility for each (e.g., "backend", "frontend", "testing")
- No overlap between domains
- Complete coverage of task requirements

Return as JSON array of role definitions.
        `

        response = await this.llm.call(prompt)
        roles = JSON.parse(response)

        // Validate count
        if roles.length < 2 or roles.length > 5:
            throw new Error('Mid-layer must have 2-5 roles')

        // Set layer and capabilities
        return roles.map(role => ({
            ...role,
            layer: 'mid' as AgentLayer,
            capabilities: ['plan', 'execute', 'reflect', 'coordinate', 'delegate']
        }))

    private async function proposeMidLayerStructure(
        topRole: RoleDefinition,
        taskContext: TaskContext
    ): Promise<any>:
        prompt = `
As ${topRole.name}, propose a mid-layer team structure for this task:

Task: ${taskContext.description}
Requirements: ${taskContext.requirements.join('\n- ')}

Your role: ${topRole.responsibilities.join('\n- ')}

Propose 2-4 mid-layer roles with domain responsibilities.
Return as JSON array.
        `

        response = await this.llm.call(prompt)
        return JSON.parse(response)

    async function generateBottomLayerRoles(
        midLayerRoles: RoleDefinition[]
    ): Promise<RoleDefinition[]>:
        bottomRoles = []

        for midRole of midLayerRoles:
            // Each mid-layer agent determines bottom-layer needs
            agentCount = this.estimateRequiredAgents(midRole)
            agentCount = Math.min(agentCount, 5)  // Max 5 per mid-layer

            for i in range(agentCount):
                role: RoleDefinition = {
                    name: `${midRole.name}-Agent-${i + 1}`,
                    layer: 'bottom',
                    responsibilities: [`Execute tasks assigned by ${midRole.name}`],
                    capabilities: ['execute', 'tool_call', 'code_gen', 'test_exec'],
                    tools: this.determineTools(midRole.domain)
                }
                bottomRoles.push(role)

        // Validate total count
        if bottomRoles.length > 50:
            throw new Error('Bottom layer exceeds 50 agents limit')

        return bottomRoles

    private function estimateRequiredAgents(midRole: RoleDefinition): number:
        // Estimate based on domain complexity
        complexityMap = {
            'frontend': 3,
            'backend': 4,
            'testing': 2,
            'infrastructure': 2,
            'documentation': 1
        }

        return complexityMap[midRole.domain?.toLowerCase()] || 2

    private function determineTools(domain?: string): string[]:
        toolMap = {
            'frontend': ['file_read', 'file_write', 'bash', 'http_request'],
            'backend': ['file_read', 'file_write', 'bash', 'database_query'],
            'testing': ['file_read', 'bash', 'http_request'],
            'infrastructure': ['bash', 'file_read', 'file_write']
        }

        return toolMap[domain?.toLowerCase()] || ['file_read', 'file_write', 'bash']
}
```

### 4. Implement Team Manager
Create orchestrator for team lifecycle.

**Pseudocode**:
```
class TeamManager {
    constructor(
        private roleGenerator: RoleGenerator,
        private agentPool: AgentPool,
        private governanceEngine: GovernanceEngine,
        private dependencies: AgentDependencies
    )

    async function generateTeam(taskContext: TaskContext): Promise<TeamStructure>:
        console.log(`Generating team for task: ${taskContext.id}`)

        // 1. Generate top layer (3 roles)
        topLayerRoles = await this.roleGenerator.generateTopLayerRoles(taskContext)
        console.log(`Top layer: ${topLayerRoles.map(r => r.name).join(', ')}`)

        // 2. Generate mid layer (2-5 roles)
        midLayerRoles = await this.roleGenerator.generateMidLayerRoles(
            taskContext,
            topLayerRoles
        )
        console.log(`Mid layer: ${midLayerRoles.map(r => r.name).join(', ')}`)

        // 3. Generate bottom layer
        bottomLayerRoles = await this.roleGenerator.generateBottomLayerRoles(midLayerRoles)
        console.log(`Bottom layer: ${bottomLayerRoles.length} agents`)

        teamStructure = {
            topLayer: topLayerRoles,
            midLayer: midLayerRoles,
            bottomLayer: bottomLayerRoles
        }

        // 4. Request approval if semi-auto mode
        if taskContext.mode === 'semi-auto':
            approved = await this.requestUserApproval(teamStructure)
            if not approved:
                // Regenerate or modify
                return await this.generateTeam(taskContext)

        return teamStructure

    async function instantiateTeam(
        taskContext: TaskContext,
        teamStructure: TeamStructure
    ): Promise<Map<string, BaseAgent>>:
        agents = new Map<string, BaseAgent>()

        // 1. Create top layer agents
        for role of teamStructure.topLayer:
            config: AgentConfig = {
                id: generateUUID(),
                name: role.name,
                layer: 'top',
                role: role.responsibilities.join('; '),
                subordinates: [],
                capabilities: role.capabilities,
                config: {
                    maxRetries: 3,
                    timeoutMs: 30000
                }
            }

            agent = await this.agentPool.createAgent(config, this.dependencies)
            agents.set(agent.config.id, agent)

        // 2. Create mid layer agents
        topAgentIds = Array.from(agents.keys())

        for role of teamStructure.midLayer:
            // Assign supervisor (round-robin from top layer)
            supervisorId = topAgentIds[agents.size % topAgentIds.length]

            config: AgentConfig = {
                id: generateUUID(),
                name: role.name,
                layer: 'mid',
                role: role.responsibilities.join('; '),
                supervisor: supervisorId,
                subordinates: [],
                capabilities: role.capabilities,
                config: {
                    maxRetries: 3,
                    timeoutMs: 30000
                }
            }

            agent = await this.agentPool.createAgent(config, this.dependencies)
            agents.set(agent.config.id, agent)

            // Update supervisor's subordinates
            supervisor = agents.get(supervisorId)
            supervisor.config.subordinates.push(agent.config.id)

        // 3. Create bottom layer agents
        midAgentIds = Array.from(agents.values())
            .filter(a => a.config.layer === 'mid')
            .map(a => a.config.id)

        for role of teamStructure.bottomLayer:
            // Determine supervisor from role name
            supervisorId = this.findMidLayerSupervisor(role.name, midAgentIds, agents)

            config: AgentConfig = {
                id: generateUUID(),
                name: role.name,
                layer: 'bottom',
                role: role.responsibilities.join('; '),
                supervisor: supervisorId,
                subordinates: [],
                capabilities: role.capabilities,
                config: {
                    maxRetries: 3,
                    timeoutMs: 30000
                }
            }

            agent = await this.agentPool.createAgent(config, this.dependencies)
            agents.set(agent.config.id, agent)

            // Update supervisor's subordinates
            supervisor = agents.get(supervisorId)
            supervisor.config.subordinates.push(agent.config.id)

        console.log(`Team instantiated: ${agents.size} agents`)

        return agents

    private function findMidLayerSupervisor(
        bottomRoleName: string,
        midAgentIds: string[],
        agents: Map<string, BaseAgent>
    ): string:
        // Parse mid-layer prefix from bottom role name
        // e.g., "Backend-Agent-1" -> find "Backend" mid-layer agent
        prefix = bottomRoleName.split('-')[0]

        for midId of midAgentIds:
            midAgent = agents.get(midId)
            if midAgent.config.name.includes(prefix):
                return midId

        // Fallback: round-robin
        return midAgentIds[0]

    async function replaceAgent(agentId: string): Promise<BaseAgent>:
        oldAgent = this.agentPool.getAgent(agentId)

        if not oldAgent:
            throw new Error(`Agent ${agentId} not found`)

        // Create new agent with same configuration
        newConfig = {
            ...oldAgent.config,
            id: generateUUID(),
            name: `${oldAgent.config.name} (Replacement)`
        }

        newAgent = await this.agentPool.createAgent(newConfig, this.dependencies)

        // Transfer tasks if any
        if oldAgent.currentTask:
            newAgent.currentTask = oldAgent.currentTask

        // Update supervisor's subordinate list
        if oldAgent.config.supervisor:
            supervisor = this.agentPool.getAgent(oldAgent.config.supervisor)
            if supervisor:
                supervisor.config.subordinates = supervisor.config.subordinates.filter(
                    id => id !== agentId
                )
                supervisor.config.subordinates.push(newAgent.config.id)

        console.log(`Agent ${agentId} replaced with ${newAgent.config.id}`)

        return newAgent

    async function dissolveTeam(agents: Map<string, BaseAgent>): Promise<void>:
        console.log(`Dissolving team: ${agents.size} agents`)

        // Shutdown all agents
        for agent of agents.values():
            await agent.shutdown()
            await this.agentPool.destroyAgent(agent.config.id)

        agents.clear()
        console.log('Team dissolved')

    private async function requestUserApproval(teamStructure: TeamStructure): Promise<boolean>:
        // Display team structure to user
        console.log('\n=== Proposed Team Structure ===')
        console.log('Top Layer:')
        for role of teamStructure.topLayer:
            console.log(`  - ${role.name}: ${role.responsibilities.join(', ')}`)

        console.log('Mid Layer:')
        for role of teamStructure.midLayer:
            console.log(`  - ${role.name}: ${role.responsibilities.join(', ')}`)

        console.log(`Bottom Layer: ${teamStructure.bottomLayer.length} agents`)

        // Get user confirmation
        response = await prompt('Approve this team structure? (yes/no): ')
        return response.toLowerCase() === 'yes'
}
```

### 5. Implement Team Validator
Validate generated team structures.

**Pseudocode**:
```
class TeamValidator {
    function validate(teamStructure: TeamStructure): ValidationResult:
        errors = []

        // Validate top layer
        if teamStructure.topLayer.length !== 3:
            errors.push('Top layer must have exactly 3 roles')

        // Validate mid layer
        if teamStructure.midLayer.length < 2 or teamStructure.midLayer.length > 5:
            errors.push('Mid layer must have 2-5 roles')

        // Check for domain overlaps
        domains = teamStructure.midLayer.map(r => r.domain)
        uniqueDomains = new Set(domains)
        if uniqueDomains.size !== domains.length:
            errors.push('Mid layer roles have overlapping domains')

        // Validate bottom layer
        if teamStructure.bottomLayer.length === 0:
            errors.push('Bottom layer must have at least 1 agent')

        if teamStructure.bottomLayer.length > 50:
            errors.push('Bottom layer exceeds maximum 50 agents')

        // Validate capabilities
        for role of [...teamStructure.topLayer, ...teamStructure.midLayer, ...teamStructure.bottomLayer]:
            if not role.capabilities or role.capabilities.length === 0:
                errors.push(`Role ${role.name} has no capabilities`)

        return {
            valid: errors.length === 0,
            errors
        }
}
```

### 6. Create Task Lifecycle Manager
Manage complete task execution lifecycle.

**Pseudocode**:
```
enum TaskLifecycleStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    PAUSED = 'paused',
    COMPLETED = 'completed',
    CANCELLED = 'cancelled',
    FAILED = 'failed'
}

class TaskLifecycleManager {
    private activeTasks: Map<string, {
        context: TaskContext
        team: Map<string, BaseAgent>
        status: TaskLifecycleStatus
    }> = new Map()

    async function startTask(
        taskDescription: string,
        mode: 'auto' | 'semi-auto'
    ): Promise<string>:
        // 1. Clarify requirements
        taskContext = await this.requirementManager.clarify(taskDescription, mode)

        // 2. Generate team
        teamStructure = await this.teamManager.generateTeam(taskContext)

        // 3. Validate
        validation = new TeamValidator().validate(teamStructure)
        if not validation.valid:
            throw new Error(`Invalid team: ${validation.errors.join(', ')}`)

        // 4. Instantiate agents
        team = await this.teamManager.instantiateTeam(taskContext, teamStructure)

        // 5. Save to database
        await this.database.insert('tasks', {
            id: taskContext.id,
            description: taskContext.description,
            status: TaskLifecycleStatus.RUNNING,
            mode: taskContext.mode,
            created_at: Date.now()
        })

        // 6. Register task
        this.activeTasks.set(taskContext.id, {
            context: taskContext,
            team,
            status: TaskLifecycleStatus.RUNNING
        })

        // 7. Start message bus (if not already running)
        this.messageBus.start()

        console.log(`Task ${taskContext.id} started with ${team.size} agents`)

        return taskContext.id

    async function pauseTask(taskId: string): Promise<void>:
        task = this.activeTasks.get(taskId)

        if not task:
            throw new Error(`Task ${taskId} not found`)

        if task.status !== TaskLifecycleStatus.RUNNING:
            throw new Error(`Task ${taskId} is not running`)

        // Pause all agents (implementation depends on Agent API)
        for agent of task.team.values():
            agent.pause()

        task.status = TaskLifecycleStatus.PAUSED

        await this.database.update('tasks', taskId, {
            status: task.status
        })

        console.log(`Task ${taskId} paused`)

    async function resumeTask(taskId: string): Promise<void>:
        task = this.activeTasks.get(taskId)

        if not task:
            throw new Error(`Task ${taskId} not found`)

        if task.status !== TaskLifecycleStatus.PAUSED:
            throw new Error(`Task ${taskId} is not paused`)

        // Resume all agents
        for agent of task.team.values():
            agent.resume()

        task.status = TaskLifecycleStatus.RUNNING

        await this.database.update('tasks', taskId, {
            status: task.status
        })

        console.log(`Task ${taskId} resumed`)

    async function cancelTask(taskId: string): Promise<void>:
        task = this.activeTasks.get(taskId)

        if not task:
            throw new Error(`Task ${taskId} not found`)

        // Dissolve team
        await this.teamManager.dissolveTeam(task.team)

        task.status = TaskLifecycleStatus.CANCELLED

        await this.database.update('tasks', taskId, {
            status: task.status
        })

        this.activeTasks.delete(taskId)

        console.log(`Task ${taskId} cancelled`)

    async function completeTask(taskId: string, result: any): Promise<void>:
        task = this.activeTasks.get(taskId)

        if not task:
            return

        // Dissolve team
        await this.teamManager.dissolveTeam(task.team)

        task.status = TaskLifecycleStatus.COMPLETED

        await this.database.update('tasks', taskId, {
            status: task.status,
            completed_at: Date.now()
        })

        this.activeTasks.delete(taskId)

        console.log(`Task ${taskId} completed`)

    function getTaskStatus(taskId: string): TaskLifecycleStatus:
        task = this.activeTasks.get(taskId)
        return task?.status || TaskLifecycleStatus.PENDING
}
```

### 7. Add Team Visualization
Create utilities to visualize team structure.

**Pseudocode**:
```
class TeamVisualizer {
    function visualize(team: Map<string, BaseAgent>): string:
        output = '\n=== Team Structure ===\n\n'

        // Group by layer
        topAgents = Array.from(team.values()).filter(a => a.config.layer === 'top')
        midAgents = Array.from(team.values()).filter(a => a.config.layer === 'mid')
        bottomAgents = Array.from(team.values()).filter(a => a.config.layer === 'bottom')

        // Top layer
        output += 'Top Layer (3):\n'
        for agent of topAgents:
            output += `  ├─ ${agent.config.name} (${agent.config.id.slice(0, 8)})\n`
            output += `  │  Role: ${agent.config.role}\n`
            output += `  │  Status: ${agent.getStatus()}\n`

        // Mid layer
        output += '\nMid Layer (${midAgents.length}):\n'
        for agent of midAgents:
            output += `  ├─ ${agent.config.name} (${agent.config.id.slice(0, 8)})\n`
            output += `  │  Supervisor: ${agent.config.supervisor?.slice(0, 8)}\n`
            output += `  │  Subordinates: ${agent.config.subordinates.length}\n`
            output += `  │  Status: ${agent.getStatus()}\n`

        // Bottom layer
        output += '\nBottom Layer (${bottomAgents.length}):\n'
        for agent of bottomAgents:
            output += `  ├─ ${agent.config.name} (${agent.config.id.slice(0, 8)})\n`
            output += `  │  Supervisor: ${agent.config.supervisor?.slice(0, 8)}\n`
            output += `  │  Status: ${agent.getStatus()}\n`

        return output

    function generateDiagram(team: Map<string, BaseAgent>): string:
        // Generate ASCII art hierarchy diagram
        // ...implementation...
}
```

### 8. Implement Team Rebalancer
Handle dynamic team adjustments.

**Pseudocode**:
```
class TeamRebalancer {
    async function rebalance(
        team: Map<string, BaseAgent>,
        reason: string
    ): Promise<void>:
        console.log(`Rebalancing team: ${reason}`)

        // Analyze current team structure
        analysis = this.analyzeTeam(team)

        // Identify imbalances
        if analysis.overloadedAgents.length > 0:
            await this.redistributeTasks(analysis.overloadedAgents, team)

        if analysis.idleAgents.length > 0:
            await this.removeIdleAgents(analysis.idleAgents, team)

        if analysis.underStaffedDomains.length > 0:
            await this.addAgentsToDomains(analysis.underStaffedDomains, team)

    private function analyzeTeam(team: Map<string, BaseAgent>): TeamAnalysis:
        overloadedAgents = []
        idleAgents = []
        underStaffedDomains = []

        for agent of team.values():
            metrics = agent.getMetrics()

            // Check workload
            if metrics.taskQueueSize > 10:
                overloadedAgents.push(agent)

            if metrics.tasksCompleted === 0 and metrics.idleTime > 300000:  // 5 min idle
                idleAgents.push(agent)

        return { overloadedAgents, idleAgents, underStaffedDomains }
}
```

### 9. Add Integration with Main SDK
Create unified API for task management.

**Pseudocode**:
```
class AgentTeam {
    private requirementManager: RequirementManager
    private teamManager: TeamManager
    private lifecycleManager: TaskLifecycleManager

    constructor(config: AgentTeamConfig):
        this.requirementManager = new RequirementManager(...)
        this.teamManager = new TeamManager(...)
        this.lifecycleManager = new TaskLifecycleManager(...)

    async function start(taskDescription: string): Promise<TaskResult>:
        // Start task and wait for completion
        taskId = await this.lifecycleManager.startTask(
            taskDescription,
            this.config.mode
        )

        // Wait for completion (or timeout)
        result = await this.waitForCompletion(taskId)

        return result

    async function pause(): Promise<void>:
        await this.lifecycleManager.pauseTask(this.currentTaskId)

    async function resume(): Promise<void>:
        await this.lifecycleManager.resumeTask(this.currentTaskId)

    async function cancel(): Promise<void>:
        await this.lifecycleManager.cancelTask(this.currentTaskId)

    function getStatus(): TeamStatus:
        task = this.lifecycleManager.getActiveTask(this.currentTaskId)

        return {
            taskId: this.currentTaskId,
            status: task.status,
            teamSize: task.team.size,
            agents: this.getAgentStatuses(task.team)
        }
}
```

### 10. Write Comprehensive Tests
Test team generation and management.

**Pseudocode**:
```
describe('RequirementManager', () => {
    it('should clarify task requirements through Q&A', async () => {
        const manager = new RequirementManager()

        const context = await manager.clarify('Create a TODO app', 'auto')

        expect(context.type).toBeDefined()
        expect(context.requirements.length).toBeGreaterThan(0)
        expect(context.clarificationHistory.length).toBeGreaterThan(0)
    })
})

describe('RoleGenerator', () => {
    it('should generate 3 top-layer roles', async () => {
        const generator = new RoleGenerator()

        const roles = await generator.generateTopLayerRoles(mockTaskContext)

        expect(roles).toHaveLength(3)
        roles.forEach(role => {
            expect(role.layer).toBe('top')
            expect(role.capabilities).toContain('arbitrate')
        })
    })

    it('should generate 2-5 mid-layer roles', async () => {
        const generator = new RoleGenerator()

        const roles = await generator.generateMidLayerRoles(mockTaskContext, mockTopRoles)

        expect(roles.length).toBeGreaterThanOrEqual(2)
        expect(roles.length).toBeLessThanOrEqual(5)

        // Check for unique domains
        const domains = roles.map(r => r.domain)
        expect(new Set(domains).size).toBe(domains.length)
    })

    it('should generate bottom-layer roles for each mid-layer', async () => {
        const generator = new RoleGenerator()

        const roles = await generator.generateBottomLayerRoles(mockMidRoles)

        expect(roles.length).toBeGreaterThan(0)
        expect(roles.length).toBeLessThanOrEqual(50)

        roles.forEach(role => {
            expect(role.layer).toBe('bottom')
            expect(role.tools).toBeDefined()
        })
    })
})

describe('TeamManager', () => {
    it('should generate complete team structure', async () => {
        const manager = new TeamManager(...)

        const structure = await manager.generateTeam(mockTaskContext)

        expect(structure.topLayer).toHaveLength(3)
        expect(structure.midLayer.length).toBeGreaterThanOrEqual(2)
        expect(structure.bottomLayer.length).toBeGreaterThan(0)
    })

    it('should instantiate agents with correct hierarchy', async () => {
        const manager = new TeamManager(...)
        const structure = await manager.generateTeam(mockTaskContext)

        const team = await manager.instantiateTeam(mockTaskContext, structure)

        // Verify hierarchy
        const midAgents = Array.from(team.values()).filter(a => a.config.layer === 'mid')
        midAgents.forEach(midAgent => {
            expect(midAgent.config.supervisor).toBeDefined()

            const supervisor = team.get(midAgent.config.supervisor)
            expect(supervisor.config.layer).toBe('top')
            expect(supervisor.config.subordinates).toContain(midAgent.config.id)
        })
    })

    it('should replace failed agents', async () => {
        const manager = new TeamManager(...)
        const failedAgentId = 'bot-1'

        const newAgent = await manager.replaceAgent(failedAgentId)

        expect(newAgent.config.id).not.toBe(failedAgentId)
        expect(newAgent.config.name).toContain('Replacement')
        expect(newAgent.config.layer).toBe('bottom')
    })
})

describe('TaskLifecycleManager', () => {
    it('should start task and create team', async () => {
        const manager = new TaskLifecycleManager(...)

        const taskId = await manager.startTask('Create TODO app', 'auto')

        expect(taskId).toBeDefined()

        const status = manager.getTaskStatus(taskId)
        expect(status).toBe(TaskLifecycleStatus.RUNNING)
    })

    it('should pause and resume tasks', async () => {
        const manager = new TaskLifecycleManager(...)
        const taskId = await manager.startTask('Create TODO app', 'auto')

        await manager.pauseTask(taskId)
        expect(manager.getTaskStatus(taskId)).toBe(TaskLifecycleStatus.PAUSED)

        await manager.resumeTask(taskId)
        expect(manager.getTaskStatus(taskId)).toBe(TaskLifecycleStatus.RUNNING)
    })

    it('should cancel tasks and dissolve team', async () => {
        const manager = new TaskLifecycleManager(...)
        const taskId = await manager.startTask('Create TODO app', 'auto')

        await manager.cancelTask(taskId)

        expect(manager.getTaskStatus(taskId)).toBe(TaskLifecycleStatus.CANCELLED)
        expect(agentPool.getAllAgents()).toHaveLength(0)
    })
})

describe('AgentTeam Integration', () => {
    it('should complete full task workflow', async () => {
        const team = new AgentTeam({ mode: 'auto' })

        const result = await team.start('Create a simple Hello World function')

        expect(result.success).toBe(true)
        expect(result.output).toBeDefined()
    })
})
```

## Dependencies
- **Prerequisites**: Task 05 (Agent base classes), Task 07 (Governance for agent management)
- **Following Tasks**: Task 09 (pi-mono integration needs agent instances)

## Acceptance Criteria
- [ ] RequirementManager conducts multi-round Q&A (3 rounds, 10 questions each)
- [ ] Auto mode generates reasonable answers without user input
- [ ] Semi-auto mode prompts user for answers
- [ ] RoleGenerator creates exactly 3 top-layer roles
- [ ] RoleGenerator creates 2-5 mid-layer roles with unique domains
- [ ] RoleGenerator creates appropriate bottom-layer agents (max 50 total)
- [ ] TeamManager instantiates complete agent hierarchy
- [ ] Supervisors and subordinates properly linked
- [ ] TeamValidator enforces structure constraints
- [ ] TaskLifecycleManager handles start/pause/resume/cancel
- [ ] Agent replacement preserves task continuity
- [ ] Team dissolution cleanly shuts down all agents
- [ ] Team visualizer provides clear hierarchy display
- [ ] Unit tests cover >70% of team management code
- [ ] Integration tests verify end-to-end team creation and execution
