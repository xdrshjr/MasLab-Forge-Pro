# TODO Task 06: Signature & Veto Mechanisms

## Task Position
- **Phase**: Governance
- **Order**: Task 6 of 10

## Task Overview
Implement the signature and veto mechanisms that form the foundation of the power balance system. This includes decision proposal, signature collection, veto rights, and decision lifecycle management.

## Specification Traceability
- **Related Documents**: `specs/05-权力制衡.md`
- **Related Sections**:
  - Power Balance Spec Section 2 "Signature Mechanism"
  - Power Balance Spec Section 3 "Veto Mechanism"
- **Relationship**: This task implements the signature and veto mechanisms from Spec 05, establishing the multi-party approval system that prevents single-point failures in decision-making. It creates the decision lifecycle (propose → sign → approve/veto) with configurable thresholds and provides the foundation for the appeal mechanism in Task 07.

## TODO Checklist

### 1. Define Decision Data Structures
Create types for decisions and signature workflows.

**Pseudocode**:
```
enum DecisionType {
    TECHNICAL_PROPOSAL = 'technical_proposal',
    TASK_ALLOCATION = 'task_allocation',
    RESOURCE_ADJUSTMENT = 'resource_adjustment',
    MILESTONE_CONFIRMATION = 'milestone_confirmation'
}

enum DecisionStatus {
    PENDING = 'pending',
    APPROVED = 'approved',
    REJECTED = 'rejected',
    APPEALING = 'appealing'
}

interface Decision {
    id: string
    proposerId: string
    type: DecisionType
    content: any
    requireSigners: string[]  // Agent IDs who must sign
    signers: string[]         // Agent IDs who have signed
    vetoers: string[]         // Agent IDs who vetoed
    status: DecisionStatus
    createdAt: number
    approvedAt?: number
    rejectedAt?: number
}

interface SignatureConfig {
    thresholds: Map<DecisionType, number>
    defaultThreshold: number
}
```

### 2. Implement Decision Repository
Create database operations for decisions.

**Pseudocode**:
```
class DecisionRepository {
    constructor(private db: Database)

    async function insert(decision: Decision): Promise<void>:
        stmt = this.db.prepare(`
            INSERT INTO decisions (
                id, task_id, proposer_id, type, content,
                require_signers, signers, vetoers, status, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)

        stmt.run(
            decision.id,
            this.currentTaskId,
            decision.proposerId,
            decision.type,
            JSON.stringify(decision.content),
            JSON.stringify(decision.requireSigners),
            JSON.stringify(decision.signers),
            JSON.stringify(decision.vetoers),
            decision.status,
            decision.createdAt
        )

    async function get(id: string): Promise<Decision | undefined>:
        stmt = this.db.prepare('SELECT * FROM decisions WHERE id = ?')
        row = stmt.get(id)

        if not row:
            return undefined

        return this.deserializeDecision(row)

    async function update(id: string, updates: Partial<Decision>): Promise<void>:
        // Build dynamic UPDATE query
        fields = []
        values = []

        for [key, value] of Object.entries(updates):
            if key === 'signers' or key === 'vetoers' or key === 'requireSigners':
                fields.push(`${key} = ?`)
                values.push(JSON.stringify(value))
            else if key === 'content':
                fields.push(`${key} = ?`)
                values.push(JSON.stringify(value))
            else:
                fields.push(`${key} = ?`)
                values.push(value)

        query = `UPDATE decisions SET ${fields.join(', ')} WHERE id = ?`
        values.push(id)

        stmt = this.db.prepare(query)
        stmt.run(...values)

    async function queryByStatus(status: DecisionStatus): Promise<Decision[]>:
        stmt = this.db.prepare('SELECT * FROM decisions WHERE status = ?')
        rows = stmt.all(status)

        return rows.map(row => this.deserializeDecision(row))

    private function deserializeDecision(row: any): Decision:
        return {
            id: row.id,
            proposerId: row.proposer_id,
            type: row.type,
            content: JSON.parse(row.content),
            requireSigners: JSON.parse(row.require_signers),
            signers: JSON.parse(row.signers),
            vetoers: JSON.parse(row.vetoers),
            status: row.status,
            createdAt: row.created_at,
            approvedAt: row.approved_at,
            rejectedAt: row.rejected_at
        }
}
```

### 3. Implement Signature Module
Create the core signature collection logic.

**Pseudocode**:
```
class SignatureModule {
    constructor(
        private decisionRepo: DecisionRepository,
        private messageBus: MessageBus,
        private whiteboardSystem: WhiteboardSystem,
        private config: SignatureConfig
    )

    async function proposeDecision(
        decision: Omit<Decision, 'id' | 'status' | 'signers' | 'vetoers' | 'createdAt'>
    ): Promise<Decision>:
        newDecision: Decision = {
            ...decision,
            id: generateUUID(),
            signers: [],
            vetoers: [],
            status: DecisionStatus.PENDING,
            createdAt: Date.now()
        }

        // Save to database
        await this.decisionRepo.insert(newDecision)

        // Send signature requests
        for signerId of decision.requireSigners:
            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: signerId,
                type: MessageType.SIGNATURE_REQUEST,
                content: { decision: newDecision },
                timestamp: Date.now(),
                priority: MessagePriority.HIGH
            })

        console.log(`Decision ${newDecision.id} proposed by ${newDecision.proposerId}`)

        return newDecision

    async function signDecision(decisionId: string, signerId: string): Promise<void>:
        decision = await this.decisionRepo.get(decisionId)

        if not decision:
            throw new Error(`Decision ${decisionId} not found`)

        // Validate signer authority
        if not decision.requireSigners.includes(signerId):
            throw new Error(`${signerId} is not a required signer`)

        if decision.signers.includes(signerId):
            throw new Error(`${signerId} has already signed`)

        if decision.status !== DecisionStatus.PENDING:
            throw new Error(`Cannot sign decision with status ${decision.status}`)

        // Add signature
        decision.signers.push(signerId)

        // Check if threshold reached
        threshold = this.getSignatureThreshold(decision.type)
        if decision.signers.length >= threshold:
            decision.status = DecisionStatus.APPROVED
            decision.approvedAt = Date.now()

            // Notify proposer
            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: decision.proposerId,
                type: MessageType.SIGNATURE_APPROVE,
                content: { decisionId },
                timestamp: Date.now()
            })

            // Record to global whiteboard
            await this.recordDecisionToWhiteboard(decision)

            console.log(`Decision ${decisionId} APPROVED (${decision.signers.length}/${threshold} signatures)`)
        else:
            console.log(`Decision ${decisionId} signed by ${signerId} (${decision.signers.length}/${threshold})`)

        // Update database
        await this.decisionRepo.update(decisionId, {
            signers: decision.signers,
            status: decision.status,
            approvedAt: decision.approvedAt
        })

    private function getSignatureThreshold(type: DecisionType): number:
        return this.config.thresholds.get(type) || this.config.defaultThreshold

    private async function recordDecisionToWhiteboard(decision: Decision): Promise<void>:
        content = `
### Decision #${decision.id.slice(0, 8)}
- **Type**: ${decision.type}
- **Proposer**: ${decision.proposerId}
- **Status**: ${decision.status}
- **Signers**: ${decision.signers.join(', ')}
- **Approved**: ${new Date(decision.approvedAt!).toISOString()}

**Content**: ${JSON.stringify(decision.content, null, 2)}
        `

        await this.whiteboardSystem.append('global', content, 'system')
}
```

### 4. Implement Veto Module
Create veto logic for rejecting decisions.

**Pseudocode**:
```
class VetoModule {
    constructor(
        private decisionRepo: DecisionRepository,
        private messageBus: MessageBus,
        private auditRepo: AuditRepository
    )

    async function vetoDecision(
        decisionId: string,
        vetoerId: string,
        reason: string
    ): Promise<void>:
        decision = await this.decisionRepo.get(decisionId)

        if not decision:
            throw new Error(`Decision ${decisionId} not found`)

        // Validate veto authority
        if not decision.requireSigners.includes(vetoerId):
            throw new Error(`${vetoerId} is not authorized to veto`)

        if decision.status !== DecisionStatus.PENDING:
            throw new Error(`Cannot veto decision with status ${decision.status}`)

        // Record veto
        decision.vetoers.push(vetoerId)
        decision.status = DecisionStatus.REJECTED
        decision.rejectedAt = Date.now()

        // Update database
        await this.decisionRepo.update(decisionId, {
            vetoers: decision.vetoers,
            status: decision.status,
            rejectedAt: decision.rejectedAt
        })

        // Log to audit
        await this.auditRepo.insert({
            id: generateUUID(),
            task_id: this.currentTaskId,
            agent_id: vetoerId,
            event_type: 'veto',
            reason: reason,
            related_decision_id: decisionId,
            created_at: Date.now()
        })

        // Notify proposer
        this.messageBus.sendMessage({
            id: generateUUID(),
            from: 'system',
            to: decision.proposerId,
            type: MessageType.SIGNATURE_VETO,
            content: {
                decisionId,
                vetoer: vetoerId,
                reason
            },
            timestamp: Date.now(),
            priority: MessagePriority.HIGH
        })

        console.log(`Decision ${decisionId} VETOED by ${vetoerId}: ${reason}`)
}
```

### 5. Implement Decision Validator
Add validation logic for decision content.

**Pseudocode**:
```
class DecisionValidator {
    function validate(decision: Partial<Decision>): ValidationResult:
        errors = []

        if not decision.proposerId:
            errors.push('Proposer ID is required')

        if not decision.type:
            errors.push('Decision type is required')

        if not Object.values(DecisionType).includes(decision.type):
            errors.push(`Invalid decision type: ${decision.type}`)

        if not decision.content:
            errors.push('Decision content is required')

        if not decision.requireSigners or decision.requireSigners.length === 0:
            errors.push('At least one required signer must be specified')

        // Type-specific validation
        switch decision.type:
            case DecisionType.TECHNICAL_PROPOSAL:
                if not decision.content.proposal:
                    errors.push('Technical proposal content is required')
                break

            case DecisionType.TASK_ALLOCATION:
                if not decision.content.taskId or not decision.content.assignee:
                    errors.push('Task ID and assignee are required')
                break

            case DecisionType.RESOURCE_ADJUSTMENT:
                if not decision.content.adjustment:
                    errors.push('Resource adjustment details are required')
                break

            case DecisionType.MILESTONE_CONFIRMATION:
                if not decision.content.milestone:
                    errors.push('Milestone information is required')
                break

        return {
            valid: errors.length === 0,
            errors
        }
}
```

### 6. Implement Signature Timeout Handler
Add automatic timeout for pending signatures.

**Pseudocode**:
```
class SignatureTimeoutHandler {
    private timeouts: Map<string, NodeJS.Timeout> = new Map()
    private defaultTimeout: number = 300000  // 5 minutes

    function scheduleTimeout(
        decisionId: string,
        callback: () => void,
        timeoutMs?: number
    ): void:
        timeout = setTimeout(() => {
            this.handleTimeout(decisionId)
            callback()
        }, timeoutMs || this.defaultTimeout)

        this.timeouts.set(decisionId, timeout)

    function cancelTimeout(decisionId: string): void:
        timeout = this.timeouts.get(decisionId)
        if timeout:
            clearTimeout(timeout)
            this.timeouts.delete(decisionId)

    private async function handleTimeout(decisionId: string): Promise<void>:
        decision = await this.decisionRepo.get(decisionId)

        if decision and decision.status === DecisionStatus.PENDING:
            console.warn(`Decision ${decisionId} timed out`)

            // Auto-reject
            decision.status = DecisionStatus.REJECTED
            decision.rejectedAt = Date.now()

            await this.decisionRepo.update(decisionId, {
                status: decision.status,
                rejectedAt: decision.rejectedAt
            })

            // Notify proposer
            this.messageBus.sendMessage({
                id: generateUUID(),
                from: 'system',
                to: decision.proposerId,
                type: MessageType.SIGNATURE_VETO,
                content: {
                    decisionId,
                    reason: 'Signature timeout'
                },
                timestamp: Date.now()
            })
}
```

### 7. Create Signature Reminder System
Send reminders to agents who haven't signed.

**Pseudocode**:
```
class SignatureReminderSystem {
    private reminderInterval: number = 60000  // 1 minute

    function startReminders(decisionId: string): void:
        interval = setInterval(async () => {
            decision = await this.decisionRepo.get(decisionId)

            if not decision or decision.status !== DecisionStatus.PENDING:
                clearInterval(interval)
                return

            // Find agents who haven't signed
            pendingSigners = decision.requireSigners.filter(
                id => not decision.signers.includes(id) and not decision.vetoers.includes(id)
            )

            // Send reminders
            for signerId of pendingSigners:
                this.messageBus.sendMessage({
                    id: generateUUID(),
                    from: 'system',
                    to: signerId,
                    type: MessageType.SIGNATURE_REQUEST,
                    content: {
                        decision,
                        reminder: true,
                        waitingFor: pendingSigners.length
                    },
                    timestamp: Date.now(),
                    priority: MessagePriority.HIGH
                })

        }, this.reminderInterval)
}
```

### 8. Implement Decision Query Helper
Create utilities for querying decisions.

**Pseudocode**:
```
class DecisionQueryHelper {
    constructor(private decisionRepo: DecisionRepository)

    async function getPendingDecisionsForAgent(agentId: string): Promise<Decision[]>:
        allPending = await this.decisionRepo.queryByStatus(DecisionStatus.PENDING)

        return allPending.filter(d =>
            d.requireSigners.includes(agentId) and
            not d.signers.includes(agentId) and
            not d.vetoers.includes(agentId)
        )

    async function getDecisionsByProposer(proposerId: string): Promise<Decision[]>:
        // Query database for all decisions by proposer
        stmt = this.db.prepare('SELECT * FROM decisions WHERE proposer_id = ?')
        rows = stmt.all(proposerId)

        return rows.map(row => this.decisionRepo.deserializeDecision(row))

    async function getRecentDecisions(limit: number = 10): Promise<Decision[]>:
        stmt = this.db.prepare(`
            SELECT * FROM decisions
            ORDER BY created_at DESC
            LIMIT ?
        `)
        rows = stmt.all(limit)

        return rows.map(row => this.decisionRepo.deserializeDecision(row))

    async function getDecisionStats(): Promise<DecisionStats>:
        stmt = this.db.prepare(`
            SELECT
                status,
                COUNT(*) as count
            FROM decisions
            GROUP BY status
        `)
        rows = stmt.all()

        stats = {
            total: 0,
            pending: 0,
            approved: 0,
            rejected: 0,
            appealing: 0
        }

        for row of rows:
            stats[row.status] = row.count
            stats.total += row.count

        return stats
}
```

### 9. Add Governance Engine Integration
Integrate signature and veto modules into governance engine.

**Pseudocode**:
```
class GovernanceEngine {
    private signatureModule: SignatureModule
    private vetoModule: VetoModule
    private timeoutHandler: SignatureTimeoutHandler
    private reminderSystem: SignatureReminderSystem

    constructor(
        database: Database,
        messageBus: MessageBus,
        whiteboardSystem: WhiteboardSystem,
        config: GovernanceConfig
    ):
        this.signatureModule = new SignatureModule(
            new DecisionRepository(database),
            messageBus,
            whiteboardSystem,
            config.signatureConfig
        )

        this.vetoModule = new VetoModule(
            new DecisionRepository(database),
            messageBus,
            new AuditRepository(database)
        )

        this.timeoutHandler = new SignatureTimeoutHandler()
        this.reminderSystem = new SignatureReminderSystem()

    // === Public API ===

    async function submitDecision(decision: Partial<Decision>): Promise<Decision>:
        // Validate
        validation = new DecisionValidator().validate(decision)
        if not validation.valid:
            throw new Error(`Invalid decision: ${validation.errors.join(', ')}`)

        // Propose
        newDecision = await this.signatureModule.proposeDecision(decision)

        // Schedule timeout
        this.timeoutHandler.scheduleTimeout(newDecision.id, () => {
            console.log(`Decision ${newDecision.id} timed out`)
        })

        // Start reminders
        this.reminderSystem.startReminders(newDecision.id)

        return newDecision

    async function signDecision(decisionId: string, signerId: string): Promise<void>:
        await this.signatureModule.signDecision(decisionId, signerId)

        // Cancel timeout if approved
        decision = await this.decisionRepo.get(decisionId)
        if decision.status === DecisionStatus.APPROVED:
            this.timeoutHandler.cancelTimeout(decisionId)

    async function vetoDecision(
        decisionId: string,
        vetoerId: string,
        reason: string
    ): Promise<void>:
        await this.vetoModule.vetoDecision(decisionId, vetoerId, reason)

        // Cancel timeout
        this.timeoutHandler.cancelTimeout(decisionId)
}
```

### 10. Write Comprehensive Tests
Test signature and veto functionality.

**Pseudocode**:
```
describe('SignatureModule', () => {
    it('should propose decision and request signatures', async () => {
        const module = new SignatureModule(repo, bus, whiteboard, config)

        const decision = await module.proposeDecision({
            proposerId: 'agent-1',
            type: DecisionType.TECHNICAL_PROPOSAL,
            content: { proposal: 'Use React' },
            requireSigners: ['top-1', 'top-2']
        })

        expect(decision.status).toBe(DecisionStatus.PENDING)
        expect(decision.signers).toHaveLength(0)

        // Verify signature requests sent
        const top1Messages = bus.getMessages('top-1')
        expect(top1Messages.some(m => m.type === MessageType.SIGNATURE_REQUEST)).toBe(true)
    })

    it('should approve decision when threshold reached', async () => {
        const module = new SignatureModule(repo, bus, whiteboard, {
            thresholds: new Map([[DecisionType.TECHNICAL_PROPOSAL, 2]]),
            defaultThreshold: 2
        })

        const decision = await module.proposeDecision({
            proposerId: 'agent-1',
            type: DecisionType.TECHNICAL_PROPOSAL,
            content: { proposal: 'Use React' },
            requireSigners: ['top-1', 'top-2']
        })

        await module.signDecision(decision.id, 'top-1')
        let updated = await repo.get(decision.id)
        expect(updated.status).toBe(DecisionStatus.PENDING)

        await module.signDecision(decision.id, 'top-2')
        updated = await repo.get(decision.id)
        expect(updated.status).toBe(DecisionStatus.APPROVED)
    })

    it('should prevent duplicate signatures', async () => {
        const module = new SignatureModule(repo, bus, whiteboard, config)
        const decision = await module.proposeDecision({...})

        await module.signDecision(decision.id, 'top-1')

        await expect(
            module.signDecision(decision.id, 'top-1')
        ).rejects.toThrow('has already signed')
    })

    it('should prevent unauthorized agents from signing', async () => {
        const module = new SignatureModule(repo, bus, whiteboard, config)
        const decision = await module.proposeDecision({
            requireSigners: ['top-1', 'top-2']
        })

        await expect(
            module.signDecision(decision.id, 'top-3')
        ).rejects.toThrow('not a required signer')
    })
})

describe('VetoModule', () => {
    it('should veto decision and update status', async () => {
        const module = new VetoModule(repo, bus, auditRepo)

        const decision = await signatureModule.proposeDecision({
            requireSigners: ['top-1', 'top-2']
        })

        await module.vetoDecision(decision.id, 'top-1', 'Technical concerns')

        const updated = await repo.get(decision.id)
        expect(updated.status).toBe(DecisionStatus.REJECTED)
        expect(updated.vetoers).toContain('top-1')
    })

    it('should record veto in audit log', async () => {
        const module = new VetoModule(repo, bus, auditRepo)
        const decision = await signatureModule.proposeDecision({...})

        await module.vetoDecision(decision.id, 'top-1', 'Risk too high')

        const audits = await auditRepo.query({ event_type: 'veto' })
        expect(audits).toHaveLength(1)
        expect(audits[0].agent_id).toBe('top-1')
        expect(audits[0].reason).toBe('Risk too high')
    })

    it('should notify proposer of veto', async () => {
        const module = new VetoModule(repo, bus, auditRepo)
        const decision = await signatureModule.proposeDecision({
            proposerId: 'mid-1',
            requireSigners: ['top-1']
        })

        await module.vetoDecision(decision.id, 'top-1', 'Not ready')

        const messages = bus.getMessages('mid-1')
        expect(messages.some(m =>
            m.type === MessageType.SIGNATURE_VETO and
            m.content.reason === 'Not ready'
        )).toBe(true)
    })
})

describe('SignatureTimeoutHandler', () => {
    it('should auto-reject decision on timeout', async () => {
        const handler = new SignatureTimeoutHandler()
        const decision = await signatureModule.proposeDecision({...})

        handler.scheduleTimeout(decision.id, () => {}, 100)  // 100ms timeout

        await sleep(150)

        const updated = await repo.get(decision.id)
        expect(updated.status).toBe(DecisionStatus.REJECTED)
    })

    it('should cancel timeout when decision approved', async () => {
        const handler = new SignatureTimeoutHandler()
        const decision = await signatureModule.proposeDecision({...})

        handler.scheduleTimeout(decision.id, () => {}, 1000)

        await signatureModule.signDecision(decision.id, 'top-1')
        await signatureModule.signDecision(decision.id, 'top-2')  // Approved

        handler.cancelTimeout(decision.id)

        await sleep(1100)

        const updated = await repo.get(decision.id)
        expect(updated.status).toBe(DecisionStatus.APPROVED)  // Not auto-rejected
    })
})

describe('GovernanceEngine', () => {
    it('should integrate signature and veto modules', async () => {
        const engine = new GovernanceEngine(db, bus, whiteboard, config)

        const decision = await engine.submitDecision({
            proposerId: 'mid-1',
            type: DecisionType.TASK_ALLOCATION,
            content: { taskId: 'task-1', assignee: 'bot-1' },
            requireSigners: ['top-1', 'mid-1']
        })

        expect(decision.status).toBe(DecisionStatus.PENDING)

        await engine.signDecision(decision.id, 'top-1')
        await engine.signDecision(decision.id, 'mid-1')

        const updated = await repo.get(decision.id)
        expect(updated.status).toBe(DecisionStatus.APPROVED)
    })
})
```

## Dependencies
- **Prerequisites**: Task 02 (Database), Task 03 (Message bus), Task 04 (Whiteboard), Task 05 (Agents)
- **Following Tasks**: Task 07 (Appeal mechanism builds on signature/veto)

## Acceptance Criteria
- [ ] Decision proposal creates pending decision with required signers
- [ ] Signature collection updates decision state correctly
- [ ] Decision approved when signature threshold reached (2/3 for most decisions)
- [ ] Veto immediately rejects decision and records reason
- [ ] Timeout handler auto-rejects decisions after 5 minutes
- [ ] Reminder system sends periodic reminders to pending signers
- [ ] Decision validator enforces type-specific requirements
- [ ] All decisions recorded in database with full audit trail
- [ ] Approved decisions logged to global whiteboard
- [ ] Proposer notified of approval/veto via message bus
- [ ] Unit tests cover >70% of signature and veto code
- [ ] Integration tests verify multi-agent signature workflows
- [ ] Cannot sign decision after it's approved/rejected
- [ ] Cannot sign without authority (must be in requireSigners list)
- [ ] Governance engine properly integrates all modules
