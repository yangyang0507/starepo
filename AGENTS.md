# Repository Guidelines

## Project Structure & Module Organization
Starepo is an Electron Forge + Vite desktop app.
- `src/main/` contains the Electron entry point plus services for GitHub, AI, database, and IPC handlers.
- `src/preload/` owns the secured bridge exported from `preload.ts` and typed in `types.ts`.
- `src/renderer/` holds the React UI (routes, pages, components, hooks, stores) using aliases like `@/components` and `@shared/constants`.
- `src/shared/` exposes cross-process types and constants; `src/assets/` keeps fonts/icons; tests live in `src/tests/{unit,integration,e2e}`.

## Build, Test, and Development Commands
- `npm run start` spins up Electron Forge with hot reload.
- `npm run lint`, `npm run format`, and `npm run format:write` enforce ESLint + Prettier.
- `npm run test`, `npm run test:unit`, and `npm run test:all` execute Vitest; `npm run test:e2e` runs Playwright (package first via `npm run package`).
- `npm run make` creates platform builds when you need installable artifacts.

## Coding Style & Naming Conventions
Write TypeScript everywhere. Prettier sets 2-space indentation, double quotes, trailing commas, and semicolons—run it instead of manual formatting. Components use PascalCase names, hooks follow the `useCamelCase` pattern, modules in `shared` export UPPER_SNAKE_CASE constants, and let Tailwind ordering come from the Prettier plugin. Run `npm run lint` before opening a PR to satisfy React Compiler, TypeScript, and globals rules.

## Testing Guidelines
Name spec files `*.test.ts(x)` or `*.spec.ts(x)` to match the Vitest glob. Keep unit tests close to their subject and mock IPC boundaries; integration suites can exercise shared services. Generate coverage with `npm run test -- --coverage` and avoid regressing existing totals. When running end-to-end tests from `src/tests/e2e`, ensure a packaged build exists and install Playwright browsers if prompted (`npx playwright install`).

## Commit & Pull Request Guidelines
Follow the Conventional Commit format seen in history (`feat(search): …`, `fix: …`). Use informative scopes, write imperative English subjects, and combine multi-step refactors into coherent commits. Pull requests should describe intent, link issues, note test commands executed, and attach UI screenshots or recordings when visuals change. Move drafts to "Ready for review" only after scripts above succeed.

## Environment & Secrets
Store secrets in `.env` (`CHROMA_DB_PATH`, `OPENAI_API_KEY`, GitHub tokens). The app persists credentials through Electron `safeStorage`; do not bypass it. Keep paths in `forge.config.ts` relative so packaged builds stay portable.
