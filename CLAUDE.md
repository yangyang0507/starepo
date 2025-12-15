# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Core Instruction for CodeX MCP

At all times, you must consider how to collaborate with Codex during your current process, and how to invoke the Codex MCP tools as a safeguard for your objective and comprehensive analysis.
You **must execute** the following steps:
**1** After forming an initial analysis of the user's requirements, inform Codex of the user's needs and your preliminary approach, and ask it to refine the requirements analysis and implementation plan.
**2** Before implementing specific coding tasks, **you must request a code implementation prototype from Codex (require Codex to provide only a unified diff patch, strictly prohibiting any actual code modifications)**. After obtaining the code prototype, you **may only use it as a logical reference and must rewrite the code modifications**, creating enterprise-grade, highly readable, and highly maintainable code before executing the actual programming modification tasks.
**3** Whenever you complete actual coding actions, **you must immediately use Codex to review the code changes and the degree of requirement completion**.
**4** Codex can only provide references; you **must have your own thinking and even need to question Codex's answers**. "Reading books without thinking is worse than not reading" — your ultimate mission with Codex is to reach unified, comprehensive, and precise conclusions, so you must continuously debate to find the only path to truth.


## Codex Tool Invocation Specification

 1. Tool Overview

  Codex MCP provides a tool named `codex` for executing AI-assisted coding tasks. This tool **is invoked via the MCP protocol**, not via command line.

  2. Tool Parameters

  **Required** parameters:
  - PROMPT (string): Task instruction sent to Codex
  - cd (Path): Root path of the working directory for Codex execution

  Optional parameters:
  - sandbox (string): Sandbox policy, options:
    - "read-only" (default): Read-only mode, safest
    - "workspace-write": Allow writes within workspace
    - "danger-full-access": Full access permissions
  - SESSION_ID (UUID | null): For continuing previous sessions to enable multi-turn interactions with Codex, defaults to None (start new session)
  - skip_git_repo_check (boolean): Whether to allow running in non-Git repositories, defaults to False
  - return_all_messages (boolean): Whether to return all messages (including reasoning, tool calls, etc.), defaults to False
  - image (List[Path] | null): Attach one or more image files to the initial prompt, defaults to None
  - model (string | null): Specify the model to use, defaults to None (uses user's default configuration)
  - yolo (boolean | null): Run all commands without approval (skip sandboxing), defaults to False
  - profile (string | null): Configuration profile name to load from `~/.codex/config.toml`, defaults to None (uses user's default configuration)

  Return value:
  {
    "success": true,
    "SESSION_ID": "uuid-string",
    "agent_messages": "agent's text response",
    "all_messages": []  // Only included when return_all_messages=True
  }
  Or on failure:
  {
    "success": false,
    "error": "error message"
  }

  3. Usage Methods

  Starting a new conversation:
  - Don't pass SESSION_ID parameter (or pass None)
  - Tool will return a new SESSION_ID for subsequent conversations

  Continuing a previous conversation:
  - Pass the previously returned SESSION_ID as parameter
  - Context from the same session will be preserved

  4. Invocation Standards

  **Must comply**:
  - Every time you call the Codex tool, you must save the returned SESSION_ID for subsequent conversations
  - The cd parameter must point to an existing directory, otherwise the tool will fail silently
  - Strictly prohibit Codex from making actual code modifications; use sandbox="read-only" to prevent accidents, and require Codex to provide only unified diff patches

  Recommended usage:
  - If detailed tracking of Codex's reasoning process and tool calls is needed, set return_all_messages=True
  - For precise location, debugging, rapid code prototyping, and similar tasks, prioritize using the Codex tool

  5. Notes

  - Session management: Always track SESSION_ID to avoid session confusion
  - Working directory: Ensure the cd parameter points to a correct and existing directory
  - Error handling: Check the success field in return values and handle possible errors

## Common Development Commands

- Use Chinese to response.

### Development

- `npm run start` - Start development mode with hot reload
- `npm run package` - Package the Electron application
- `npm run make` - Generate platform-specific installers

### Code Quality

- `npm run lint` - Run ESLint code checks
- `npm run format` - Check code formatting (read-only)
- `npm run format:write` - Apply Prettier formatting

### Testing

- `npm test` or `npm run test` - Run unit tests (Vitest)
- `npm run test:watch` - Run tests in watch mode
- `npm run test:e2e` - Run end-to-end tests (Playwright)
- `npm run test:all` - Run both unit and e2e tests

### Single Test Commands

- `npm run test:unit -- --run --reporter=verbose filename.test.ts` - Run specific unit test
- `npx playwright test example.test.ts` - Run specific e2e test

## Architecture Overview

This is an Electron application using a modern, security-focused architecture with complete process separation:

### Process Architecture

- **Main Process** (`src/main/`): Core application logic, GitHub API integration, LanceDB vector database, secure storage, search services, IPC handlers
- **Renderer Process** (`src/renderer/`): React UI, components, pages, client-side services
- **Preload Scripts** (`src/preload/`): Security bridge between main and renderer processes
- **Shared Code** (`src/shared/`): Type definitions, constants, utilities used across processes

### Key Technologies

- **Electron 37.2.5** with Context Isolation enabled for security
- **React 19.1.1** with React Compiler enabled
- **TypeScript 5.8.3** with strict type checking
- **Vite 7.0.6** for fast development and building
- **TailwindCSS 4.1.11** with Shadcn UI components
- **TanStack Router** for client-side routing
- **LanceDB** for vector database and semantic search
- **Vitest** for unit testing, **Playwright** for e2e testing

### Project Structure

- `src/main/` - Main process: window management, IPC handlers, services
  - `services/database/` - Data persistence layer (LanceDB, secure storage)
  - `services/github/` - GitHub API integration layer
  - `services/search/` - Search functionality layer
  - `ipc/` - Inter-process communication handlers
- `src/renderer/` - React UI: components, pages, hooks, API wrappers
- `src/preload/` - Security bridge for IPC communication
- `src/shared/` - Shared types, constants, utilities
- `src/assets/` - Static assets (fonts, icons)

### IPC Communication

All inter-process communication uses type-safe channels defined in `src/shared/constants/ipc-channels.ts`. Current channels include:

- `WINDOW`: Window management (minimize, maximize, close, fullscreen)
- `THEME`: Theme switching (dark/light/system)
- `LANGUAGE`: i18n language switching
- `GITHUB`: GitHub API integration (authentication, repositories, stars)
- `SEARCH`: Repository search and suggestions
- `DATABASE`: Local data storage (planned)
- `AI`: AI chat functionality (planned)

### Path Aliases

- `@/` - Points to `src/renderer/`
- `@shared/` - Points to `src/shared/`
- `@assets/` - Points to `src/assets/`

### Data Storage & Search Architecture

The application uses a modern data persistence and search architecture:

#### LanceDB Vector Database (`~/.starepo/lancedb/`)
- **Vector storage**: Repository embeddings for semantic search
- **Full-text search**: Built-in search capabilities
- **Schema**: Structured tables for repositories and users
- **Performance**: Optimized for large-scale data retrieval

#### Secure Storage (`~/.starepo/secure-storage/`)
- **Encryption**: Uses Electron's safeStorage API
- **GitHub tokens**: Secure credential management
- **User data**: Encrypted personal information storage
- **Expiration**: Automatic token expiry handling

#### Search Features
- **Semantic search**: Vector similarity for repository discovery
- **Keyword search**: Traditional text-based search
- **Filters**: Language, stars, dates, topics
- **Suggestions**: Auto-complete and popular terms
- **Analytics**: Search statistics and insights

### GitHub Integration

The application includes a comprehensive GitHub integration system:

- **Authentication**: Personal Access Token with secure storage
- **API Integration**: Full Octokit.js integration in main process
- **Repository Management**: Star/unstar operations with local sync
- **Data Sync**: Background synchronization with LanceDB
- **Rate Limiting**: Intelligent API usage management
- **Offline Support**: Local data persistence for offline browsing

### Development Notes

- Context Isolation is enabled for security - renderer process cannot directly access Node.js APIs
- All main process functionality must be exposed through preload scripts
- React Compiler is enabled by default for performance optimization
- Custom window title bar with drag region implementation
- Comprehensive error handling and type safety throughout

#### Service Architecture
- **Layered approach**: Database → GitHub → Search services
- **Unified naming**: All service files follow `*-service.ts` convention
- **Modular exports**: Each service directory has `index.ts` for clean imports
- **Type safety**: Comprehensive TypeScript definitions across all layers

#### Data Flow
1. **Main Process**: Handles all business logic and external API calls
2. **IPC Layer**: Type-safe communication between processes
3. **Renderer Process**: Pure UI layer with API wrappers
4. **Local Storage**: Unified `.starepo` directory for all application data

#### Native Modules
- **LanceDB**: Configured with AutoUnpackNativesPlugin for Electron packaging
- **Vite Config**: Excludes native modules from bundling
- **Build Process**: Handles .node files correctly in production builds

## Important Notes for Development

### Application Data Location
All application data is stored in `~/.starepo/` directory:
- **Database**: `~/.starepo/lancedb/` (LanceDB vector database files)
- **Secure Storage**: `~/.starepo/secure-storage/` (Encrypted user credentials)

### Service Dependencies
- **GitHub services** depend on secure storage for authentication
- **Search services** depend on LanceDB for data persistence
- **All services** must be initialized before use

### Architecture Migration
This application has been migrated from ChromaDB to LanceDB for better performance and native integration. The search functionality now uses LanceDB's built-in full-text search capabilities combined with vector similarity search.
