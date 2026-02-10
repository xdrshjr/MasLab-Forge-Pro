# TODO Task 03: Message Bus & Communication System

## Task Position
- **Phase**: Communication & Collaboration
- **Order**: Task 3 of 10

## Task Overview
Implement the heartbeat-based message bus that serves as the central nervous system for agent communication. This includes the message router, queue management, priority handling, and the core 4-second heartbeat mechanism inspired by von Neumann architecture.

## Specification Traceability
- **Related Documents**: `specs/01-架构设计.md`, `specs/03-通信机制.md`
- **Related Sections**:
  - Architecture Design Section 4.2 "Heart

beat Cycle Data Flow"
  - Communication Mechanism Section 2 "Heartbeat Message Bus"
  - Communication Mechanism Section 3 "Message Type System"
- **Relationship**: This task implements the complete message bus architecture from Spec 03, establishing the synchronous heartbeat-driven communication model (冯诺伊曼风格) that enables coordinated agent behavior. It provides the foundation for all agent-to-agent communication patterns.

## TODO Checklist

### 1. Implement Message Data Structures
Define all message types and interfaces.

**Pseudocode**:
```
enum MessageType {
    TASK_ASSIGN = 'task_assign',
    PROGRESS_REPORT = 'progress_report',
    SIGNATURE_REQUEST = 'signature_request',
    SIGNATURE_APPROVE = 'signature_approve',
    SIGNATURE_VETO = 'signature_veto',
    PEER_COORDINATION = 'peer_coordination',
    ERROR_REPORT = 'error_report',
    HEARTBEAT_ACK = 'heartbeat_ack',
    // ... 20+ types total
}

enum MessagePriority {
    LOW = 0,
    NORMAL = 1,
    HIGH = 2,
    URGENT = 3
}

interface Message {
    id: string
    from: string
    to: string  // or 'broadcast'
    type: MessageType
    content: any
    timestamp: number
    priority?: MessagePriority
    replyTo?: string
}

class MessageFactory {
    static createTaskAssign(from, to, task): Message
    static createProgressReport(from, to, report): Message
    static createSignatureRequest(from, to, decision): Message
    static createBroadcast(from, type, content): Message
}
```

### 2. Implement Priority Queue
Create a priority-based message queue for each agent.

**Pseudocode**:
```
class PriorityQueue {
    private queues: Map<MessagePriority, Message[]>

    constructor():
        for priority in MessagePriority:
            this.queues.set(priority, [])

    function enqueue(message: Message):
        priority = message.priority || MessagePriority.NORMAL
        queue = this.queues.get(priority)
        queue.push(message)

    function dequeueAll(): Message[]:
        result = []

        // Dequeue by priority: URGENT -> HIGH -> NORMAL -> LOW
        for priority in [URGENT, HIGH, NORMAL, LOW]:
            queue = this.queues.get(priority)
            result.push(...queue)
            queue.length = 0

        return result

    function size(): number:
        return sum of all queue lengths

    function peek(): Message | undefined:
        for priority in [URGENT, HIGH, NORMAL, LOW]:
            queue = this.queues.get(priority)
            if queue.length > 0:
                return queue[0]
        return undefined
}
```

### 3. Implement Message Router
Create the routing logic for directing messages to appropriate queues.

**Pseudocode**:
```
class MessageRouter {
    private agentQueues: Map<string, PriorityQueue>
    private logger: Logger

    function routeMessage(message: Message):
        if message.to === 'broadcast':
            this.broadcastMessage(message)
        else if message.to === 'system':
            this.handleSystemMessage(message)
        else:
            this.routeToAgent(message)

    private function routeToAgent(message: Message):
        queue = this.agentQueues.get(message.to)

        if not queue:
            this.logger.warn(`Target agent ${message.to} not found`)
            return

        if queue.size() >= MAX_QUEUE_SIZE:
            this.logger.error(`Queue full for agent ${message.to}`)
            this.handleQueueOverflow(message)
            return

        queue.enqueue(message)
        this.logger.debug(`Message routed: ${message.from} -> ${message.to}`)

    private function broadcastMessage(message: Message):
        deliveredCount = 0

        for [agentId, queue] of this.agentQueues:
            if agentId === message.from:
                continue  // Don't send to self

            if queue.size() < MAX_QUEUE_SIZE:
                broadcastCopy = { ...message, to: agentId }
                queue.enqueue(broadcastCopy)
                deliveredCount++

        this.logger.debug(`Broadcast delivered to ${deliveredCount} agents`)

    private function handleSystemMessage(message: Message):
        if message.type === MessageType.HEARTBEAT_ACK:
            // Update agent last seen time
            this.updateAgentHealth(message.from)
}
```

### 4. Implement Heartbeat Clock
Create the core heartbeat mechanism with precise timing.

**Pseudocode**:
```
class HeartbeatClock {
    private interval: number = 4000  // 4 seconds
    private timer: NodeJS.Timer | null = null
    private currentHeartbeat: number = 0
    private listeners: Array<(heartbeat: number) => void> = []
    private isRunning: boolean = false

    function start():
        if this.isRunning:
            throw new Error('HeartbeatClock already running')

        this.isRunning = true
        this.currentHeartbeat = 0

        this.timer = setInterval(() => {
            this.tick()
        }, this.interval)

        console.log(`HeartbeatClock started (interval: ${this.interval}ms)`)

    function stop():
        if this.timer:
            clearInterval(this.timer)
            this.timer = null
            this.isRunning = false

        console.log('HeartbeatClock stopped')

    private function tick():
        this.currentHeartbeat++

        // Notify all listeners (agents)
        for listener of this.listeners:
            try:
                listener(this.currentHeartbeat)
            catch error:
                console.error('Listener error:', error)

    function onHeartbeat(callback: (heartbeat: number) => void):
        this.listeners.push(callback)

    function getCurrentHeartbeat(): number:
        return this.currentHeartbeat

    function getElapsedTime(): number:
        return this.currentHeartbeat * this.interval
}
```

### 5. Implement Message Bus Core
Bring together all components into the main MessageBus class.

**Pseudocode**:
```
class MessageBus {
    private clock: HeartbeatClock
    private router: MessageRouter
    private agentQueues: Map<string, PriorityQueue>
    private agentLastSeen: Map<string, number>
    private database: Database
    private logger: Logger
    private config: MessageBusConfig

    constructor(config: MessageBusConfig, database: Database):
        this.config = config
        this.database = database
        this.logger = createLogger('MessageBus')
        this.agentQueues = new Map()
        this.agentLastSeen = new Map()

        this.clock = new HeartbeatClock(config.heartbeatInterval)
        this.router = new MessageRouter(this.agentQueues, this.logger)

        // Register heartbeat handler
        this.clock.onHeartbeat((heartbeat) => {
            this.onHeartbeatTick(heartbeat)
        })

    // === Lifecycle ===

    function start():
        this.clock.start()
        this.logger.info('MessageBus started')

    function stop():
        this.clock.stop()
        this.logger.info('MessageBus stopped')

    // === Agent Management ===

    function registerAgent(agentId: string):
        if this.agentQueues.has(agentId):
            throw new Error(`Agent ${agentId} already registered`)

        this.agentQueues.set(agentId, new PriorityQueue())
        this.agentLastSeen.set(agentId, this.clock.getCurrentHeartbeat())
        this.logger.info(`Agent ${agentId} registered`)

    function unregisterAgent(agentId: string):
        this.agentQueues.delete(agentId)
        this.agentLastSeen.delete(agentId)
        this.logger.info(`Agent ${agentId} unregistered`)

    // === Message Operations ===

    function sendMessage(message: Message):
        this.validateMessage(message)
        this.router.routeMessage(message)
        this.database.saveMessage(message)

    function getMessages(agentId: string): Message[]:
        queue = this.agentQueues.get(agentId)
        if not queue:
            return []

        messages = queue.dequeueAll()
        return messages

    // === Heartbeat Handling ===

    private function onHeartbeatTick(heartbeat: number):
        this.logger.debug(`Heartbeat #${heartbeat}`)

        // Check for timeout agents
        this.checkTimeouts(heartbeat)

        // Log heartbeat stats
        this.logHeartbeatStats(heartbeat)

    private function checkTimeouts(currentHeartbeat: number):
        timeoutThreshold = this.config.timeoutThreshold || 3
        timeoutAgents = []

        for [agentId, lastSeen] of this.agentLastSeen:
            missedHeartbeats = currentHeartbeat - lastSeen

            if missedHeartbeats > timeoutThreshold:
                timeoutAgents.push(agentId)
                this.logger.warn(
                    `Agent ${agentId} timeout (missed ${missedHeartbeats} heartbeats)`
                )

        if timeoutAgents.length > 0:
            this.emit('agents_timeout', timeoutAgents)

    // === Health Check ===

    function checkAgentHealth(agentId: string): boolean:
        lastSeen = this.agentLastSeen.get(agentId)
        if not lastSeen:
            return false

        currentHeartbeat = this.clock.getCurrentHeartbeat()
        missedHeartbeats = currentHeartbeat - lastSeen
        return missedHeartbeats <= this.config.timeoutThreshold

    // === Stats & Monitoring ===

    function getStats(): MessageBusStats:
        return {
            currentHeartbeat: this.clock.getCurrentHeartbeat(),
            totalAgents: this.agentQueues.size,
            totalQueuedMessages: this.getTotalQueuedMessages(),
            healthyAgents: this.getHealthyAgentCount()
        }

    private function getTotalQueuedMessages(): number:
        total = 0
        for queue of this.agentQueues.values():
            total += queue.size()
        return total
}
```

### 6. Implement Message Validation
Add message format validation and error handling.

**Pseudocode**:
```
class MessageValidator {
    function validate(message: Message): ValidationResult:
        errors = []

        if not message.id:
            errors.push('Message ID is required')

        if not message.from:
            errors.push('Message sender is required')

        if not message.to:
            errors.push('Message recipient is required')

        if not message.type:
            errors.push('Message type is required')

        if not Object.values(MessageType).includes(message.type):
            errors.push(`Invalid message type: ${message.type}`)

        if message.timestamp and message.timestamp > Date.now() + 1000:
            errors.push('Message timestamp is in the future')

        if message.priority and not Object.values(MessagePriority).includes(message.priority):
            errors.push(`Invalid priority: ${message.priority}`)

        return {
            valid: errors.length === 0,
            errors
        }
}
```

### 7. Add Message Statistics Collection
Track message flow for monitoring and debugging.

**Pseudocode**:
```
class MessageStatsCollector {
    private stats = {
        totalMessages: 0,
        messagesByType: new Map<MessageType, number>(),
        messagesByAgent: new Map<string, { sent: number, received: number }>()
    }

    function recordMessage(message: Message):
        this.stats.totalMessages++

        // By type
        count = this.stats.messagesByType.get(message.type) || 0
        this.stats.messagesByType.set(message.type, count + 1)

        // By agent (sent)
        if not this.stats.messagesByAgent.has(message.from):
            this.stats.messagesByAgent.set(message.from, { sent: 0, received: 0 })

        senderStats = this.stats.messagesByAgent.get(message.from)
        senderStats.sent++

        // By agent (received)
        if message.to !== 'broadcast' and message.to !== 'system':
            if not this.stats.messagesByAgent.has(message.to):
                this.stats.messagesByAgent.set(message.to, { sent: 0, received: 0 })

            receiverStats = this.stats.messagesByAgent.get(message.to)
            receiverStats.received++

    function getStats(): MessageStats:
        return {
            ...this.stats,
            messagesByType: Object.fromEntries(this.stats.messagesByType),
            messagesByAgent: Object.fromEntries(this.stats.messagesByAgent)
        }

    function reset():
        this.stats.totalMessages = 0
        this.stats.messagesByType.clear()
        this.stats.messagesByAgent.clear()
}
```

### 8. Implement Request-Response Helper
Add convenience methods for request-response patterns.

**Pseudocode**:
```
class RequestResponseHelper {
    private pendingRequests: Map<string, {
        resolve: (response: any) => void
        reject: (error: any) => void
        timeout: NodeJS.Timeout
    }>

    function sendRequest(
        messageBus: MessageBus,
        from: string,
        to: string,
        type: MessageType,
        content: any,
        timeoutMs: number = 10000
    ): Promise<any>:
        requestId = generateUUID()

        return new Promise((resolve, reject) => {
            // Set timeout
            timeout = setTimeout(() => {
                this.pendingRequests.delete(requestId)
                reject(new Error(`Request timeout: ${to} did not respond`))
            }, timeoutMs)

            // Store request context
            this.pendingRequests.set(requestId, { resolve, reject, timeout })

            // Send request message
            message = {
                id: generateUUID(),
                from,
                to,
                type,
                content: { ...content, requestId },
                timestamp: Date.now()
            }

            messageBus.sendMessage(message)
        })

    function handleResponse(message: Message):
        requestId = message.content.requestId
        pending = this.pendingRequests.get(requestId)

        if not pending:
            return

        clearTimeout(pending.timeout)
        this.pendingRequests.delete(requestId)
        pending.resolve(message.content)
}
```

### 9. Add Message Compression
Implement optional compression for large message payloads.

**Pseudocode**:
```
import zlib from 'zlib'

class MessageCompressor {
    private compressionThreshold: number = 1024  // 1KB

    function compress(message: Message): Message:
        if typeof message.content !== 'string':
            return message

        if message.content.length < this.compressionThreshold:
            return message

        compressed = zlib.gzipSync(message.content)

        return {
            ...message,
            content: compressed.toString('base64'),
            _compressed: true,
            _originalSize: message.content.length
        }

    function decompress(message: Message & { _compressed?: boolean }): Message:
        if not message._compressed:
            return message

        decompressed = zlib.gunzipSync(
            Buffer.from(message.content, 'base64')
        )

        return {
            ...message,
            content: decompressed.toString(),
            _compressed: undefined,
            _originalSize: undefined
        }
}
```

### 10. Write Comprehensive Tests
Test all message bus functionality.

**Pseudocode**:
```
describe('MessageBus', () => {
    it('should start and stop heartbeat clock', async () => {
        const bus = new MessageBus(config, db)

        bus.start()
        expect(bus.getStats().currentHeartbeat).toBe(0)

        await sleep(4500)
        expect(bus.getStats().currentHeartbeat).toBeGreaterThan(0)

        bus.stop()
    })

    it('should deliver point-to-point message', async () => {
        const bus = new MessageBus(config, db)
        bus.start()

        bus.registerAgent('agent-1')
        bus.registerAgent('agent-2')

        const message = MessageFactory.createTaskAssign('agent-1', 'agent-2', mockTask)
        bus.sendMessage(message)

        await sleep(4500)  // Wait for heartbeat

        const messages = bus.getMessages('agent-2')
        expect(messages).toHaveLength(1)
        expect(messages[0].type).toBe(MessageType.TASK_ASSIGN)

        bus.stop()
    })

    it('should broadcast to all agents except sender', async () => {
        const bus = new MessageBus(config, db)
        bus.start()

        bus.registerAgent('agent-1')
        bus.registerAgent('agent-2')
        bus.registerAgent('agent-3')

        const broadcast = MessageFactory.createBroadcast('agent-1', MessageType.ANNOUNCEMENT, { text: 'Hello' })
        bus.sendMessage(broadcast)

        await sleep(4500)

        expect(bus.getMessages('agent-1')).toHaveLength(0)  // Sender doesn't receive
        expect(bus.getMessages('agent-2')).toHaveLength(1)
        expect(bus.getMessages('agent-3')).toHaveLength(1)

        bus.stop()
    })

    it('should prioritize urgent messages', () => {
        const queue = new PriorityQueue()

        queue.enqueue({ priority: MessagePriority.NORMAL, ...msg1 })
        queue.enqueue({ priority: MessagePriority.URGENT, ...msg2 })
        queue.enqueue({ priority: MessagePriority.LOW, ...msg3 })

        const messages = queue.dequeueAll()
        expect(messages[0]).toBe(msg2)  // URGENT first
        expect(messages[1]).toBe(msg1)  // NORMAL second
        expect(messages[2]).toBe(msg3)  // LOW last
    })

    it('should detect agent timeout', async () => {
        const bus = new MessageBus({ ...config, timeoutThreshold: 2 }, db)
        bus.start()

        bus.registerAgent('agent-1')

        const timeoutPromise = new Promise((resolve) => {
            bus.on('agents_timeout', (agents) => {
                resolve(agents)
            })
        })

        // Wait for 3 heartbeats without agent responding
        await sleep(13000)

        const timeoutAgents = await timeoutPromise
        expect(timeoutAgents).toContain('agent-1')

        bus.stop()
    })

    it('should handle queue overflow gracefully', () => {
        const bus = new MessageBus({ ...config, maxQueueSize: 2 }, db)
        bus.registerAgent('agent-1')

        bus.sendMessage(createMessage('agent-1'))  // OK
        bus.sendMessage(createMessage('agent-1'))  // OK
        bus.sendMessage(createMessage('agent-1'))  // Should drop

        const queue = bus.getAgentQueue('agent-1')
        expect(queue.size()).toBe(2)
    })
})

describe('MessageCompressor', () => {
    it('should compress large messages', () => {
        const compressor = new MessageCompressor()
        const largeContent = 'x'.repeat(2000)
        const message = { content: largeContent, ...basemsg }

        const compressed = compressor.compress(message)
        expect(compressed._compressed).toBe(true)
        expect(compressed.content.length).toBeLessThan(largeContent.length)

        const decompressed = compressor.decompress(compressed)
        expect(decompressed.content).toBe(largeContent)
    })
})
```

## Dependencies
- **Prerequisites**: Task 02 (Database for message persistence)
- **Following Tasks**: Task 05 (Agents need message bus to communicate)

## Acceptance Criteria
- [ ] Heartbeat clock triggers exactly every 4 seconds
- [ ] Message routing delivers to correct agent queues
- [ ] Priority queue orders messages: URGENT > HIGH > NORMAL > LOW
- [ ] Broadcast messages delivered to all agents except sender
- [ ] Agent timeout detection working (3 missed heartbeats)
- [ ] All 20+ message types defined and validated
- [ ] Message validation prevents invalid messages
- [ ] Request-response helper supports async communication patterns
- [ ] Message compression reduces large payloads by >50%
- [ ] Statistics collector tracks message flow accurately
- [ ] Unit tests cover >70% of message bus code
- [ ] Integration tests verify end-to-end message delivery
- [ ] Queue overflow handling prevents memory issues
- [ ] System messages (heartbeat_ack) update agent health status
