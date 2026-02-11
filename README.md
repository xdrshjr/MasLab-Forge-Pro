<div align="center">
  <img src="./2026-02-11-magf-logo.png" alt="MAGF Logo" width="200" height="200">
</div>

# Multi-Agent Governance Framework (MAGF)

> A TypeScript framework for building intelligent multi-agent systems with built-in governance mechanisms, inspired by political science principles of checks and balances.

[![Status](https://img.shields.io/badge/status-early%20development-yellow)](https://github.com/your-org/magf)
[![Version](https://img.shields.io/badge/version-0.1.0-blue)](https://github.com/your-org/magf)
[![License](https://img.shields.io/badge/license-MIT-green)](./LICENSE)

## What is MAGF?

MAGF (Multi-Agent Governance Framework) is a framework for orchestrating teams of AI agents that work together to solve complex tasks. Unlike traditional multi-agent systems with fixed roles, MAGF implements a **dynamic governance model** where:

- **Roles are generated on-demand** based on task requirements (not hardcoded as "architect", "developer", "tester")
- **Agents operate in a three-tier hierarchy** with clear responsibilities and accountability
- **Governance mechanisms prevent chaos** through signature requirements, veto power, appeals, and performance-based elections
- **Communication is synchronized** via a heartbeat-driven message bus (like a CPU clock cycle)
- **Knowledge is shared** through a whiteboard system that all agents can read and write to

**Use Cases:**
- Building complex software projects with AI agent teams
- Research tasks requiring multiple specialized perspectives
- Content creation with review and quality control workflows
- Any task that benefits from division of labor with oversight

**Current Status:** Early development (v0.1.0) - Core infrastructure (types, persistence, logging) is complete. Agent runtime, message bus, and governance engine are in active development.

## 🌟 Key Features

- **Three-Tier Governance Architecture**: Top (strategic), Mid (tactical), Bottom (operational) layers with clear separation of concerns
- **Five Power Balance Mechanisms**: Signature requirements, veto power, appeal process, accountability system, and performance-based elections
- **Dynamic Role Generation**: AI-driven role assignment based on task context (not hardcoded roles)
- **Heartbeat Message Bus**: Synchronized communication with 4-second intervals for predictable behavior
- **Whiteboard System**: Markdown-based shared knowledge space with layer-specific permissions
- **Full TypeScript Support**: Type-safe APIs with comprehensive type definitions and strict mode
- **SQLite Persistence**: Complete task history, agent metrics, decisions, and audit trails
- **Structured Logging**: Category-based logging with pino for debugging and monitoring

## 🧠 How It Works

### 1. Task Initialization

When you start a task, MAGF creates a three-tier team of AI agents:

```
Top Layer (3 agents)    → Strategic oversight, conflict resolution, quality control
Mid Layer (2-5 agents)  → Domain coordination, task breakdown, progress tracking
Bottom Layer (4-5 agents) → Actual execution, tool usage, result generation
```

**Example:** For a task like "Build a REST API", the system might generate:
- **Top Layer**: System Architect, Quality Auditor, Project Arbitrator
- **Mid Layer**: Backend Coordinator, Database Coordinator, Testing Coordinator
- **Bottom Layer**: Route Builder, Schema Designer, Test Writer, Documentation Writer

### 2. Heartbeat Synchronization

<thinking>
Good, I'm adding detailed explanation of how the system works. Let me continue with the heartbeat explanation.
</thinking>

All agents operate on a synchronized 4-second heartbeat cycle:

```
Heartbeat 1 (0s):  All agents read messages from the bus
                   ↓
                   Each agent processes locally (plan/execute/reflect)
                   ↓
                   All agents write output messages to the bus

Heartbeat 2 (4s):  Repeat...
```

This synchronization eliminates race conditions and makes the system predictable and debuggable.

### 3. Communication & Knowledge Sharing

**Message Bus**: Agents communicate through typed messages (40+ message types):
- `TASK_ASSIGNMENT`: Assign work to subordinates
- `PROGRESS_REPORT`: Report completion status
- `DECISION_REQUEST`: Request approval for major decisions
- `VETO`: Block a decision that violates constraints
- `APPEAL`: Challenge a veto decision

**Whiteboard System**: Shared Markdown files for persistent knowledge:
- Each layer has its own whiteboard (top.md, mid.md, bottom.md)
- Global whiteboard (global.md) for cross-layer information
- Agents can read any whiteboard but only write to their own layer + global

### 4. Governance Mechanisms

Five mechanisms prevent chaos and ensure quality:

1. **Signature**: Major decisions require 2-3 agent signatures before execution
2. **Veto**: Any authorized agent can block decisions that violate constraints
3. **Appeal**: Vetoed decisions can be appealed to top-layer arbitration
4. **Accountability**: Performance tracking with Warning → Demotion → Dismissal
5. **Election**: Every 50 heartbeats (~3.3 minutes), agents are evaluated and can be replaced

### 5. Persistence & Audit

All activity is stored in SQLite:
- Task configuration and lifecycle
- Agent creation, updates, and performance metrics
- All messages exchanged between agents
- Governance decisions and their outcomes
- Complete audit trail for accountability

## 📦 Packages

This is a monorepo containing multiple packages:

- **@magf/core**: Core framework with agent models, governance, and communication systems
- **@magf/cli**: Command-line interface for managing agent teams
- **examples**: Sample implementations and use cases

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/multi-agent-governance-framework.git
cd multi-agent-governance-framework

# Install dependencies
npm install

# Build all packages
npm run build
```

### Current Implementation Status

**✅ Completed (v0.1.0):**
- Core type definitions for agents, messages, decisions, and governance
- SQLite persistence layer with 6 tables and typed repositories
- Structured logging system with pino (category-based)
- Database backup and restore utilities
- Comprehensive test suite with 70% coverage requirement

**🚧 In Development:**
- Agent base classes (BaseAgent, TopAgent, MidAgent, BottomAgent)
- Message bus implementation with heartbeat synchronization
- Whiteboard system with Markdown file management
- Governance engine with signature/veto/appeal/accountability/election
- CLI tool with TUI interface
- Team manager for dynamic role generation

### Usage (Planned API)

Once the runtime is complete, you'll be able to use MAGF like this:

**CLI Usage:**
```bash
# Start a new task with the CLI
npx magf start "Create a TODO application"

# Check task status
npx magf status

# Pause/resume/cancel tasks
npx magf pause
npx magf resume
npx magf cancel
```

**Programmatic API:**
```typescript
import { AgentTeam, ExecutionMode } from '@magf/core'

// Create a team with configuration
const team = new AgentTeam({
  mode: ExecutionMode.AUTO,
  heartbeatInterval: 4000,
  maxBottomAgents: 5,
  workspaceDir: './.agent-workspace',
})

// Start a task
const result = await team.start('Create a REST API with Express.js')

// Monitor progress
team.on('heartbeat', (state) => {
  console.log(`Heartbeat ${state.heartbeatCount}: ${state.activeAgents} agents working`)
})

team.on('decision', (decision) => {
  console.log(`Decision: ${decision.type} - ${decision.status}`)
})

// Wait for completion
await team.waitForCompletion()
console.log('Task completed:', result)
```

### Using the Persistence Layer (Available Now)

You can already use the persistence layer for building your own agent systems:

```typescript
import { DatabaseManager, TaskRepository, AgentRepository } from '@magf/core'

// Initialize database
const db = new DatabaseManager('./.agent-workspace/task.db')
await db.initialize()

// Create repositories
const taskRepo = new TaskRepository(db)
const agentRepo = new AgentRepository(db)

// Create a task
const task = await taskRepo.create({
  description: 'Build a REST API',
  mode: 'auto',
  status: 'running',
  config: { heartbeatInterval: 4000 },
})

// Create agents
const topAgent = await agentRepo.create({
  name: 'System Architect',
  layer: 'top',
  status: 'idle',
  capabilities: ['planning', 'architecture'],
}, task.id)

// Query agents by layer
const topAgents = await agentRepo.findByLayer('top', task.id)

// Update agent status
await agentRepo.updateStatus(topAgent.id, 'working', task.id)

// Close database
await db.close()
```

## 🏗️ Architecture

### Three-Tier Governance Hierarchy

```
┌─────────────────────────────────────────────────────────────┐
│  Top Layer (3 agents)                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │  Strategic  │  │  Arbitrator │  │   Quality   │        │
│  │   Leader    │  │             │  │   Auditor   │        │
│  └─────────────┘  └─────────────┘  └─────────────┘        │
│  • Strategic decisions  • Conflict resolution              │
│  • Quality assurance    • Final arbitration                │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│  Mid Layer (2-5 agents)                                     │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Domain 1 │  │ Domain 2 │  │ Domain 3 │  │ Domain N │  │
│  │  Leader  │  │  Leader  │  │  Leader  │  │  Leader  │  │
│  └──────────┘  └──────────┘  └──────────┘  └──────────┘  │
│  • Task breakdown       • Progress monitoring              │
│  • Resource allocation  • Cross-domain coordination        │
└─────────────────────────────────────────────────────────────┘
                          ↓ ↑
┌─────────────────────────────────────────────────────────────┐
│  Bottom Layer (4-5 agents)                                  │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐  │
│  │ Worker │ │ Worker │ │ Worker │ │ Worker │ │ Worker │  │
│  │   1    │ │   2    │ │   3    │ │   4    │ │   5    │  │
│  └────────┘ └────────┘ └────────┘ └────────┘ └────────┘  │
│  • Task execution       • Tool invocation                  │
│  • Result generation    • Status reporting                 │
└─────────────────────────────────────────────────────────────┘
```

### Core Components

#### 1. Message Bus
- **Heartbeat-driven**: 4-second synchronized cycles
- **40+ message types**: Task assignment, progress reports, decisions, vetoes, appeals
- **Priority levels**: LOW, NORMAL, HIGH, URGENT
- **Guaranteed delivery**: All messages processed at heartbeat boundaries

#### 2. Whiteboard System
- **Layer-specific whiteboards**: `top.md`, `mid.md`, `bottom.md`
- **Global whiteboard**: `global.md` for cross-layer information
- **Read permissions**: Any agent can read any whiteboard
- **Write permissions**: Agents can only write to their own layer + global

#### 3. Governance Engine
- **Signature mechanism**: Major decisions require 2-3 signatures
- **Veto power**: Any authorized agent can block decisions
- **Appeal process**: Vetoed decisions escalate to top-layer arbitration
- **Accountability**: Performance tracking with warning/demotion/dismissal
- **Elections**: Every 50 heartbeats, agents evaluated and potentially replaced

#### 4. Persistence Layer
- **SQLite database**: Complete task and agent history
- **6 tables**: tasks, agents, messages, decisions, audit_events, elections
- **Typed repositories**: Type-safe CRUD operations
- **Backup utilities**: Automated backup and restore

#### 5. Logging System
- **Category-based**: message-bus, audit, performance, agent, governance
- **Structured logging**: JSON format with pino
- **Log rotation**: Automatic cleanup of old logs
- **Multiple outputs**: File and console logging

## 📁 Runtime Workspace

When MAGF runs, it creates a `.agent-workspace/` directory (gitignored) containing:

```
.agent-workspace/
├── task.db              # SQLite database with all task data
├── whiteboards/         # Shared knowledge space
│   ├── global.md        # Cross-layer information
│   ├── top.md           # Top layer whiteboard
│   ├── mid.md           # Mid layer whiteboard
│   └── bottom.md        # Bottom layer whiteboard
└── logs/                # Categorized log files
    ├── message-bus.log  # Message bus activity
    ├── audit.log        # Governance decisions and accountability
    ├── performance.log  # Agent performance metrics
    ├── agent.log        # Agent lifecycle events
    └── governance.log   # Governance mechanism activity
```

**Database Schema:**
- `tasks` - Task configuration and lifecycle
- `agents` - Agent metadata, status, and performance
- `messages` - Inter-agent communication history
- `decisions` - Governance decisions and signatures
- `audit_events` - Complete audit trail
- `elections` - Election results and agent evaluations

## 🛠️ Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0

### Setup Development Environment

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Build in watch mode (for development)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate coverage report
npm run test:coverage

# Check code quality
npm run lint          # ESLint
npm run typecheck     # TypeScript type checking
npm run format        # Prettier formatting

# Run full CI pipeline (lint + typecheck + test)
npm run ci

# Clean build artifacts
npm run clean
```

### Code Quality Standards

- **TypeScript**: Strict mode enabled, no `any` types
- **Test Coverage**: Minimum 70% for lines, functions, branches, statements
- **Commit Messages**: Conventional Commits format (`feat:`, `fix:`, `docs:`, etc.)
- **Documentation**: JSDoc for all public APIs
- **Language**: All comments and documentation must be in English

### Monorepo Structure

```
multi-agent-governance-framework/
├── packages/
│   ├── core/                    # @magf/core - Core framework (SDK)
│   │   ├── src/
│   │   │   ├── types/           # Type definitions
│   │   │   ├── persistence/     # SQLite database layer
│   │   │   ├── logging/         # Structured logging system
│   │   │   ├── agents/          # Agent base classes (planned)
│   │   │   ├── communication/   # Message bus (planned)
│   │   │   ├── whiteboard/      # Whiteboard system (planned)
│   │   │   ├── governance/      # Governance engine (planned)
│   │   │   └── index.ts         # Public API exports
│   │   ├── tests/               # Test suite
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   ├── cli/                     # @magf/cli - Command-line interface
│   │   ├── src/
│   │   │   └── index.ts         # CLI entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsup.config.ts
│   └── examples/                # Example implementations (planned)
├── docs/                        # Documentation
│   └── plans/                   # Design specifications
│       └── multi-agent-governance-framework/
│           ├── master-plan.md   # Project vision and roadmap
│           ├── specs/           # Detailed design specs (6 docs)
│           └── todo/            # Task breakdown (10 tasks)
├── .agent-workspace/            # Runtime workspace (gitignored)
├── .claude-index/               # Project index for Claude Code
├── package.json                 # Root monorepo configuration
├── tsconfig.json                # TypeScript configuration
├── vitest.config.ts             # Test configuration
├── .eslintrc.json               # ESLint configuration
├── .prettierrc                  # Prettier configuration
├── CLAUDE.md                    # Claude Code instructions
└── CONTRIBUTING.md              # Contribution guidelines
```

## 📚 Documentation

- [Master Plan](./docs/plans/multi-agent-governance-framework/master-plan.md) - Project vision and roadmap
- [Architecture Design](./docs/plans/multi-agent-governance-framework/specs/01-架构设计.md) - System architecture
- [Agent Model](./docs/plans/multi-agent-governance-framework/specs/02-Agent模型.md) - Agent design and lifecycle
- [Communication Mechanism](./docs/plans/multi-agent-governance-framework/specs/03-通信机制.md) - Message bus and heartbeat
- [Whiteboard System](./docs/plans/multi-agent-governance-framework/specs/04-白板系统.md) - Shared knowledge space
- [Power Balance Mechanisms](./docs/plans/multi-agent-governance-framework/specs/05-权力制衡.md) - Governance mechanisms

## 🧪 Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

Coverage thresholds are set to 70% for lines, functions, branches, and statements.

## ❓ FAQ

### Why do we need governance in multi-agent systems?

Without governance, multi-agent systems can become chaotic:
- Agents may work on conflicting solutions
- No accountability when agents make mistakes
- No mechanism to resolve disagreements
- Quality control is difficult to enforce

MAGF's governance mechanisms (signature, veto, appeal, accountability, election) ensure that agents work together effectively with proper oversight.

### Why a three-tier hierarchy instead of flat structure?

A three-tier hierarchy provides:
- **Clear separation of concerns**: Strategic vs tactical vs operational
- **Scalability**: Can handle complex tasks by dividing responsibilities
- **Accountability**: Each layer is responsible to the layer above
- **Efficiency**: Bottom layer agents can work in parallel without constant coordination

### Why heartbeat synchronization instead of async messaging?

Heartbeat synchronization provides:
- **Predictability**: All agents operate on the same clock cycle
- **Debuggability**: Easy to trace what happened at each heartbeat
- **Simplicity**: No race conditions or complex async coordination
- **Consistency**: All agents see the same state at each heartbeat

It's similar to how CPUs use clock cycles to synchronize operations.

### Why dynamic role generation instead of fixed roles?

Fixed roles (like "architect", "developer", "tester") are too rigid:
- A coding task needs different roles than a research task
- Different domains require different expertise
- Fixed roles can't adapt to unexpected requirements

Dynamic role generation allows the AI to create the most appropriate team for each specific task.

### Can I use MAGF for non-coding tasks?

Yes! MAGF is designed for any complex task that benefits from:
- Division of labor with oversight
- Multiple perspectives and review
- Quality control and accountability
- Structured decision-making

Examples: Research projects, content creation, data analysis, planning, etc.

### How is MAGF different from other multi-agent frameworks?

Most frameworks focus on:
- Fixed agent roles and workflows
- Simple task delegation without governance
- Async communication without synchronization

MAGF focuses on:
- Dynamic role generation based on task context
- Built-in governance mechanisms for quality and accountability
- Synchronized communication for predictability
- Complete audit trail for transparency

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- Inspired by political science principles of governance and checks and balances
- Built with TypeScript, Vitest, and modern tooling
- Designed for extensibility and real-world applications

## 📮 Contact

For questions, issues, or suggestions, please open an issue on GitHub.

---

## 📊 Project Status

**Current Version**: v0.1.0 (Early Development)

**Phase 1 Complete**: ✅ Foundation infrastructure is ready
- Core type system with 40+ message types
- SQLite persistence with 6 tables and typed repositories
- Structured logging with category-based organization
- Database backup and restore utilities
- Test infrastructure with 70% coverage requirement

**Next Phase**: 🚧 Agent Runtime (v0.2.0)
- Implementing BaseAgent and layer-specific agent classes
- Agent lifecycle management and state machine
- Performance metrics tracking

**Contributions Welcome**: We're actively developing the agent runtime and would love your help! See [CONTRIBUTING.md](./CONTRIBUTING.md) for guidelines.

**Stay Updated**: Watch this repository for updates as we progress through the roadmap.
