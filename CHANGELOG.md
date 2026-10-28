# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `info` accepts pasted GitHub URLs, resolves names case-insensitively, and suggests similarly named stars when nothing matches
- `sync` shows a real progress bar with ETA while fetching, sized from GitHub's `rel="last"` page link
- `search` / `list` page output longer than one screen through `$STAREPO_PAGER` / `$PAGER` (default `less`, with `LESS=FRX` unless set); `--no-pager` opts out
- Search terms are highlighted in result descriptions
- `search` / `list` warn when the last sync is more than a week old

### Changed

- All status output from `sync`, `embed`, and `auth` goes to stderr; stdout carries only command results
- `sync` and `embed` end with a one-line summary (e.g. `✓ Synced 1618 stars (+12 new, −3 removed)`) instead of several paragraphs
- Every command reports failures the same way: one `error: …` line on stderr and exit code 1
- `search` / `list` render an aligned table (index, owner/name, language, stars, age) modeled on `gh` list output: column headers on TTYs, GitHub language-color dots, right-aligned star counts, compact ages (`7w`, `11mo`, `2y`), and descriptions wrapped under each name with a hanging indent (max 2 lines, 90-column block); `--oneline` keeps the table and appends a truncated description
- Query highlighting matches whole ASCII words only, so `ai` no longer lights up inside `OpenAI`
- Secondary text uses bright-black gray instead of SGR dim, which many themes render as normal text; `info` wraps long descriptions under its value column

### Fixed

- Loading a cached embedding model no longer redraws a fake "Downloading model" bar hundreds of times per search; a transient spinner is shown instead, and real downloads report sizes in MB
- TTY progress redraws are throttled to ~12 fps
- Ctrl+C during a progress bar or spinner ends the line and restores the cursor

## [2.2.0] - 2026-09-04

### Added

- `--oneline` for `search` and `list` to print one result per line
- Shared terminal helpers for color (`NO_COLOR` / `FORCE_COLOR`), OSC-8 repo links, compact counts, relative timestamps, and progress bars
- Embedding model download reports progress through the existing TTY progress bar instead of sitting silent for the first-run ~550 MB fetch

### Changed

- `search` / `list` banners (`Searching…`, `Found N`, `Total stars`) now go to stderr so piped stdout is only results
- `sync` and `embed` progress writes to stderr; TTY sessions show a bar, rate, and ETA, non-TTY sessions print whole lines
- Search and list share one repo formatter (counts, relative starred time, optional hyperlinked names)
- `status` shows an embedding coverage bar and a rebuild hint when the stored model is outdated

### Fixed

- `--oneline` truncation uses grapheme-aware display width so CJK and emoji no longer overflow the terminal or split surrogate pairs
- TTY progress lines are clipped to the terminal width before `\r` + erase, so a narrow window no longer leaves leftover characters after wrap

## [2.1.0] - 2026-09-02

### Added

- `starepo status` (and `--json`) reports auth, database health, schema version, last sync, and embedding coverage
- `starepo sync --incremental` keeps the previous add-only sync path

### Changed

- `starepo sync` now always reconciles the full starred list so metadata updates and unstars apply without `--force`
- Hybrid search ranks vector and keyword hits with reciprocal rank fusion instead of concatenating the two lists

### Fixed

- Vector and FTS projections now request `_distance` and `_score` respectively, which silences LanceDB 0.38 scoring autoprojection warnings without mixing those columns into FTS result streams

## [2.0.0] - 2026-09-02

If search or sync fails to open a database created by 1.x, delete the local LanceDB directory (`~/.local/share/starepo/lancedb`, or `$XDG_DATA_HOME/starepo/lancedb`) and run `starepo sync --force`. Existing FTS indexes are rebuilt on the next search.

### Removed

- **BREAKING:** MCP server support (`starepo serve`) and the `@modelcontextprotocol/sdk` dependency. Use the CLI or the starepo skill instead.

### Changed

- **BREAKING:** Raise the minimum Node.js version to 22.12 (required by upgraded dependencies)
- Removed unused `xdg-basedir` dependency
- Upgrade `@lancedb/lancedb` to 0.38, `@octokit/rest` to 22, `@octokit/auth-oauth-device` to 8, and `commander` to 15
- FTS indexes are now created per column on `name`, `full_name`, `description`, `topics_text`, and `language`; existing databases rebuild indexes on the next search
- Full sync now rewrites only rows whose GitHub metadata changed instead of re-writing every row
- Embeddings are generated in batches of 8 texts per inference run instead of 3 concurrent single-text calls
- Embedding vectors are stored as `Float32Array`, halving per-vector memory
- FTS search failures now warn once on stderr before falling back to filter scans
- Incremental sync output now explains that unstarred repos and metadata changes need a full sync

### Fixed

- Embedding generation now persists vectors in batches as they complete, so interrupted runs keep their progress and `starepo embed` can resume
- Embedding writes no longer swallow failures; a failed batch aborts the run instead of reporting success with missing vectors
- Generated embedding vectors are copied out of the model output buffer before they are queued for storage
- Search result projection no longer requests the `_distance` column, which is absent from FTS result streams on LanceDB 0.38 and made every full-text search fall back to a filter scan
- `search --json` no longer mixes progress banners into stdout; banners are written to stderr
- `search --json` prints `[]` when there are no matches instead of the plain-text empty message
- Vector search excludes rows without a generated embedding instead of matching all-zero placeholder vectors

## [1.1.1] - 2026-05-07

### Fixed

- Global npm `starepo` binary now resolves symlinked bin paths before checking direct CLI execution

## [1.1.0] - 2026-05-07

### Fixed

- FTS index initialization test mock chain mismatch causing test failure
- Token file (`auth.json`) now created with `0o600` permissions instead of default `0o666`
- Topic filters now match exact topic tokens, including topics with spaces or special characters, instead of relying on substring matches
- Invalid embedding vector dimensions are rejected before storage writes
- GitHub starred repository sync now fails clearly when the API response shape is invalid
- Concurrent embedding generation now shares a single model initialization instead of loading the pipeline once per worker

### Changed

- Extract `parseListOptions()` to deduplicate sort/order validation and time range parsing across `search` and `list` commands
- Extract `resolveTimeRange()` helper in MCP server to deduplicate time range resolution
- `hasNonZeroVector()` now iterates directly instead of allocating via `Array.from()` for `Float32Array`
- Migrate from unmaintained `@xenova/transformers` to `@huggingface/transformers`
- Remove unused `SearchFilterOptions` type from `search.ts`
- Topic filtering now uses a schema v5 `topics_key` column while keeping `topics_text` for FTS search
- `search`, `list`, and MCP result limits now share positive integer validation with a maximum of 500
- CLI entrypoint now exposes `createProgram()` and `runCli()` for direct parser coverage
- Vitest coverage configuration moved from `package.json` into `vitest.config.ts`
- Embedding generation now loads the quantized `Xenova/bge-m3` q8 model by default and bumps embedding metadata to version 2

### Added

- `src/lib/lance-helpers.ts` — type-safe wrappers for LanceDB APIs, eliminating all `as any` / `as unknown as` casts from `storage.ts` (20+ → 0)
- ESLint flat config (`eslint.config.js`) with `typescript-eslint`
- `npm run lint` script
- GitHub Actions CI workflow (`.github/workflows/ci.yml`) — lint, type check, and tests on Node 18/20/22
- Runtime guards for GitHub starred repository API responses
- Embedding dimension guards for generated and manually updated vectors
- Accurate first-run embedding model download messaging
- Coverage thresholds for the test suite
- Expanded tests for auth, CLI parsing, GitHub response validation, MCP tools, schema migrations, sorting, syncing, and storage filters

## [1.0.0] - 2026-03-16

### Changed

- **BREAKING:** `sync` now defaults to smart sync (incremental if `last_sync` exists, full otherwise)
- **BREAKING:** Removed `--incremental` flag; use `--force` to override to full sync
- **BREAKING:** MCP `sync_stars` tool parameter changed from `incremental` to `force`

### Added

- Schema migration performance: batch `mergeInsert` replaces per-row `update` (10-100x faster for large migrations)
- Table compaction (`optimize`) after schema migrations to reclaim deleted rows

### Fixed

- Schema migrations now correctly handle Arrow vector serialization and version-specific column sets

## [0.4.0] - 2026-03-16

### Added

- `has_embedding` boolean column (schema v4) for O(1) embedding status queries, replacing full-table vector scans
- `embed --force` flag to fully rebuild all embeddings when the model or version changes
- Embedding model/version metadata (`embedding_model`, `embedding_version`) stored in config for upgrade detection
- `countReposWithoutEmbedding()` using `countRows()` for lightweight status checks
- `updateEmbeddingsBatch()` for chunked batch writes during embedding generation
- `getReposForEmbedding()` for the force-rebuild path (fetches all repos without vector filter)
- `EmbeddingGenerationOptions` / `EmbeddingGenerationResult` types; `generateAndStoreEmbeddings` now returns a structured result
- `embed` and `sync` commands show embedding coverage, outdated-model warnings, and `--force` hints

### Changed

- `generateAndStoreEmbeddings` accepts an options object instead of a bare `onProgress` callback
- Progress callback now fires during the generation phase (per repo), not the write phase
- `getReposWithoutEmbedding()` uses `WHERE has_embedding IS FALSE` instead of loading all rows into memory
- `hasAnyEmbeddings()` uses `countRows()` instead of `getReposWithoutEmbedding()` on the search hot path
- Schema migration to v4 backfills `has_embedding` from existing non-zero vectors automatically

## [0.3.0] - 2026-03-09

### Added

- `--sort <field>` option for `list` and `search` commands: `stars`, `forks`, `starred`, `updated`, `relevance`
- `--order <direction>` option for `list` and `search` commands: `asc`, `desc`
- `list` default sort: `starred desc` (most recently starred first)
- `search` default sort: `relevance desc` (semantic similarity order preserved)
- Enum validation for `--sort` and `--order`; invalid values exit with an error

### Changed

- `list` now fetches all matching repos before sorting, then slices to `--limit`, ensuring globally accurate top-N results
- MCP Server Integration section moved above Quick Start in both README files

## [0.2.0] - 2026-03-08

### Added

- Simplified Chinese README (`README.zh.md`) with language switcher links
- Agent Integration section in README with skills.sh installation instructions for Claude Code, Cursor, and other AI agents
- `SKILL.md` for `npx skills add yangyang0507/starepo` registration via skills.sh

### Changed

- Strip `vector` field from `--json` output in `search` and `list` commands
- Updated skills.sh setup to use `npx starepo` instead of global install
- `sync` command now auto-generates embeddings; `embed` is optional (use `--force` to repair)
- Moved `SKILL.md` to `skills/starepo/` for skills.sh compatibility

## [0.1.0] - 2026-03-08

### Added

- Initial project setup for starepo CLI
- Semantic search over GitHub starred repositories using local embeddings and vector storage
- `auth` command — OAuth device flow authentication with GitHub
- `sync` command — fetch and store starred repositories from GitHub
- `embed` command — generate local embeddings for stored repositories
- `search` command — semantic search across starred repositories
- `list` command — list all synced repositories with optional `--json` output
- `serve` command — expose search as an MCP (Model Context Protocol) server for AI agents
- LanceDB-based local vector storage
- `@xenova/transformers` for on-device embedding generation
- Configuration management with XDG Base Directory support
- Test suite covering config, embeddings, search, storage, and time utilities

[Unreleased]: https://github.com/yangyang0507/starepo/compare/v2.2.0...HEAD
[2.2.0]: https://github.com/yangyang0507/starepo/compare/v2.1.0...v2.2.0
[2.1.0]: https://github.com/yangyang0507/starepo/compare/v2.0.0...v2.1.0
[2.0.0]: https://github.com/yangyang0507/starepo/compare/v1.1.1...v2.0.0
[1.1.1]: https://github.com/yangyang0507/starepo/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/yangyang0507/starepo/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/yangyang0507/starepo/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/yangyang0507/starepo/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yangyang0507/starepo/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yangyang0507/starepo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yangyang0507/starepo/releases/tag/v0.1.0
