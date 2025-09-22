<!--
Sync Impact Report:
Version change: Initial version → 1.0.0
Modified principles: All principles added (new constitution)
Added sections: Security & Performance, Development Workflow
Removed sections: None
Templates requiring updates: ✅ updated plan-template.md, spec-template.md, tasks-template.md all reference constitution correctly
Follow-up TODOs: None - all placeholders filled
-->

# Starepo Constitution

## Core Principles

### I. Desktop-First Architecture
Desktop applications MUST leverage the full capabilities of the Electron platform with complete process separation. Main process handles all system interactions, GitHub API calls, and data persistence. Renderer process focuses exclusively on React UI. Context Isolation MUST be enabled with secure preload scripts providing controlled API access. No renderer process shall directly access Node.js APIs.

**Rationale**: Security isolation prevents malicious code execution while maintaining clean separation of concerns. Desktop applications benefit from leveraging system capabilities unavailable to web applications.

### II. Type-Safe IPC Communication
All inter-process communication MUST use type-safe channels defined in `src/shared/constants/ipc-channels.ts`. Every IPC call requires explicit type definitions for request and response data. Runtime type validation with Zod schemas MUST be implemented for all data crossing process boundaries. No untyped `any` parameters in IPC handlers.

**Rationale**: Type safety prevents runtime errors in distributed desktop architecture. Explicit contracts enable confident refactoring and catch integration issues early.

### III. Test-Driven Development (NON-NEGOTIABLE)
Tests MUST be written before implementation. Red-Green-Refactor cycle strictly enforced: write failing test → implement minimal code to pass → refactor. Unit tests for business logic, integration tests for IPC communication, end-to-end tests for user workflows. All tests must pass before merging code. No feature ships without comprehensive test coverage.

**Rationale**: Desktop applications have complex multi-process architectures where bugs are harder to debug. TDD ensures reliability and prevents regressions in system-critical functionality.

### IV. Privacy-First Data Management
All user data MUST remain local. GitHub tokens stored using Electron's safeStorage API. Vector embeddings and project metadata persist in local ChromaDB only. No user data transmitted to third parties except explicitly chosen AI providers for embeddings. Users control their data export and deletion. Clear data retention policies documented.

**Rationale**: GitHub star repositories often contain sensitive project information. Local-first approach builds user trust and ensures data sovereignty.

### V. Performance & Responsiveness
UI operations MUST remain responsive during data processing. Heavy operations (GitHub API calls, vector processing, AI inference) execute in main process with progress updates via IPC. Implement smart caching strategies: memory cache for active data, IndexedDB for persistent UI state. Target <200ms for UI interactions, <5s for API operations with progress indication.

**Rationale**: Desktop users expect immediate responsiveness. Long-running operations should not block the interface, and users need feedback on progress for data-intensive tasks.

## Security & Performance Standards

All GitHub API operations MUST implement rate limiting with exponential backoff. Token validation occurs at startup with graceful degradation for expired credentials. Sensitive operations require user confirmation dialogs. Memory usage monitoring prevents resource exhaustion during large repository processing. Error boundaries catch and report crashes without data loss.

## Development Workflow

Code reviews MUST verify IPC type safety, test coverage, and security practices. Feature branches require passing CI/CD pipeline including linting, type checking, unit tests, and E2E tests. Complexity increases require architectural review and justification against simpler alternatives. Documentation updates accompany all user-facing changes.

## Governance

This constitution supersedes all other development practices. Constitutional violations require explicit justification and architectural review. Amendments follow semantic versioning: MAJOR for principle changes, MINOR for new sections, PATCH for clarifications. All code changes must demonstrate constitutional compliance during review process.

The development process follows structured planning via `/plan` and `/tasks` commands as defined in the specification templates. Features progress through: specification → planning → design → implementation → validation.

**Version**: 1.0.0 | **Ratified**: 2025-01-22 | **Last Amended**: 2025-01-22