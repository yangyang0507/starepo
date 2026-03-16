# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/yangyang0507/starepo/compare/v1.0.0...HEAD
[1.0.0]: https://github.com/yangyang0507/starepo/compare/v0.4.0...v1.0.0
[0.4.0]: https://github.com/yangyang0507/starepo/compare/v0.3.0...v0.4.0
[0.3.0]: https://github.com/yangyang0507/starepo/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yangyang0507/starepo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yangyang0507/starepo/releases/tag/v0.1.0
