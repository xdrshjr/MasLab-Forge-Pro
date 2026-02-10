# TODO Task 02: Database & Logging Infrastructure

## Task Position
- **Phase**: Foundation
- **Order**: Task 2 of 10

## Task Overview
Implement the SQLite database layer with complete schema, ORM wrapper, migrations, and a structured logging system using pino. This provides the persistence and observability foundation for the entire framework.

## Specification Traceability
- **Related Documents**: `specs/01-架构设计.md`, `specs/06-14-合并规范.md`
- **Related Sections**:
  - Architecture Design Section 5.5 "Persistence Strategy (SQLite)"
  - Merged Spec "Spec 08: Database Design"
  - Merged Spec "Spec 09: Logging System"
- **Relationship**: This task implements the complete database schema defined in Spec 08 and the multi-category logging system from Spec 09. It establishes the persistence layer that will be used by all agents, governance mechanisms, and the message bus.

## TODO Checklist

### 1. Set Up SQLite Database Connection
Create a database manager class with connection pooling and error handling.

**Pseudocode**:
```
import Database from 'better-sqlite3'

class DatabaseManager {
    private db: Database.Database

    function initialize(dbPath: string):
        this.db = new Database(dbPath, {
            verbose: console.log,
            fileMustExist: false
        })

        // Enable WAL mode for better concurrency
        this.db.pragma('journal_mode = WAL')
        this.db.pragma('foreign_keys = ON')

        // Run migrations
        this.runMigrations()

    function close():
        if this.db:
            this.db.close()
}
```

### 2. Define Database Schema
Create all tables as specified in the database design spec.

**Pseudocode**:
```
function createSchema(db: Database):
    // Tasks table
    db.exec(`
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            description TEXT NOT NULL,
            status TEXT NOT NULL,
            mode TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            completed_at INTEGER
        )
    `)

    // Agents table
    db.exec(`
        CREATE TABLE IF NOT EXISTS agents (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            name TEXT NOT NULL,
            layer TEXT NOT NULL,
            role TEXT NOT NULL,
            status TEXT NOT NULL,
            supervisor TEXT,
            subordinates TEXT,
            capabilities TEXT,
            metrics TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    `)

    // Messages table
    db.exec(`
        CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            from_agent TEXT NOT NULL,
            to_agent TEXT,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp INTEGER NOT NULL,
            heartbeat_number INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    `)

    // Create indexes
    db.exec(`
        CREATE INDEX IF NOT EXISTS idx_messages_task
        ON messages(task_id);

        CREATE INDEX IF NOT EXISTS idx_messages_agents
        ON messages(from_agent, to_agent);

        CREATE INDEX IF NOT EXISTS idx_messages_heartbeat
        ON messages(heartbeat_number);
    `)

    // Decisions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS decisions (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            proposer_id TEXT NOT NULL,
            type TEXT NOT NULL,
            content TEXT NOT NULL,
            require_signers TEXT NOT NULL,
            signers TEXT NOT NULL,
            vetoers TEXT NOT NULL,
            status TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            approved_at INTEGER,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    `)

    // Audits table
    db.exec(`
        CREATE TABLE IF NOT EXISTS audits (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            agent_id TEXT NOT NULL,
            event_type TEXT NOT NULL,
            reason TEXT NOT NULL,
            related_decision_id TEXT,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    `)

    // Elections table
    db.exec(`
        CREATE TABLE IF NOT EXISTS elections (
            id TEXT PRIMARY KEY,
            task_id TEXT NOT NULL,
            round INTEGER NOT NULL,
            layer TEXT NOT NULL,
            results TEXT NOT NULL,
            actions TEXT NOT NULL,
            created_at INTEGER NOT NULL,
            FOREIGN KEY (task_id) REFERENCES tasks(id)
        )
    `)
```

### 3. Implement ORM Wrapper
Create type-safe CRUD operations for each table.

**Pseudocode**:
```
interface Task {
    id: string
    description: string
    status: 'pending' | 'running' | 'paused' | 'completed' | 'cancelled'
    mode: 'auto' | 'semi-auto'
    created_at: number
    completed_at?: number
}

class TaskRepository {
    constructor(private db: Database)

    function insert(task: Task): void:
        const stmt = this.db.prepare(`
            INSERT INTO tasks (id, description, status, mode, created_at)
            VALUES (?, ?, ?, ?, ?)
        `)
        stmt.run(task.id, task.description, task.status, task.mode, task.created_at)

    function get(id: string): Task | undefined:
        const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?')
        return stmt.get(id) as Task

    function update(id: string, updates: Partial<Task>): void:
        const fields = Object.keys(updates)
        const setClause = fields.map(f => `${f} = ?`).join(', ')
        const values = fields.map(f => updates[f])

        const stmt = this.db.prepare(`UPDATE tasks SET ${setClause} WHERE id = ?`)
        stmt.run(...values, id)

    function query(filters: Partial<Task>): Task[]:
        const conditions = Object.keys(filters).map(k => `${k} = ?`).join(' AND ')
        const values = Object.values(filters)

        const stmt = this.db.prepare(`SELECT * FROM tasks WHERE ${conditions}`)
        return stmt.all(...values) as Task[]
}

// Create similar repositories for:
// - AgentRepository
// - MessageRepository
// - DecisionRepository
// - AuditRepository
// - ElectionRepository
```

### 4. Implement Migration System
Create a simple migration runner for schema updates.

**Pseudocode**:
```
interface Migration {
    version: number
    name: string
    up: (db: Database) => void
    down: (db: Database) => void
}

class MigrationRunner {
    private migrations: Migration[] = []

    function register(migration: Migration):
        this.migrations.push(migration)
        this.migrations.sort((a, b) => a.version - b.version)

    function run(db: Database):
        // Create migrations table
        db.exec(`
            CREATE TABLE IF NOT EXISTS migrations (
                version INTEGER PRIMARY KEY,
                name TEXT NOT NULL,
                applied_at INTEGER NOT NULL
            )
        `)

        // Get current version
        const current = db.prepare(
            'SELECT MAX(version) as version FROM migrations'
        ).get()

        const currentVersion = current?.version || 0

        // Run pending migrations
        for migration in this.migrations:
            if migration.version > currentVersion:
                console.log(`Running migration ${migration.version}: ${migration.name}`)

                db.transaction(() => {
                    migration.up(db)

                    db.prepare(`
                        INSERT INTO migrations (version, name, applied_at)
                        VALUES (?, ?, ?)
                    `).run(migration.version, migration.name, Date.now())
                })()
}

// Usage:
const migrationRunner = new MigrationRunner()
migrationRunner.register({
    version: 1,
    name: 'initial_schema',
    up: createSchema,
    down: (db) => { /* drop tables */ }
})
```

### 5. Set Up Logging System
Implement multi-category logging with pino.

**Pseudocode**:
```
import pino from 'pino'
import fs from 'fs'

class LoggerFactory {
    private logDir: string

    constructor(workspacePath: string):
        this.logDir = path.join(workspacePath, 'logs')
        fs.mkdirSync(this.logDir, { recursive: true })

    function createLogger(category: string): pino.Logger:
        const logFile = path.join(this.logDir, `${category}.log`)

        return pino({
            name: category,
            level: process.env.LOG_LEVEL || 'info',
            transport: {
                targets: [
                    {
                        target: 'pino/file',
                        options: { destination: logFile }
                    },
                    {
                        target: 'pino-pretty',
                        options: {
                            destination: 1,  // stdout
                            colorize: true
                        }
                    }
                ]
            },
            timestamp: pino.stdTimeFunctions.isoTime
        })
}

// Create specialized loggers
const loggerFactory = new LoggerFactory('.agent-workspace')

export const messageBusLogger = loggerFactory.createLogger('message-bus')
export const auditLogger = loggerFactory.createLogger('audit')
export const performanceLogger = loggerFactory.createLogger('performance')
export const errorLogger = loggerFactory.createLogger('error')
export const governanceLogger = loggerFactory.createLogger('governance')
```

### 6. Implement Transaction Support
Add transaction wrapper for atomic operations.

**Pseudocode**:
```
class DatabaseManager {
    function transaction<T>(fn: () => T): T:
        const txn = this.db.transaction(fn)
        return txn()

    function withTransaction<T>(callback: (db: Database) => T): T:
        return this.transaction(() => callback(this.db))
}

// Usage:
dbManager.withTransaction((db) => {
    taskRepo.insert(task)
    agentRepo.insert(agent1)
    agentRepo.insert(agent2)
    // All or nothing
})
```

### 7. Create Audit Logging Helper
Implement structured audit logging for governance events.

**Pseudocode**:
```
interface AuditEvent {
    taskId: string
    agentId: string
    eventType: 'warning' | 'demotion' | 'dismissal' | 'promotion' | 'decision'
    reason: string
    metadata?: Record<string, any>
}

class AuditLogger {
    constructor(
        private auditRepo: AuditRepository,
        private logger: pino.Logger
    )

    function logEvent(event: AuditEvent): void:
        const auditRecord = {
            id: generateUUID(),
            task_id: event.taskId,
            agent_id: event.agentId,
            event_type: event.eventType,
            reason: event.reason,
            created_at: Date.now()
        }

        this.auditRepo.insert(auditRecord)

        this.logger.info({
            event: 'audit',
            ...event
        }, `Audit: ${event.eventType} - ${event.reason}`)

    function queryEvents(filters: {
        taskId?: string
        agentId?: string
        eventType?: string
        startTime?: number
        endTime?: number
    }): AuditRecord[]:
        return this.auditRepo.query(filters)
}
```

### 8. Implement Log Rotation
Set up automatic log file rotation to prevent disk space issues.

**Pseudocode**:
```
import { createWriteStream } from 'fs'
import { createGzip } from 'zlib'

class LogRotationManager {
    private maxFileSize: number = 10 * 1024 * 1024  // 10MB
    private maxFiles: number = 7  // Keep 7 days

    function checkAndRotate(logFile: string): void:
        const stats = fs.statSync(logFile)

        if stats.size > this.maxFileSize:
            const timestamp = Date.now()
            const rotatedFile = `${logFile}.${timestamp}`

            // Rename current log
            fs.renameSync(logFile, rotatedFile)

            // Compress rotated log
            const gzip = createGzip()
            const source = createReadStream(rotatedFile)
            const destination = createWriteStream(`${rotatedFile}.gz`)

            source.pipe(gzip).pipe(destination)

            // Clean up old logs
            this.cleanupOldLogs(path.dirname(logFile))

    function cleanupOldLogs(logDir: string): void:
        const files = fs.readdirSync(logDir)
            .filter(f => f.endsWith('.gz'))
            .map(f => ({
                name: f,
                time: fs.statSync(path.join(logDir, f)).mtime.getTime()
            }))
            .sort((a, b) => b.time - a.time)

        // Delete files beyond max count
        for i from this.maxFiles to files.length:
            fs.unlinkSync(path.join(logDir, files[i].name))
}
```

### 9. Create Database Backup Utility
Implement automated database backup functionality.

**Pseudocode**:
```
class DatabaseBackupManager {
    function backup(dbPath: string, backupDir: string): string:
        const timestamp = new Date().toISOString().replace(/:/g, '-')
        const backupPath = path.join(backupDir, `backup-${timestamp}.db`)

        fs.mkdirSync(backupDir, { recursive: true })
        fs.copyFileSync(dbPath, backupPath)

        console.log(`Database backed up to ${backupPath}`)
        return backupPath

    function restore(backupPath: string, targetPath: string): void:
        if !fs.existsSync(backupPath):
            throw new Error(`Backup file not found: ${backupPath}`)

        fs.copyFileSync(backupPath, targetPath)
        console.log(`Database restored from ${backupPath}`)
}
```

### 10. Write Tests
Create comprehensive tests for database and logging functionality.

**Pseudocode**:
```
describe('DatabaseManager', () => {
    it('should create tables on initialization', () => {
        const db = new DatabaseManager(':memory:')
        db.initialize()

        const tables = db.query("SELECT name FROM sqlite_master WHERE type='table'")
        expect(tables).toContainEqual({ name: 'tasks' })
        expect(tables).toContainEqual({ name: 'agents' })
    })

    it('should support transactions', () => {
        const db = new DatabaseManager(':memory:')

        expect(() => {
            db.withTransaction(() => {
                taskRepo.insert(task1)
                throw new Error('Rollback')
            })
        }).toThrow()

        expect(taskRepo.get(task1.id)).toBeUndefined()
    })
})

describe('TaskRepository', () => {
    it('should insert and retrieve tasks', () => {
        const repo = new TaskRepository(db)
        const task = { id: 'task-1', description: 'Test', ... }

        repo.insert(task)
        const retrieved = repo.get('task-1')

        expect(retrieved).toEqual(task)
    })

    it('should query with filters', () => {
        const results = repo.query({ status: 'running' })
        expect(results.every(t => t.status === 'running')).toBe(true)
    })
})

describe('LoggerFactory', () => {
    it('should create category-specific loggers', () => {
        const factory = new LoggerFactory('/tmp/test')
        const logger = factory.createLogger('test-category')

        logger.info('Test message')

        expect(fs.existsSync('/tmp/test/logs/test-category.log')).toBe(true)
    })
})
```

## Dependencies
- **Prerequisites**: Task 01 (Project initialization must be complete)
- **Following Tasks**: All tasks requiring persistence or logging (Tasks 03-10)

## Acceptance Criteria
- [ ] SQLite database initializes with all required tables
- [ ] All tables have proper indexes for performance
- [ ] Type-safe repository classes for all entities (Task, Agent, Message, Decision, Audit, Election)
- [ ] Transaction support working correctly with rollback on errors
- [ ] Migration system can run schema updates
- [ ] Logging system creates separate log files for each category
- [ ] Log rotation prevents files from growing beyond 10MB
- [ ] Audit logging captures all governance events with structured metadata
- [ ] Database backup and restore utilities working
- [ ] Unit tests cover >70% of database and logging code
- [ ] All database queries use prepared statements (SQL injection safe)
- [ ] Foreign key constraints enforced
