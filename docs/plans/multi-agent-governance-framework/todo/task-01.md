# TODO Task 01: Project Initialization & Monorepo Setup

## Task Position
- **Phase**: Foundation
- **Order**: Task 1 of 10

## Task Overview
Set up the foundational project structure as a TypeScript monorepo with proper build tooling, linting, testing framework, and development workflow. This task establishes the baseline infrastructure that all subsequent development will build upon.

## Specification Traceability
- **Related Documents**: `master-plan.md`, `specs/01-架构设计.md`
- **Related Sections**:
  - Master Plan Section 6.3 "Project Structure"
  - Architecture Design Section 3 "Core Components Architecture"
- **Relationship**: This task implements the project structure defined in master-plan.md Section 6.3, creating the monorepo layout with three main packages (core, cli, examples) and establishing the development environment specified in the technical stack section.

## TODO Checklist

### 1. Initialize Monorepo Structure
Create the root-level monorepo using npm/yarn workspaces with proper package organization.

**Pseudocode**:
```
function initializeMonorepo():
    create directory structure:
        multi-agent-governance-framework/
        ├── packages/
        │   ├── core/
        │   ├── cli/
        │   └── examples/
        ├── docs/
        ├── .agent-workspace/ (gitignored)

    create root package.json:
        name: "multi-agent-governance-framework"
        workspaces: ["packages/*"]
        private: true

    initialize git:
        git init
        create .gitignore with:
            - node_modules
            - .agent-workspace
            - *.log
            - dist/
```

### 2. Configure TypeScript
Set up TypeScript with appropriate configurations for each package.

**Pseudocode**:
```
function configureTypeScript():
    create root tsconfig.json:
        compilerOptions:
            target: "ES2022"
            module: "ESNext"
            moduleResolution: "node"
            strict: true
            esModuleInterop: true
            skipLibCheck: true

    create tsconfig.build.json extending root

    for each package in packages/:
        create package-specific tsconfig.json:
            extends: "../../tsconfig.json"
            include: ["src/**/*"]
            exclude: ["**/*.test.ts"]
```

### 3. Set Up Build Tooling
Configure tsup for fast TypeScript bundling.

**Pseudocode**:
```
function setupBuildTooling():
    install dependencies:
        tsup: "^8.0.0"
        typescript: "^5.3.0"

    for each package:
        create tsup.config.ts:
            entry: ["src/index.ts"]
            format: ["cjs", "esm"]
            dts: true
            sourcemap: true
            clean: true

        add build scripts to package.json:
            "build": "tsup"
            "dev": "tsup --watch"
```

### 4. Configure Testing Framework
Set up Vitest for unit and integration testing.

**Pseudocode**:
```
function setupTesting():
    install dependencies:
        vitest: "^1.0.0"
        @vitest/ui: "^1.0.0"

    create vitest.config.ts at root:
        test:
            globals: true
            environment: "node"
            coverage:
                provider: "v8"
                reporter: ["text", "html"]
                threshold:
                    lines: 70
                    functions: 70
                    branches: 70

    add test scripts to root package.json:
        "test": "vitest run"
        "test:watch": "vitest"
        "test:coverage": "vitest run --coverage"
```

### 5. Set Up Linting and Formatting
Configure ESLint and Prettier for code quality.

**Pseudocode**:
```
function setupLinting():
    install dependencies:
        eslint: "^8.0.0"
        @typescript-eslint/parser
        @typescript-eslint/eslint-plugin
        prettier: "^3.0.0"
        eslint-config-prettier

    create .eslintrc.json:
        parser: "@typescript-eslint/parser"
        extends: [
            "eslint:recommended",
            "plugin:@typescript-eslint/recommended",
            "prettier"
        ]

    create .prettierrc:
        semi: false
        singleQuote: true
        tabWidth: 2
        printWidth: 100

    add scripts:
        "lint": "eslint packages/*/src --ext .ts"
        "format": "prettier --write 'packages/*/src/**/*.ts'"
```

### 6. Initialize Core Package Structure
Create the basic structure for the core package.

**Pseudocode**:
```
function initializeCorePackage():
    create packages/core/package.json:
        name: "@magf/core"
        version: "0.1.0"
        main: "./dist/index.cjs"
        module: "./dist/index.js"
        types: "./dist/index.d.ts"

    create packages/core/src/ directories:
        ├── agents/
        ├── governance/
        ├── communication/
        ├── whiteboard/
        ├── persistence/
        ├── lifecycle/
        ├── types/
        └── index.ts

    create packages/core/tests/ directory
```

### 7. Set Up Development Scripts
Create convenient npm scripts for development workflow.

**Pseudocode**:
```
function setupDevScripts():
    add to root package.json scripts:
        "dev": "npm run dev --workspaces"
        "build": "npm run build --workspaces"
        "clean": "rm -rf packages/*/dist"
        "typecheck": "tsc --noEmit"
        "ci": "npm run lint && npm run typecheck && npm run test"
```

### 8. Configure Git Hooks
Set up pre-commit hooks for code quality checks.

**Pseudocode**:
```
function setupGitHooks():
    install husky and lint-staged:
        "husky": "^8.0.0"
        "lint-staged": "^15.0.0"

    initialize husky:
        npx husky install

    create .husky/pre-commit:
        npx lint-staged

    add to package.json:
        "lint-staged": {
            "*.ts": [
                "eslint --fix",
                "prettier --write",
                "vitest related --run"
            ]
        }
```

### 9. Create Initial Documentation
Set up basic README and contribution guidelines.

**Pseudocode**:
```
function createDocumentation():
    create README.md:
        - Project overview
        - Quick start guide
        - Installation instructions
        - Development setup
        - Link to detailed docs

    create CONTRIBUTING.md:
        - Code style guidelines
        - PR process
        - Testing requirements
        - Commit message format

    create LICENSE (MIT)
```

### 10. Verify Build Pipeline
Ensure everything builds and runs correctly.

**Pseudocode**:
```
function verifyPipeline():
    run commands in sequence:
        npm install
        npm run lint
        npm run typecheck
        npm run build
        npm run test

    verify output:
        - No linting errors
        - No type errors
        - All packages built successfully
        - dist/ folders created with .js, .cjs, .d.ts files
```

## Dependencies
- **Prerequisites**: None - this is the first task
- **Following Tasks**: All subsequent tasks depend on this foundation

## Acceptance Criteria
- [ ] Monorepo structure created with packages/core, packages/cli, packages/examples
- [ ] TypeScript configured with strict mode and proper module resolution
- [ ] Build system (tsup) producing CJS, ESM, and type definitions
- [ ] Test framework (Vitest) configured with 70% coverage threshold
- [ ] Linting (ESLint) and formatting (Prettier) working correctly
- [ ] Git hooks preventing commits with failing tests or linting errors
- [ ] All packages can be built with `npm run build` from root
- [ ] CI script passes: `npm run ci` completes without errors
- [ ] README and basic documentation in place
- [ ] Project runs `npm install && npm run build` successfully on fresh clone
