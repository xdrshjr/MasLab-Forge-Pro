# Contributing to Multi-Agent Governance Framework

Thank you for your interest in contributing to MAGF! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and collaborative environment.

## Getting Started

### Prerequisites

- Node.js >= 20.0.0
- npm >= 9.0.0
- Git

### Setup

1. Fork the repository
2. Clone your fork:
   ```bash
   git clone https://github.com/your-username/multi-agent-governance-framework.git
   cd multi-agent-governance-framework
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature-name
   ```

## Development Workflow

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage
```

### Code Quality

```bash
# Lint code
npm run lint

# Format code
npm run format

# Type check
npm run typecheck

# Run full CI pipeline
npm run ci
```

### Building

```bash
# Build all packages
npm run build

# Build in watch mode
npm run dev

# Clean build artifacts
npm run clean
```

## Code Style Guidelines

### TypeScript

- Use TypeScript strict mode
- Prefer explicit types over `any`
- Use meaningful variable and function names
- Follow functional programming principles where appropriate

### Comments

- **All comments must be in English**
- Use JSDoc comments for public APIs
- Explain "why" not "what" in inline comments
- Keep comments concise and up-to-date

Example:
```typescript
/**
 * Calculates the performance score for an agent based on metrics
 *
 * @param metrics - Agent performance metrics
 * @returns Score between 0 and 100
 */
function calculatePerformanceScore(metrics: AgentMetrics): number {
  // Weight success rate higher than response time for critical agents
  const successWeight = 0.6
  const responseWeight = 0.4

  return metrics.successRate * successWeight + metrics.responsiveness * responseWeight
}
```

### Clean Code Principles

1. **Single Responsibility**: Each function/class should do one thing well
2. **DRY (Don't Repeat Yourself)**: Extract common logic into reusable functions
3. **KISS (Keep It Simple)**: Prefer simple solutions over complex ones
4. **Meaningful Names**: Use descriptive names that reveal intent
5. **Small Functions**: Keep functions short and focused
6. **Error Handling**: Handle errors explicitly, don't ignore them

### File Organization

```
packages/[package-name]/
├── src/
│   ├── [module]/
│   │   ├── index.ts          # Public API exports
│   │   ├── types.ts          # Type definitions
│   │   ├── [feature].ts      # Implementation
│   │   └── utils.ts          # Utility functions
│   └── index.ts              # Package entry point
└── tests/
    └── [module].test.ts      # Test files
```

## Testing Guidelines

### Test Structure

```typescript
describe('ModuleName', () => {
  describe('functionName', () => {
    it('should handle normal case', () => {
      // Arrange
      const input = createTestInput()

      // Act
      const result = functionName(input)

      // Assert
      expect(result).toBe(expectedValue)
    })

    it('should handle edge case', () => {
      // Test edge cases
    })

    it('should throw error for invalid input', () => {
      expect(() => functionName(invalidInput)).toThrow()
    })
  })
})
```

### Coverage Requirements

- Minimum 70% coverage for lines, functions, branches, and statements
- All public APIs must have tests
- Critical paths must have comprehensive test coverage

## Commit Message Format

Follow the Conventional Commits specification:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

### Examples

```
feat(core): add message priority queue

Implement priority-based message queue to handle urgent messages
before normal ones. This improves system responsiveness for
critical operations.

Closes #123
```

```
fix(cli): correct argument parsing for start command

The --max-agents flag was not being parsed correctly due to
incorrect type conversion.
```

## Pull Request Process

1. **Update Documentation**: Ensure README and relevant docs are updated
2. **Add Tests**: Include tests for new features or bug fixes
3. **Run CI**: Ensure `npm run ci` passes locally
4. **Update Changelog**: Add entry to CHANGELOG.md (if applicable)
5. **Create PR**: Provide clear description of changes
6. **Address Review**: Respond to review comments promptly

### PR Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
Describe testing performed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Comments added (in English)
- [ ] Documentation updated
- [ ] Tests added/updated
- [ ] All tests pass
- [ ] No new warnings
```

## Architecture Decisions

For significant architectural changes:

1. Open an issue for discussion first
2. Reference relevant specification documents
3. Consider backward compatibility
4. Update architecture documentation

## Questions?

- Open an issue for questions
- Check existing issues and documentation
- Reach out to maintainers

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
