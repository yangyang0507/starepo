# Copilot Instructions for Starepo

## Overview
Starepo is a GitHub Star management tool built with Electron, React, and TypeScript. It features a security-focused architecture with complete process separation and will integrate AI-powered repository search capabilities.

## Architecture & Process Separation

### Electron Process Architecture
- **Main Process** (`src/main/`): Core app logic, GitHub API, secure storage, IPC handlers
- **Renderer Process** (`src/renderer/`): React UI with TanStack Router and Zustand stores
- **Preload Scripts** (`src/preload/`): Security bridge exposing `window.electronAPI`
- **Shared Code** (`src/shared/`): Types, constants, and utilities

### Security Model
- Context Isolation enabled - renderer cannot access Node.js APIs directly
- All main process functionality exposed through typed preload scripts
- IPC channels defined in `src/shared/constants/ipc-channels.ts` with TypeScript safety

## Key Development Patterns

### IPC Communication
All inter-process communication uses type-safe channels:
```typescript
// Define channels in src/shared/constants/ipc-channels.ts
// Expose in src/preload/preload.ts via contextBridge
// Access in renderer via window.electronAPI.theme.setTheme()
```

### Path Aliases (use consistently)
- `@/` → `src/renderer/`
- `@shared/` → `src/shared/`
- `@assets/` → `src/assets/`
- `@main/` → `src/main/` (main process only)
- `@preload/` → `src/preload/`

### State Management
- **Zustand stores** in `src/renderer/stores/` for client state
- **Auth state**: `useAuthStore` handles GitHub authentication
- **Theme/UI state**: Separate stores for theme, UI, and repository data

### Component Architecture
- **Shadcn UI** components in `src/renderer/components/ui/`
- **Custom components** use CVA (class-variance-authority) for variants
- **Layout components** in `src/renderer/components/layout/`

## Essential Commands

```bash
# Development
npm run start          # Start with hot reload
npm run package        # Package Electron app
npm run make          # Generate installers

# Code Quality
npm run lint          # ESLint checks
npm run format:write  # Apply Prettier formatting

# Testing
npm test             # Unit tests (Vitest)
npm run test:e2e     # E2E tests (Playwright)
npm run test:all     # Run all tests
```

## GitHub Integration

### Authentication Flow
- Uses Personal Access Token authentication (no OAuth)
- Secure storage via Electron's `safeStorage` API
- Token validation and scope checking before API calls
- Service layer in `src/renderer/services/github/`

### Key Service Classes
- `GitHubAuthService`: Authentication and token management
- `OctokitManager`: GitHub API client wrapper with rate limiting
- Storage clients in `src/renderer/services/` for persistence

## Development Guidelines

### Adding New IPC Channels
1. Define channel in `src/shared/constants/ipc-channels.ts`
2. Add handler in `src/main/ipc/handlers/`
3. Expose via preload script in `src/preload/preload.ts`
4. Create service in renderer to use the API

### Adding New UI Components
- Use Shadcn UI components as base when possible
- Implement custom variants with CVA
- Follow existing patterns in `src/renderer/components/ui/`

### State Management
- Use Zustand for client state
- Follow service layer pattern for external API calls
- Keep stores focused and domain-specific

## Testing Patterns
- **Unit tests**: Component logic and utility functions
- **Integration tests**: Service layer and IPC communication  
- **E2E tests**: Full user workflows with Playwright

## Future Features (Planned)
- AI/vector search integration with ChromaDB
- Semantic repository search capabilities
- Enhanced GitHub API features