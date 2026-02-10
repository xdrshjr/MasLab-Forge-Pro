# TODO Task 04: Whiteboard System Implementation

## Task Position
- **Phase**: Communication & Collaboration
- **Order**: Task 4 of 10

## Task Overview
Implement the Markdown-based whiteboard system that serves as the shared knowledge space for all agents. Includes file-based storage, permission model, concurrent access control, and parsing/rendering utilities.

## Specification Traceability
- **Related Documents**: `specs/01-架构设计.md`, `specs/04-白板系统.md`
- **Related Sections**:
  - Architecture Design Section 4.2 "Whiteboard System Component"
  - Whiteboard System Spec Section 2 "Whiteboard File Structure"
  - Whiteboard System Spec Section 4 "Permission Model"
  - Whiteboard System Spec Section 5 "Concurrency Control"
- **Relationship**: This task implements the complete whiteboard system from Spec 04, providing a shared, persistent, human-readable knowledge space using Markdown files. It establishes the layered permission model and file-locking mechanisms that enable safe concurrent access by multiple agents.

## TODO Checklist

### 1. Define Whiteboard Data Structures
Create interfaces and types for whiteboard management.

**Pseudocode**:
```
enum WhiteboardType {
    GLOBAL = 'global',
    TOP_LAYER = 'top',
    MID_LAYER = 'mid',
    BOTTOM_LAYER = 'bottom'
}

interface WhiteboardConfig {
    workspacePath: string
    enableVersioning: boolean
    cacheTimeout: number
}

interface WhiteboardMetadata {
    path: string
    type: WhiteboardType
    ownerId?: string
    version: number
    lastModifiedBy: string
    lastModifiedAt: number
}

interface WhiteboardPath {
    type: WhiteboardType
    ownerId?: string
}
```

### 2. Implement Permission Checker
Create the permission system based on agent layers and ownership.

**Pseudocode**:
```
class WhiteboardPermissionChecker {
    constructor(private agentRegistry: AgentRegistry)

    function canRead(agentId: string, whiteboardPath: WhiteboardPath): boolean:
        agent = this.agentRegistry.getAgent(agentId)
        whiteboard = whiteboardPath

        // Global: all can read
        if whiteboard.type === WhiteboardType.GLOBAL:
            return true

        // Top layer: all can read
        if whiteboard.type === WhiteboardType.TOP_LAYER:
            return true

        // Mid layer whiteboard
        if whiteboard.type === WhiteboardType.MID_LAYER:
            // Top can read all mid whiteboards
            if agent.layer === 'top':
                return true

            // Mid agents can read all mid whiteboards
            if agent.layer === 'mid':
                return true

            // Bottom can only read supervisor's whiteboard
            if agent.layer === 'bottom':
                return agent.supervisor === whiteboard.ownerId

            return false

        // Bottom layer whiteboard
        if whiteboard.type === WhiteboardType.BOTTOM_LAYER:
            // Top and mid can read all bottom whiteboards
            if agent.layer === 'top' or agent.layer === 'mid':
                return true

            // Bottom can only read own whiteboard
            if agent.layer === 'bottom':
                return agent.id === whiteboard.ownerId

            return false

        return false

    function canWrite(agentId: string, whiteboardPath: WhiteboardPath): boolean:
        agent = this.agentRegistry.getAgent(agentId)
        whiteboard = whiteboardPath

        // Global: only top layer can write
        if whiteboard.type === WhiteboardType.GLOBAL:
            return agent.layer === 'top'

        // Top layer: only top agents can write
        if whiteboard.type === WhiteboardType.TOP_LAYER:
            return agent.layer === 'top'

        // Mid layer: only owner can write
        if whiteboard.type === WhiteboardType.MID_LAYER:
            return agent.layer === 'mid' and agent.id === whiteboard.ownerId

        // Bottom layer: only owner can write
        if whiteboard.type === WhiteboardType.BOTTOM_LAYER:
            return agent.layer === 'bottom' and agent.id === whiteboard.ownerId

        return false

    function canAppend(agentId: string, whiteboardPath: WhiteboardPath): boolean:
        agent = this.agentRegistry.getAgent(agentId)
        whiteboard = whiteboardPath

        // Global: top and mid can append
        if whiteboard.type === WhiteboardType.GLOBAL:
            return agent.layer === 'top' or agent.layer === 'mid'

        // For others, same as canWrite
        return this.canWrite(agentId, whiteboardPath)
}
```

### 3. Implement File Lock Manager
Create file-level locking for concurrent access control.

**Pseudocode**:
```
interface FileLock {
    lockId: string
    whiteboardPath: string
    agentId: string
    acquiredAt: number
    expiresAt: number
}

class FileLockManager {
    private locks: Map<string, FileLock> = new Map()
    private lockTimeout: number = 5000  // 5 seconds

    async function acquireLock(
        whiteboardPath: string,
        agentId: string
    ): Promise<string>:
        // Clean up expired locks
        this.cleanupExpiredLocks()

        // Check if already locked
        existingLock = this.locks.get(whiteboardPath)

        if existingLock:
            if existingLock.agentId === agentId:
                // Reentrant lock: extend expiration
                existingLock.expiresAt = Date.now() + this.lockTimeout
                return existingLock.lockId
            else:
                throw new Error(
                    `Whiteboard ${whiteboardPath} is locked by ${existingLock.agentId}`
                )

        // Acquire new lock
        lockId = generateUUID()
        lock = {
            lockId,
            whiteboardPath,
            agentId,
            acquiredAt: Date.now(),
            expiresAt: Date.now() + this.lockTimeout
        }

        this.locks.set(whiteboardPath, lock)
        return lockId

    function releaseLock(lockId: string):
        for [path, lock] of this.locks:
            if lock.lockId === lockId:
                this.locks.delete(path)
                return

    private function cleanupExpiredLocks():
        now = Date.now()
        for [path, lock] of this.locks:
            if lock.expiresAt < now:
                this.locks.delete(path)
                console.warn(`Lock expired: ${path}`)
}
```

### 4. Implement Optimistic Lock Manager
Add version-based optimistic locking.

**Pseudocode**:
```
class OptimisticLockManager {
    private metadata: Map<string, WhiteboardMetadata> = new Map()

    function getVersion(whiteboardPath: string): number:
        meta = this.metadata.get(whiteboardPath)
        return meta?.version || 0

    async function writeWithVersionCheck(
        whiteboardPath: string,
        content: string,
        expectedVersion: number,
        agentId: string
    ): Promise<void>:
        currentVersion = this.getVersion(whiteboardPath)

        if currentVersion !== expectedVersion:
            throw new Error(
                `Version conflict: expected ${expectedVersion}, got ${currentVersion}`
            )

        // Write file
        await fs.writeFile(whiteboardPath, content, 'utf-8')

        // Update metadata
        this.metadata.set(whiteboardPath, {
            path: whiteboardPath,
            version: currentVersion + 1,
            lastModifiedBy: agentId,
            lastModifiedAt: Date.now()
        })

        console.log(`Whiteboard updated: ${whiteboardPath} v${currentVersion + 1}`)

    function getMetadata(whiteboardPath: string): WhiteboardMetadata | undefined:
        return this.metadata.get(whiteboardPath)
}
```

### 5. Create Whiteboard Templates
Define Markdown templates for each whiteboard type.

**Pseudocode**:
```
class WhiteboardTemplates {
    static GLOBAL_TEMPLATE = `
# Global Whiteboard - {taskName}

## Task Overview
- **Task ID**: {taskId}
- **Created**: {timestamp}
- **Mode**: {mode}
- **Status**: {status}

## Core Objectives
1. {objective1}
2. {objective2}

## Key Decisions

## Milestones
- [ ] Milestone 1
- [ ] Milestone 2

## Team Structure

### Top Layer (3)
- {Top Agent 1}: {role}
- {Top Agent 2}: {role}
- {Top Agent 3}: {role}

### Mid Layer
- {Mid Agent 1}: {role}

### Bottom Layer
- {Bot Agent 1}: {task}

## Issues & Risks

## Update Log
`

    static LAYER_TEMPLATE = `
# {layerName} - {roleName}

## Basic Information
- **Agent ID**: {agentId}
- **Role**: {role}
- **Responsibilities**: {responsibilities}
- **Supervisor**: {supervisor}
- **Subordinates**: {subordinates}

## Current Tasks

## Decisions & Negotiations

## Knowledge Base

## Execution Log
`

    static function fillTemplate(template: string, data: Record<string, any>): string:
        result = template
        for [key, value] of Object.entries(data):
            result = result.replace(`{${key}}`, value)
        return result
}
```

### 6. Implement Core Whiteboard System
Create the main WhiteboardSystem class.

**Pseudocode**:
```
class WhiteboardSystem {
    private config: WhiteboardConfig
    private permissionChecker: WhiteboardPermissionChecker
    private lockManager: FileLockManager
    private optimisticLockManager: OptimisticLockManager
    private cache: Map<string, { content: string, cachedAt: number }>

    constructor(config: WhiteboardConfig, agentRegistry: AgentRegistry):
        this.config = config
        this.permissionChecker = new WhiteboardPermissionChecker(agentRegistry)
        this.lockManager = new FileLockManager()
        this.optimisticLockManager = new OptimisticLockManager()
        this.cache = new Map()

        // Create workspace directories
        this.initializeWorkspace()

    private function initializeWorkspace():
        whiteboardsDir = path.join(this.config.workspacePath, 'whiteboards')
        locksDir = path.join(whiteboardsDir, '.locks')

        fs.mkdirSync(whiteboardsDir, { recursive: true })
        fs.mkdirSync(locksDir, { recursive: true })

    // === Read Operations ===

    async function read(
        type: WhiteboardType,
        agentId: string,
        ownerId?: string
    ): Promise<string>:
        whiteboardPath = this.resolveWhiteboardPath(type, ownerId)

        // Permission check
        if not this.permissionChecker.canRead(agentId, { type, ownerId }):
            throw new Error(`Permission denied: ${agentId} cannot read ${whiteboardPath}`)

        // Check cache
        cached = this.cache.get(whiteboardPath)
        if cached and Date.now() - cached.cachedAt < this.config.cacheTimeout:
            return cached.content

        // Read file
        try:
            content = await fs.readFile(whiteboardPath, 'utf-8')
            this.cache.set(whiteboardPath, { content, cachedAt: Date.now() })
            return content
        catch error:
            if error.code === 'ENOENT':
                // File doesn't exist, return template
                return this.getTemplate(type)
            throw error

    // === Write Operations ===

    async function write(
        type: WhiteboardType,
        content: string,
        agentId: string,
        ownerId?: string
    ): Promise<void>:
        whiteboardPath = this.resolveWhiteboardPath(type, ownerId)

        // Permission check
        if not this.permissionChecker.canWrite(agentId, { type, ownerId }):
            throw new Error(`Permission denied: ${agentId} cannot write ${whiteboardPath}`)

        // Acquire lock
        lockId = await this.lockManager.acquireLock(whiteboardPath, agentId)

        try:
            // Optimistic lock write
            currentVersion = this.optimisticLockManager.getVersion(whiteboardPath)
            await this.optimisticLockManager.writeWithVersionCheck(
                whiteboardPath,
                content,
                currentVersion,
                agentId
            )

            // Invalidate cache
            this.cache.delete(whiteboardPath)

            // Emit update event
            this.emit('whiteboard:updated', {
                path: whiteboardPath,
                updatedBy: agentId,
                version: currentVersion + 1
            })

        finally:
            this.lockManager.releaseLock(lockId)

    // === Append Operations ===

    async function append(
        type: WhiteboardType,
        content: string,
        agentId: string,
        ownerId?: string
    ): Promise<void>:
        whiteboardPath = this.resolveWhiteboardPath(type, ownerId)

        // Permission check
        if not this.permissionChecker.canAppend(agentId, { type, ownerId }):
            throw new Error(`Permission denied: ${agentId} cannot append to ${whiteboardPath}`)

        lockId = await this.lockManager.acquireLock(whiteboardPath, agentId)

        try:
            // Read existing content
            existingContent = await this.read(type, agentId, ownerId)

            // Append with timestamp and attribution
            timestamp = new Date().toISOString()
            appendedContent = existingContent + '\n\n' +
                `### Update - ${timestamp}\n` +
                `**By**: ${agentId}\n\n` +
                content

            // Write back
            await this.write(type, appendedContent, agentId, ownerId)

        finally:
            this.lockManager.releaseLock(lockId)

    // === Helper Methods ===

    private function resolveWhiteboardPath(
        type: WhiteboardType,
        ownerId?: string
    ): string:
        whiteboardsDir = path.join(this.config.workspacePath, 'whiteboards')

        switch type:
            case WhiteboardType.GLOBAL:
                return path.join(this.config.workspacePath, 'global-whiteboard.md')

            case WhiteboardType.TOP_LAYER:
                return path.join(whiteboardsDir, 'top-layer.md')

            case WhiteboardType.MID_LAYER:
                if not ownerId:
                    throw new Error('ownerId required for mid-layer whiteboard')
                agent = this.agentRegistry.getAgent(ownerId)
                return path.join(whiteboardsDir, `mid-layer-${agent.role}.md`)

            case WhiteboardType.BOTTOM_LAYER:
                if not ownerId:
                    throw new Error('ownerId required for bottom-layer whiteboard')
                return path.join(whiteboardsDir, `bottom-layer-${ownerId}.md`)

            default:
                throw new Error(`Unknown whiteboard type: ${type}`)

    private function getTemplate(type: WhiteboardType): string:
        switch type:
            case WhiteboardType.GLOBAL:
                return WhiteboardTemplates.GLOBAL_TEMPLATE
            case WhiteboardType.TOP_LAYER:
            case WhiteboardType.MID_LAYER:
            case WhiteboardType.BOTTOM_LAYER:
                return WhiteboardTemplates.LAYER_TEMPLATE
            default:
                return '# Whiteboard\n\n'
}
```

### 7. Implement Markdown Parser
Create utilities to parse whiteboard structure.

**Pseudocode**:
```
import { marked } from 'marked'

interface WhiteboardSection {
    title: string
    level: number
    content: marked.Token[]
}

interface WhiteboardAST {
    sections: WhiteboardSection[]
}

class WhiteboardParser {
    function parse(markdown: string): WhiteboardAST:
        tokens = marked.lexer(markdown)
        sections = this.buildSections(tokens)

        return { sections }

    private function buildSections(tokens: marked.Token[]): WhiteboardSection[]:
        sections = []
        currentSection = null

        for token of tokens:
            if token.type === 'heading':
                if currentSection:
                    sections.push(currentSection)

                currentSection = {
                    title: token.text,
                    level: token.depth,
                    content: []
                }
            else if currentSection:
                currentSection.content.push(token)

        if currentSection:
            sections.push(currentSection)

        return sections

    function extractDecisions(ast: WhiteboardAST): Decision[]:
        decisionsSection = ast.sections.find(s => s.title.includes('Decision'))
        if not decisionsSection:
            return []

        // Parse decision entries
        decisions = []
        // ... parsing logic
        return decisions

    function extractMilestones(ast: WhiteboardAST): Milestone[]:
        milestonesSection = ast.sections.find(s => s.title.includes('Milestone'))
        if not milestonesSection:
            return []

        // Parse milestone list
        milestones = []
        // ... parsing logic
        return milestones
}
```

### 8. Add Version Control (Optional)
Implement whiteboard history tracking.

**Pseudocode**:
```
class WhiteboardVersionControl {
    private maxVersions: number = 10

    async function saveVersion(whiteboardPath: string, content: string): Promise<void>:
        versionDir = path.join(path.dirname(whiteboardPath), 'whiteboard-history')
        await fs.mkdir(versionDir, { recursive: true })

        basename = path.basename(whiteboardPath, '.md')
        timestamp = Date.now()
        versionPath = path.join(versionDir, `${basename}-${timestamp}.md`)

        await fs.writeFile(versionPath, content, 'utf-8')

        // Cleanup old versions
        await this.cleanupOldVersions(versionDir, basename)

    async function listVersions(whiteboardPath: string): Promise<string[]>:
        versionDir = path.join(path.dirname(whiteboardPath), 'whiteboard-history')
        basename = path.basename(whiteboardPath, '.md')

        files = await fs.readdir(versionDir)
        return files
            .filter(f => f.startsWith(basename))
            .sort()
            .reverse()

    async function restoreVersion(whiteboardPath: string, versionFile: string): Promise<void>:
        versionDir = path.join(path.dirname(whiteboardPath), 'whiteboard-history')
        versionPath = path.join(versionDir, versionFile)

        content = await fs.readFile(versionPath, 'utf-8')
        await fs.writeFile(whiteboardPath, content, 'utf-8')

        console.log(`Restored from ${versionFile}`)

    private async function cleanupOldVersions(versionDir: string, basename: string): Promise<void>:
        files = await fs.readdir(versionDir)
        versionFiles = files
            .filter(f => f.startsWith(basename))
            .sort()
            .reverse()

        if versionFiles.length > this.maxVersions:
            toDelete = versionFiles.slice(this.maxVersions)
            for file of toDelete:
                await fs.unlink(path.join(versionDir, file))
}
```

### 9. Implement Whiteboard Renderer
Create text rendering for TUI display.

**Pseudocode**:
```
import chalk from 'chalk'

class WhiteboardRenderer {
    function renderForTUI(markdown: string, maxLines: number = 20): string:
        ast = new WhiteboardParser().parse(markdown)
        output = ''
        lineCount = 0

        for section of ast.sections:
            if lineCount >= maxLines:
                output += chalk.gray('\n... (truncated) ...\n')
                break

            // Render section title
            indent = '  '.repeat(section.level - 1)
            output += chalk.bold.cyan(`\n${indent}${section.title}\n`)
            lineCount++

            // Render section content
            for token of section.content:
                if lineCount >= maxLines:
                    break

                rendered = this.renderToken(token)
                output += rendered
                lineCount += rendered.split('\n').length

        return output

    private function renderToken(token: marked.Token): string:
        switch token.type:
            case 'list':
                return this.renderList(token)
            case 'paragraph':
                return token.text + '\n'
            case 'code':
                return chalk.gray(token.text) + '\n'
            case 'blockquote':
                return chalk.italic.gray('> ' + token.text) + '\n'
            default:
                return ''

    private function renderList(token: marked.Tokens.List): string:
        output = ''
        for item of token.items:
            checkbox = item.checked !== undefined
                ? (item.checked ? chalk.green('✓') : chalk.gray('☐'))
                : '-'
            output += `  ${checkbox} ${item.text}\n'
        return output
}
```

### 10. Write Tests
Test whiteboard system functionality.

**Pseudocode**:
```
describe('WhiteboardSystem', () => {
    it('should create whiteboard from template', async () => {
        const system = new WhiteboardSystem(config, agentRegistry)
        const content = await system.read(WhiteboardType.GLOBAL, 'top-1')

        expect(content).toContain('# Global Whiteboard')
        expect(content).toContain('## Task Overview')
    })

    it('should enforce read permissions', async () => {
        // Bottom agent cannot read other bottom's whiteboard
        await expect(
            system.read(WhiteboardType.BOTTOM_LAYER, 'bot-1', 'bot-2')
        ).rejects.toThrow('Permission denied')
    })

    it('should enforce write permissions', async () => {
        // Mid agent cannot write to global
        await expect(
            system.write(WhiteboardType.GLOBAL, 'content', 'mid-1')
        ).rejects.toThrow('Permission denied')
    })

    it('should handle concurrent writes with locks', async () => {
        const writes = Promise.all([
            system.write(WhiteboardType.GLOBAL, 'Content A', 'top-1'),
            system.write(WhiteboardType.GLOBAL, 'Content B', 'top-2')
        ])

        // Should not throw, writes are serialized
        await expect(writes).resolves.toBeDefined()
    })

    it('should detect version conflicts', async () => {
        await system.write(WhiteboardType.GLOBAL, 'v1', 'top-1')

        // Simulate stale read
        const v0Content = await system.read(WhiteboardType.GLOBAL, 'top-1')

        await system.write(WhiteboardType.GLOBAL, 'v2', 'top-2')

        // Writing based on stale version should fail
        await expect(
            system.optimisticLockManager.writeWithVersionCheck(
                'path',
                'v3',
                0,  // stale version
                'top-1'
            )
        ).rejects.toThrow('Version conflict')
    })

    it('should append with timestamp and attribution', async () => {
        await system.write(WhiteboardType.GLOBAL, 'Initial content', 'top-1')
        await system.append(WhiteboardType.GLOBAL, 'Appended content', 'top-2')

        const content = await system.read(WhiteboardType.GLOBAL, 'top-1')
        expect(content).toContain('Initial content')
        expect(content).toContain('Appended content')
        expect(content).toContain('**By**: top-2')
        expect(content).toMatch(/### Update - \d{4}-\d{2}-\d{2}/)
    })

    it('should cache reads within timeout', async () => {
        const readSpy = jest.spyOn(fs, 'readFile')

        await system.read(WhiteboardType.GLOBAL, 'top-1')
        await system.read(WhiteboardType.GLOBAL, 'top-1')  // Should use cache

        expect(readSpy).toHaveBeenCalledTimes(1)
    })

    it('should invalidate cache on write', async () => {
        await system.read(WhiteboardType.GLOBAL, 'top-1')  // Cache
        await system.write(WhiteboardType.GLOBAL, 'New content', 'top-1')  // Invalidate
        const content = await system.read(WhiteboardType.GLOBAL, 'top-1')  // Re-read

        expect(content).toBe('New content')
    })
})

describe('WhiteboardParser', () => {
    it('should parse markdown into sections', () => {
        const markdown = `
# Section 1
Content 1

## Section 1.1
Content 1.1

# Section 2
Content 2
        `

        const parser = new WhiteboardParser()
        const ast = parser.parse(markdown)

        expect(ast.sections).toHaveLength(3)
        expect(ast.sections[0].title).toBe('Section 1')
        expect(ast.sections[0].level).toBe(1)
    })

    it('should extract milestones from checklist', () => {
        const markdown = `
## Milestones
- [x] Milestone 1
- [ ] Milestone 2
- [ ] Milestone 3
        `

        const parser = new WhiteboardParser()
        const ast = parser.parse(markdown)
        const milestones = parser.extractMilestones(ast)

        expect(milestones[0].completed).toBe(true)
        expect(milestones[1].completed).toBe(false)
    })
})
```

## Dependencies
- **Prerequisites**: Task 01 (Project structure), Task 02 (Database for metadata)
- **Following Tasks**: Task 05 (Agents need whiteboards to collaborate)

## Acceptance Criteria
- [ ] Whiteboard system creates proper directory structure on initialization
- [ ] Global, top, mid, and bottom layer whiteboards supported
- [ ] Permission model enforced: correct read/write permissions by layer
- [ ] File locking prevents concurrent write conflicts
- [ ] Optimistic locking detects version conflicts
- [ ] Markdown templates provided for all whiteboard types
- [ ] Cache improves read performance (hits within timeout period)
- [ ] Cache invalidated on writes
- [ ] Append operation adds timestamped, attributed content
- [ ] Markdown parser extracts structured data (sections, milestones, decisions)
- [ ] Version control saves up to 10 historical versions
- [ ] Unit tests cover >70% of whiteboard code
- [ ] Integration tests verify permission enforcement
- [ ] Rendering produces readable TUI output with syntax highlighting
