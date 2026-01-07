# Repository Guidelines

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

- **Main Process** (`src/main/`): Core application logic, GitHub API integration, local data storage, AI Agent system, tool registry, IPC handlers
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
- **AI SDK V5** for Agentic AI and Tool Calling
- **Vitest** for unit testing, **Playwright** for e2e testing

### Project Structure

- `src/main/` - Main process: window management, IPC handlers, services
  - `services/database/` - Data persistence layer (JSON/SQLite, secure storage)
  - `services/github/` - GitHub API integration layer
  - `services/ai/` - AI Agent system and tool registry
  - `services/tools/` - AI-callable tool implementations
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
- `DATABASE`: Local data storage
- `AI`: AI chat functionality and tool calling

### Path Aliases

- `@/` - Points to `src/renderer/`
- `@shared/` - Points to `src/shared/`
- `@assets/` - Points to `src/assets/`

### Data Storage & Search Architecture

The application uses a local data storage architecture with AI-driven tool-based search:

#### Local Data Storage (`~/.starepo/data/`)

- **Storage format**: JSON or SQLite (configurable)
- **Repository data**: Full repository information from GitHub
- **Metadata**: User preferences, tags, notes
- **Incremental sync**: Only fetch changed/new data

#### Secure Storage (`~/.starepo/secure-storage/`)

- **Encryption**: Uses Electron's safeStorage API
- **GitHub tokens**: Secure credential management
- **User data**: Encrypted personal information storage
- **Expiration**: Automatic token expiry handling

#### Agentic AI Tool System

- **Tool-based search**: AI Agent calls various search tools to find repositories
- **Multi-dimensional filters**: Language, stars, dates, topics, keywords
- **Natural language queries**: Convert user intent to tool calls
- **Composable searches**: AI combines multiple tools for complex queries
- **No vector embeddings**: Simple, efficient, transparent search tools

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

- No native module dependencies for now
- Pure JavaScript/TypeScript implementation
- All AI operations handled via AI SDK V5 HTTP calls

## Important Notes for Development

### Application Data Location

All application data is stored in `~/.starepo/` directory:

- **Database**: `~/.starepo/data/` (JSON or SQLite database files)
- **Secure Storage**: `~/.starepo/secure-storage/` (Encrypted user credentials)

### Service Dependencies

- **GitHub services** depend on secure storage for authentication
- **Search services** depend on LanceDB for data persistence
- **All services** must be initialized before use

### Architecture Migration

This application has been migrated from ChromaDB to LanceDB for better performance and native integration. The search functionality now uses LanceDB's built-in full-text search capabilities combined with vector similarity search.
