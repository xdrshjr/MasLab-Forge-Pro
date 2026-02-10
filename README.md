# Multi-Agent Governance Framework (MAGF)

A TypeScript framework for building multi-agent systems with built-in governance mechanisms, inspired by political science principles of checks and balances.

## 🌟 Features

- **Three-Tier Governance Architecture**: Top (strategic), Mid (tactical), Bottom (operational) layers
- **Power Balance Mechanisms**: Signature, veto, appeal, accountability, and election systems
- **Dynamic Role Generation**: AI-driven role assignment based on task requirements
- **Heartbeat Message Bus**: Synchronized communication with 4-second intervals
- **Whiteboard System**: Shared knowledge space using Markdown files
- **Full TypeScript Support**: Type-safe APIs with comprehensive type definitions

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

### Usage

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

### Programmatic API

```typescript
import { AgentTeam } from '@magf/core'

const team = new AgentTeam({
  mode: 'auto',
  heartbeatInterval: 4000,
  maxBottomAgents: 5,
})

// Start a task
const result = await team.start('Create a REST API with Express.js')
console.log(result)
```

## 🏗️ Architecture

### Three-Tier Governance

```
┌─────────────────────────────────────┐
│  Top Layer (3 agents)               │
│  - Strategic decisions              │
│  - Conflict arbitration             │
│  - Quality assurance                │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Mid Layer (2-5 agents)             │
│  - Domain leadership                │
│  - Task coordination                │
│  - Progress monitoring              │
└─────────────────────────────────────┘
              ↓
┌─────────────────────────────────────┐
│  Bottom Layer (4-5 agents)          │
│  - Task execution                   │
│  - Tool invocation                  │
│  - Result reporting                 │
└─────────────────────────────────────┘
```

### Key Components

- **Message Bus**: Heartbeat-driven synchronous communication
- **Whiteboard System**: Markdown-based shared knowledge space
- **Governance Engine**: Signature, veto, appeal, accountability mechanisms
- **Team Manager**: Dynamic role generation and agent lifecycle management

## 🛠️ Development

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0

### Setup Development Environment

```bash
# Install dependencies
npm install

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Check code quality
npm run lint
npm run typecheck

# Format code
npm run format

# Run full CI pipeline
npm run ci
```

### Project Structure

```
multi-agent-governance-framework/
├── packages/
│   ├── core/           # Core framework
│   ├── cli/            # CLI tool
│   └── examples/       # Example implementations
├── docs/               # Documentation
├── .agent-workspace/   # Runtime workspace (gitignored)
└── package.json        # Root package configuration
```

## 📚 Documentation

- [Master Plan](./docs/plans/multi-agent-governance-framework/master-plan.md)
- [Architecture Design](./docs/plans/multi-agent-governance-framework/specs/01-架构设计.md)
- [Agent Model](./docs/plans/multi-agent-governance-framework/specs/02-Agent模型.md)
- [Communication Mechanism](./docs/plans/multi-agent-governance-framework/specs/03-通信机制.md)
- [Whiteboard System](./docs/plans/multi-agent-governance-framework/specs/04-白板系统.md)
- [Power Balance Mechanisms](./docs/plans/multi-agent-governance-framework/specs/05-权力制衡.md)

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

**Status**: 🚧 Under active development (v0.1.0)
