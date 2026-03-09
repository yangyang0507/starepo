# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/yangyang0507/starepo/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/yangyang0507/starepo/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/yangyang0507/starepo/compare/v0.1.0...v0.2.0
[0.1.0]: https://github.com/yangyang0507/starepo/releases/tag/v0.1.0
