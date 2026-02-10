# TODO Task 07: Appeal, Accountability & Election Systems

## Task Position
- **Phase**: Governance
- **Order**: Task 7 of 10

## Task Overview
Implement the remaining governance mechanisms: appeal (for overturning vetoes), accountability (warnings, demotions, dismissals), and election (periodic performance-based evaluation and team optimization). These complete the power balance system.

## Specification Traceability
- **Related Documents**: `specs/05-权力制衡.md`
- **Related Sections**:
  - Power Balance Spec Section 4 "Appeal Mechanism"
  - Power Balance Spec Section 5 "Accountability Mechanism"
  - Power Balance Spec Section 6 "Election Mechanism"
- **Relationship**: This task implements the appeal, accountability, and election mechanisms from Spec 05 Sections 4-6. The appeal system provides recourse for vetoed decisions via top-layer voting. The accountability system enforces consequences for failures (warnings → dismissal). The election system runs every 50 heartbeats to evaluate performance and optimize the team through promotions/demotions.

## TODO Checklist

### 1. Implement Appeal Data Structures
Define types for the appeal process.

**Pseudocode**:
```
interface Appeal {
    id: string
    decisionId: string
    appealerId: string
    arguments: string
    votes: Array<{
        agentId: string
        vote: 'support' | 'oppose'
    }>
    result?: 'success' | 'failed'
    createdAt: number
    resolvedAt?: number
}

interface AppealConfig {
    votingThreshold: number  // e.g., 2/3
    votingTimeout: number    // ms
}
```

### 2. Implement Appeal Module
Create the appeal workflow with voting.

**Pseudocode**:
```
class AppealModule {
    constructor(
        private decisionRepo: DecisionRepository,
        private database: Database,
        private messageBus: MessageBus,
        private config: AppealConfig
    )

    async function createAppeal(
        decisionId: string,
        appealerId: string,
        arguments: string
    ): Promise<Appeal>:
        decision = await this.decisionRepo.get(decisionId)

        if not decision:
            throw new Error(`Decision ${decisionId} not found`)

        if decision.proposerId !== appealerId:
            throw new Error('Only proposer can appeal')

        if decision.status !== DecisionStatus.REJECTED:
            throw new Error('Can only appeal rejected decisions')

        // Create appeal
        appeal = {
            id: generateUUID(),
            decisionId,
            appealerId,
            arguments,
            votes: [],
            createdAt: Date.now()
        }

        // Save to database
        this.database.insert('appeals', appeal)

        // Update decision status
        decision.status = DecisionStatus.APPEALING
        await this.decisionRepo.update(decisionId, { status: decision.status })

        // Request votes from top layer
        topLayerAgents = this.getTopLayerAgents()
        for agent of topLayerAgents:
            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: agent.id,
                type: MessageType.VOTE_REQUEST,
                content: {
                    appeal,
                    decision,
                    deadline: Date.now() + this.config.votingTimeout
                },
                timestamp: Date.now(),
                priority: MessagePriority.URGENT
            })

        console.log(`Appeal ${appeal.id} created for decision ${decisionId}`)

        return appeal

    async function voteOnAppeal(
        appealId: string,
        voterId: string,
        vote: 'support' | 'oppose'
    ): Promise<void>:
        appeal = await this.database.get('appeals', appealId)

        if not appeal:
            throw new Error(`Appeal ${appealId} not found`)

        if appeal.result:
            throw new Error('Appeal already resolved')

        // Check if already voted
        if appeal.votes.some(v => v.agentId === voterId):
            throw new Error(`${voterId} has already voted`)

        // Record vote
        appeal.votes.push({ agentId: voterId, vote })

        // Check if all votes collected
        topLayerCount = 3
        if appeal.votes.length === topLayerCount:
            await this.resolveAppeal(appeal)
        else:
            // Update database
            this.database.update('appeals', appealId, appeal)

    private async function resolveAppeal(appeal: Appeal): Promise<void>:
        supportCount = appeal.votes.filter(v => v.vote === 'support').length
        threshold = Math.ceil(3 * this.config.votingThreshold)  // 2 out of 3

        if supportCount >= threshold:
            // Appeal succeeded
            appeal.result = 'success'
            appeal.resolvedAt = Date.now()

            // Approve original decision
            decision = await this.decisionRepo.get(appeal.decisionId)
            decision.status = DecisionStatus.APPROVED
            decision.approvedAt = Date.now()

            await this.decisionRepo.update(appeal.decisionId, {
                status: decision.status,
                approvedAt: decision.approvedAt
            })

            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: appeal.appealerId,
                type: MessageType.APPEAL_RESULT,
                content: { result: 'success', votes: appeal.votes },
                timestamp: Date.now()
            })

            console.log(`Appeal ${appeal.id} SUCCEEDED (${supportCount}/${threshold})`)
        else:
            // Appeal failed
            appeal.result = 'failed'
            appeal.resolvedAt = Date.now()

            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: appeal.appealerId,
                type: MessageType.APPEAL_RESULT,
                content: { result: 'failed', votes: appeal.votes },
                timestamp: Date.now()
            })

            console.log(`Appeal ${appeal.id} FAILED (${supportCount}/${threshold})`)

        // Update database
        this.database.update('appeals', appeal.id, appeal)
}
```

### 3. Implement Accountability Module
Create warning, demotion, and dismissal logic.

**Pseudocode**:
```
interface AccountabilityConfig {
    warningThreshold: number  // 3 warnings -> dismissal
    failureThreshold: number  // consecutive failures triggering warning
}

class AccountabilityModule {
    constructor(
        private database: Database,
        private messageBus: MessageBus,
        private agentPool: AgentPool,
        private config: AccountabilityConfig
    )

    async function reportFailure(
        taskId: string,
        failureReason: string
    ): Promise<void>:
        // Identify responsible agents
        responsibleAgents = await this.identifyResponsibleAgents(taskId)

        // Issue warnings
        for agentId of responsibleAgents:
            await this.issueWarning(agentId, `Task ${taskId} failed: ${failureReason}`)

    async function issueWarning(agentId: string, reason: string): Promise<void>:
        // Create audit record
        audit = {
            id: generateUUID(),
            task_id: this.currentTaskId,
            agent_id: agentId,
            event_type: 'warning',
            reason,
            created_at: Date.now()
        }

        this.database.insert('audits', audit)

        // Update agent metrics
        agent = await this.database.get('agents', agentId)
        agent.warningsReceived = (agent.warningsReceived || 0) + 1

        // Check for dismissal threshold
        if agent.warningsReceived >= this.config.warningThreshold:
            await this.dismissAgent(agentId, 'Accumulated 3 warnings')
            return

        await this.database.update('agents', agentId, agent)

        // Notify agent
        this.messageBus.sendMessage({
            id: generateUUID(),
            from: 'system',
            to: agentId,
            type: MessageType.WARNING_ISSUE,
            content: { reason, warningsReceived: agent.warningsReceived },
            timestamp: Date.now(),
            priority: MessagePriority.URGENT
        })

        console.log(`Warning issued to ${agentId}: ${reason} (${agent.warningsReceived}/3)`)

    async function demoteAgent(agentId: string, reason: string): Promise<void>:
        agent = this.agentPool.getAgent(agentId)

        if not agent:
            return

        if agent.config.layer === 'bottom':
            // Already at bottom, cannot demote further
            await this.issueWarning(agentId, `Demotion attempted: ${reason}`)
            return

        // Create audit record
        audit = {
            id: generateUUID(),
            task_id: this.currentTaskId,
            agent_id: agentId,
            event_type: 'demotion',
            reason,
            created_at: Date.now()
        }

        this.database.insert('audits', audit)

        // Notify agent
        this.messageBus.sendMessage({
            id: generateUUID(),
            from: 'system',
            to: agentId,
            type: MessageType.DEMOTION_NOTICE,
            content: { reason },
            timestamp: Date.now(),
            priority: MessagePriority.URGENT
        })

        console.log(`Agent ${agentId} demoted: ${reason}`)

        // TODO: Implement actual demotion logic (mid -> bottom)
        // This would involve creating a new bottom-layer agent and
        // transferring responsibilities

    async function dismissAgent(agentId: string, reason: string): Promise<void>:
        // Create audit record
        audit = {
            id: generateUUID(),
            task_id: this.currentTaskId,
            agent_id: agentId,
            event_type: 'dismissal',
            reason,
            created_at: Date.now()
        }

        this.database.insert('audits', audit)

        // Update agent status
        agent = await this.database.get('agents', agentId)
        agent.status = AgentStatus.TERMINATED
        await this.database.update('agents', agentId, agent)

        // Notify supervisor
        if agent.supervisor:
            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: agent.supervisor,
                type: MessageType.DISMISSAL_NOTICE,
                content: { agentId, reason },
                timestamp: Date.now(),
                priority: MessagePriority.URGENT
            })

        console.log(`Agent ${agentId} dismissed: ${reason}`)

        // Destroy agent
        await this.agentPool.destroyAgent(agentId)

        // Trigger replacement
        await this.initiateAgentReplacement(agentId)

    private async function identifyResponsibleAgents(taskId: string): Promise<string[]>:
        // Find task assignment messages
        taskAssignments = await this.database.query('messages', {
            type: MessageType.TASK_ASSIGN,
            'content.task.id': taskId
        })

        assignees = taskAssignments.map(msg => msg.to)

        // Find signers who approved the task
        relatedDecisions = await this.database.query('decisions', {
            'content.taskId': taskId,
            status: DecisionStatus.APPROVED
        })

        signers = relatedDecisions.flatMap(d => d.signers)

        return [...new Set([...assignees, ...signers])]

    private async function initiateAgentReplacement(agentId: string): Promise<void>:
        // This will be implemented with team management in Task 08
        console.log(`Initiating replacement for ${agentId}`)
}
```

### 4. Implement Performance Evaluator
Create performance scoring system for elections.

**Pseudocode**:
```
interface PerformanceScore {
    agentId: string
    tasksCompleted: number
    tasksFailed: number
    successRate: number
    averageResponseTime: number
    collaborationScore: number
    overallScore: number
}

class PerformanceEvaluator {
    function calculateScore(agent: BaseAgent): PerformanceScore:
        metrics = agent.getMetrics()

        // Success rate (40%)
        totalTasks = metrics.tasksCompleted + metrics.tasksFailed
        successRate = totalTasks > 0 ? metrics.tasksCompleted / totalTasks : 1
        successScore = successRate * 40

        // Responsiveness (30%)
        responsiveness = this.calculateResponsiveness(metrics)
        responsivenessScore = responsiveness * 30

        // Reliability (30%)
        totalHeartbeats = metrics.heartbeatsResponded + metrics.heartbeatsMissed
        reliability = totalHeartbeats > 0 ? metrics.heartbeatsResponded / totalHeartbeats : 1
        reliabilityScore = reliability * 30

        overallScore = successScore + responsivenessScore + reliabilityScore

        return {
            agentId: agent.config.id,
            tasksCompleted: metrics.tasksCompleted,
            tasksFailed: metrics.tasksFailed,
            successRate,
            averageResponseTime: metrics.averageTaskDuration,
            collaborationScore: this.calculateCollaborationScore(agent),
            overallScore
        }

    private function calculateResponsiveness(metrics: AgentMetrics): number:
        maxTime = 60000  // 60 seconds
        score = 1 - Math.min(metrics.averageTaskDuration / maxTime, 1)
        return Math.max(score, 0)

    private function calculateCollaborationScore(agent: BaseAgent): number:
        // Based on peer interactions, message response rate, etc.
        // Simplified version returns 0.8
        return 0.8
}
```

### 5. Implement Election Module
Create periodic performance-based elections.

**Pseudocode**:
```
interface ElectionAction {
    agentId: string
    action: 'promote' | 'demote' | 'dismiss' | 'maintain'
}

interface ElectionConfig {
    interval: number  // Heartbeat interval (e.g., 50 heartbeats)
    performanceThresholds: {
        excellent: number  // >= 80: consider promotion
        good: number       // >= 60: maintain
        poor: number       // < 40: dismiss
        failing: number    // < 20: immediate dismissal
    }
}

class ElectionModule {
    constructor(
        private database: Database,
        private agentPool: AgentPool,
        private evaluator: PerformanceEvaluator,
        private accountabilityModule: AccountabilityModule,
        private config: ElectionConfig
    )

    async function triggerElection(
        layer: AgentLayer,
        round: number
    ): Promise<void>:
        console.log(`Election round ${round} for ${layer} layer`)

        agents = this.agentPool.getAgentsByLayer(layer)
        if agents.length === 0:
            return

        // Evaluate all agents
        scores: PerformanceScore[] = []
        for agent of agents:
            score = this.evaluator.calculateScore(agent)
            scores.push(score)

        // Sort by overall score
        scores.sort((a, b) => b.overallScore - a.overallScore)

        // Determine actions
        actions: ElectionAction[] = []

        for score of scores:
            action = this.determineAction(score, layer)
            actions.push({ agentId: score.agentId, action })

        // Execute actions
        for action of actions:
            await this.executeElectionAction(action)

        // Record election results
        await this.database.insert('elections', {
            id: generateUUID(),
            task_id: this.currentTaskId,
            round,
            layer,
            results: JSON.stringify(scores),
            actions: JSON.stringify(actions),
            created_at: Date.now()
        })

        console.log(`Election complete: ${actions.length} actions taken`)

    private function determineAction(
        score: PerformanceScore,
        layer: AgentLayer
    ): ElectionAction['action']:
        thresholds = this.config.performanceThresholds

        if score.overallScore < thresholds.failing:
            return 'dismiss'

        if score.overallScore < thresholds.poor:
            if layer === 'mid':
                return 'demote'
            else:
                return 'dismiss'

        if score.overallScore >= thresholds.excellent:
            if layer === 'bottom':
                return 'promote'
            else:
                return 'maintain'  // Can't promote top layer

        return 'maintain'

    private async function executeElectionAction(action: ElectionAction): Promise<void>:
        switch action.action:
            case 'promote':
                await this.promoteAgent(action.agentId)
                break

            case 'demote':
                await this.accountabilityModule.demoteAgent(
                    action.agentId,
                    'Poor performance in election'
                )
                break

            case 'dismiss':
                await this.accountabilityModule.dismissAgent(
                    action.agentId,
                    'Failing performance in election'
                )
                break

            case 'maintain':
                // No action needed
                break

    private async function promoteAgent(agentId: string): Promise<void>:
        agent = this.agentPool.getAgent(agentId)

        if not agent or agent.config.layer !== 'bottom':
            return

        // Create audit record
        audit = {
            id: generateUUID(),
            task_id: this.currentTaskId,
            agent_id: agentId,
            event_type: 'promotion',
            reason: 'Outstanding performance in election',
            created_at: Date.now()
        }

        this.database.insert('audits', audit)

        // Notify agent
        this.messageBus.sendMessage({
            id: generateUUID(),
            from: 'system',
            to: agentId,
            type: MessageType.PROMOTION_NOTICE,
            content: { newLayer: 'mid' },
            timestamp: Date.now(),
            priority: MessagePriority.HIGH
        })

        console.log(`Agent ${agentId} promoted to mid-layer`)

        // TODO: Implement actual promotion logic
        // Would involve creating new mid-layer agent and transitioning responsibilities
}
```

### 6. Integrate Election Trigger with Message Bus
Schedule elections based on heartbeat count.

**Pseudocode**:
```
class ElectionScheduler {
    private electionModule: ElectionModule
    private electionInterval: number = 50  // heartbeats
    private lastElection: number = 0

    constructor(electionModule: ElectionModule, interval: number):
        this.electionModule = electionModule
        this.electionInterval = interval

    function onHeartbeat(heartbeatNumber: number): void:
        if heartbeatNumber - this.lastElection >= this.electionInterval:
            this.triggerElections(heartbeatNumber)
            this.lastElection = heartbeatNumber

    private async function triggerElections(heartbeatNumber: number): Promise<void>:
        round = Math.floor(heartbeatNumber / this.electionInterval)

        console.log(`Triggering elections at heartbeat #${heartbeatNumber}`)

        // Run elections for each layer
        await this.electionModule.triggerElection('bottom', round)
        await this.electionModule.triggerElection('mid', round)
        // Top layer typically not subject to elections in V1.0
}

// In MessageBus class:
function onHeartbeatTick(heartbeat: number):
    // ... existing logic ...

    // Trigger elections if needed
    this.electionScheduler.onHeartbeat(heartbeat)
```

### 7. Create Governance Statistics Collector
Track governance metrics.

**Pseudocode**:
```
interface GovernanceStats {
    decisions: {
        total: number
        approved: number
        rejected: number
        appealing: number
    }
    appeals: {
        total: number
        successful: number
        failed: number
    }
    accountability: {
        warnings: number
        demotions: number
        dismissals: number
        promotions: number
    }
    elections: {
        totalRounds: number
        totalActions: number
        promotions: number
        demotions: number
        dismissals: number
    }
}

class GovernanceStatsCollector {
    constructor(private database: Database)

    async function getStats(): Promise<GovernanceStats>:
        // Query decisions
        decisionStats = await this.database.query(`
            SELECT status, COUNT(*) as count
            FROM decisions
            GROUP BY status
        `)

        // Query appeals
        appealStats = await this.database.query(`
            SELECT result, COUNT(*) as count
            FROM appeals
            WHERE result IS NOT NULL
            GROUP BY result
        `)

        // Query audits
        auditStats = await this.database.query(`
            SELECT event_type, COUNT(*) as count
            FROM audits
            GROUP BY event_type
        `)

        // Query elections
        electionStats = await this.database.query(`
            SELECT COUNT(*) as count
            FROM elections
        `)

        return this.aggregateStats(decisionStats, appealStats, auditStats, electionStats)
}
```

### 8. Add Governance Event Logger
Log all governance events to audit trail.

**Pseudocode**:
```
class GovernanceEventLogger {
    constructor(
        private database: Database,
        private whiteboardSystem: WhiteboardSystem
    )

    async function logEvent(event: GovernanceEvent): Promise<void>:
        // Log to database
        await this.database.insert('governance_events', {
            id: generateUUID(),
            event_type: event.type,
            agent_id: event.agentId,
            details: JSON.stringify(event.details),
            timestamp: Date.now()
        })

        // Log to global whiteboard for visibility
        await this.whiteboardSystem.append('global', `
### Governance Event: ${event.type}
- **Agent**: ${event.agentId}
- **Time**: ${new Date().toISOString()}
- **Details**: ${JSON.stringify(event.details, null, 2)}
        `, 'system')
}
```

### 9. Complete Governance Engine
Integrate all governance modules.

**Pseudocode**:
```
class GovernanceEngine {
    private signatureModule: SignatureModule
    private vetoModule: VetoModule
    private appealModule: AppealModule
    private accountabilityModule: AccountabilityModule
    private electionModule: ElectionModule
    private electionScheduler: ElectionScheduler
    private statsCollector: GovernanceStatsCollector
    private eventLogger: GovernanceEventLogger

    constructor(/* dependencies */):
        // Initialize all modules (from Task 06 + new modules)
        this.signatureModule = new SignatureModule(...)
        this.vetoModule = new VetoModule(...)
        this.appealModule = new AppealModule(...)
        this.accountabilityModule = new AccountabilityModule(...)
        this.electionModule = new ElectionModule(...)
        this.electionScheduler = new ElectionScheduler(this.electionModule, 50)
        this.statsCollector = new GovernanceStatsCollector(database)
        this.eventLogger = new GovernanceEventLogger(database, whiteboardSystem)

    // === Appeal API ===

    async function appealDecision(
        decisionId: string,
        appealerId: string,
        arguments: string
    ): Promise<Appeal>:
        appeal = await this.appealModule.createAppeal(decisionId, appealerId, arguments)

        this.eventLogger.logEvent({
            type: 'appeal_created',
            agentId: appealerId,
            details: { decisionId, appealId: appeal.id }
        })

        return appeal

    async function voteOnAppeal(appealId: string, voterId: string, vote: 'support' | 'oppose'): Promise<void>:
        await this.appealModule.voteOnAppeal(appealId, voterId, vote)

    // === Accountability API ===

    async function reportFailure(taskId: string, reason: string): Promise<void>:
        await this.accountabilityModule.reportFailure(taskId, reason)

    async function issueWarning(agentId: string, reason: string): Promise<void>:
        await this.accountabilityModule.issueWarning(agentId, reason)

        this.eventLogger.logEvent({
            type: 'warning_issued',
            agentId,
            details: { reason }
        })

    async function dismissAgent(agentId: string, reason: string): Promise<void>:
        await this.accountabilityModule.dismissAgent(agentId, reason)

        this.eventLogger.logEvent({
            type: 'agent_dismissed',
            agentId,
            details: { reason }
        })

    // === Election Trigger (called by MessageBus) ===

    function onHeartbeat(heartbeatNumber: number): void:
        this.electionScheduler.onHeartbeat(heartbeatNumber)

    // === Statistics ===

    async function getGovernanceStats(): Promise<GovernanceStats>:
        return await this.statsCollector.getStats()
}
```

### 10. Write Comprehensive Tests
Test all governance mechanisms.

**Pseudocode**:
```
describe('AppealModule', () => {
    it('should create appeal for rejected decision', async () => {
        const decision = await signatureModule.proposeDecision({...})
        await vetoModule.vetoDecision(decision.id, 'top-1', 'Concerns')

        const appeal = await appealModule.createAppeal(
            decision.id,
            decision.proposerId,
            'Addressed concerns'
        )

        expect(appeal.votes).toHaveLength(0)
        expect(decision.status).toBe(DecisionStatus.APPEALING)
    })

    it('should approve decision if appeal succeeds (2/3 votes)', async () => {
        const appeal = await appealModule.createAppeal(...)

        await appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')
        await appealModule.voteOnAppeal(appeal.id, 'top-2', 'support')
        await appealModule.voteOnAppeal(appeal.id, 'top-3', 'oppose')

        const resolved = await database.get('appeals', appeal.id)
        expect(resolved.result).toBe('success')

        const decision = await decisionRepo.get(appeal.decisionId)
        expect(decision.status).toBe(DecisionStatus.APPROVED)
    })

    it('should reject appeal if insufficient votes', async () => {
        const appeal = await appealModule.createAppeal(...)

        await appealModule.voteOnAppeal(appeal.id, 'top-1', 'support')
        await appealModule.voteOnAppeal(appeal.id, 'top-2', 'oppose')
        await appealModule.voteOnAppeal(appeal.id, 'top-3', 'oppose')

        const resolved = await database.get('appeals', appeal.id)
        expect(resolved.result).toBe('failed')
    })
})

describe('AccountabilityModule', () => {
    it('should issue warning for task failure', async () => {
        await accountabilityModule.reportFailure('task-1', 'Timeout')

        const audits = await database.query('audits', { event_type: 'warning' })
        expect(audits.length).toBeGreaterThan(0)
    })

    it('should dismiss agent after 3 warnings', async () => {
        const agentId = 'bot-1'

        await accountabilityModule.issueWarning(agentId, 'Warning 1')
        await accountabilityModule.issueWarning(agentId, 'Warning 2')
        await accountabilityModule.issueWarning(agentId, 'Warning 3')

        const agent = await database.get('agents', agentId)
        expect(agent.status).toBe(AgentStatus.TERMINATED)

        expect(agentPool.getAgent(agentId)).toBeUndefined()
    })
})

describe('ElectionModule', () => {
    it('should evaluate agent performance', () => {
        const agent = createTestAgent({
            tasksCompleted: 10,
            tasksFailed: 2,
            averageTaskDuration: 30000,
            heartbeatsResponded: 100,
            heartbeatsMissed: 5
        })

        const evaluator = new PerformanceEvaluator()
        const score = evaluator.calculateScore(agent)

        expect(score.successRate).toBeCloseTo(10 / 12, 2)
        expect(score.overallScore).toBeGreaterThan(60)
    })

    it('should promote high-performing bottom agents', async () => {
        const highPerformer = createHighPerformingAgent('bottom')
        agentPool.addAgent(highPerformer)

        await electionModule.triggerElection('bottom', 1)

        const audits = await database.query('audits', {
            agent_id: highPerformer.config.id,
            event_type: 'promotion'
        })

        expect(audits).toHaveLength(1)
    })

    it('should dismiss failing agents', async () => {
        const failingAgent = createFailingAgent('bottom')
        agentPool.addAgent(failingAgent)

        await electionModule.triggerElection('bottom', 1)

        expect(agentPool.getAgent(failingAgent.config.id)).toBeUndefined()
    })

    it('should trigger elections every 50 heartbeats', async () => {
        const scheduler = new ElectionScheduler(electionModule, 50)

        for (let i = 1; i <= 50; i++):
            scheduler.onHeartbeat(i)

        // Should trigger at heartbeat 50
        const elections = await database.query('elections', { round: 1 })
        expect(elections.length).toBeGreaterThan(0)
    })
})

describe('GovernanceEngine Integration', () => {
    it('should handle full governance workflow', async () => {
        const engine = new GovernanceEngine(...)

        // 1. Propose decision
        const decision = await engine.submitDecision({...})

        // 2. Veto
        await engine.vetoDecision(decision.id, 'top-1', 'Concerns')

        // 3. Appeal
        const appeal = await engine.appealDecision(
            decision.id,
            decision.proposerId,
            'Addressed'
        )

        // 4. Vote on appeal
        await engine.voteOnAppeal(appeal.id, 'top-1', 'support')
        await engine.voteOnAppeal(appeal.id, 'top-2', 'support')
        await engine.voteOnAppeal(appeal.id, 'top-3', 'oppose')

        // Verify decision approved
        const final = await decisionRepo.get(decision.id)
        expect(final.status).toBe(DecisionStatus.APPROVED)

        // 5. Report failure
        await engine.reportFailure('task-1', 'Failed')

        // 6. Verify warning issued
        const audits = await database.query('audits', { event_type: 'warning' })
        expect(audits.length).toBeGreaterThan(0)
    })

    it('should collect governance statistics', async () => {
        const stats = await engine.getGovernanceStats()

        expect(stats.decisions.total).toBeGreaterThan(0)
        expect(stats.appeals.total).toBeGreaterThan(0)
        expect(stats.accountability.warnings).toBeGreaterThan(0)
    })
})
```

## Dependencies
- **Prerequisites**: Task 06 (Signature and veto mechanisms)
- **Following Tasks**: Task 08 (Team management uses accountability/election)

## Acceptance Criteria
- [ ] Appeal system allows proposers to challenge vetoed decisions
- [ ] Top-layer agents can vote on appeals (support/oppose)
- [ ] Appeals succeed with 2/3 vote support, approve original decision
- [ ] Accountability module issues warnings for failures
- [ ] 3 warnings result in agent dismissal
- [ ] Election module runs every 50 heartbeats
- [ ] Performance evaluator calculates scores (success rate, responsiveness, reliability)
- [ ] High-performing bottom agents promoted (score >= 80)
- [ ] Failing agents dismissed (score < 40)
- [ ] All governance events logged to audit trail and global whiteboard
- [ ] Governance statistics collector provides comprehensive metrics
- [ ] Unit tests cover >70% of governance code
- [ ] Integration tests verify complete governance workflows
- [ ] Election scheduler properly integrated with message bus heartbeat
- [ ] Dismissed agents are removed from agent pool and replaced
