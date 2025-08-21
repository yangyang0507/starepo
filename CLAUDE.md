# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Common Development Commands

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

- **Main Process** (`src/main/`): Core application logic, GitHub API integration, secure storage, IPC handlers
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
- **Vitest** for unit testing, **Playwright** for e2e testing

### Project Structure

- `src/main/` - Main process: window management, IPC handlers, services
- `src/renderer/` - React UI: components, pages, hooks, services
- `src/preload/` - Security bridge for IPC communication
- `src/shared/` - Shared types, constants, utilities
- `src/assets/` - Static assets (fonts, icons)

### IPC Communication

All inter-process communication uses type-safe channels defined in `src/shared/constants/ipc-channels.ts`. Current channels include:

- `WINDOW`: Window management (minimize, maximize, close, fullscreen)
- `THEME`: Theme switching (dark/light/system)
- `LANGUAGE`: i18n language switching
- `GITHUB`: GitHub API integration (planned)
- `DATABASE`: Local data storage (planned)
- `AI`: AI chat functionality (planned)

### Path Aliases

- `@/` - Points to `src/renderer/`
- `@shared/` - Points to `src/shared/`
- `@assets/` - Points to `src/assets/`

### GitHub Integration

The application includes a sophisticated GitHub authentication system in `src/renderer/services/github/`:

- Personal Access Token authentication
- Secure token storage using Electron's safeStorage API
- Comprehensive GitHub API integration via Octokit.js
- Rate limiting and caching mechanisms
- Token validation and scope checking

### Development Notes

- Context Isolation is enabled for security - renderer process cannot directly access Node.js APIs
- All main process functionality must be exposed through preload scripts
- React Compiler is enabled by default for performance optimization
- Custom window title bar with drag region implementation
- Comprehensive error handling and type safety throughout
