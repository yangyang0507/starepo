# Starepo

Search your GitHub starred repositories with semantic search.

English | [简体中文](./README.zh.md)

## Features

- 🔍 **Semantic Search** - Natural language queries powered by local embeddings
- 🖥️ **Interactive Browser** - Run `starepo` for a full-screen search-as-you-type UI with a preview pane
- ⚡ **Fast Keyword Search** - Full-text search fallback for instant results
- 🔃 **Flexible Sorting** - Sort results by stars, forks, starred date, or updated date
- 🔐 **Zero Config** - GitHub Device Flow authentication, no tokens needed
- 💾 **Local Storage** - All data stored locally with LanceDB (no compilation required)
- 🌍 **Multilingual** - Supports English, Chinese, and other languages

## Installation

Requires Node.js 22.12 or later.

```bash
npm install -g starepo
```

Or use with `npx` (no installation required):

```bash
npx starepo <command>
```

## Agent Integration (skills.sh)

Install the starepo skill into Claude Code, Cursor, and other AI agents with one command:

```bash
npx skills add yangyang0507/starepo
```

Once installed, your AI agent can search your GitHub stars directly. Just ask naturally:

> "Find my starred repos about semantic search"
> "Show me TypeScript repos I starred this month"

## Quick Start

### 1. Authenticate with GitHub

```bash
starepo auth
```

starepo shows a one-time code and copies it to your clipboard; press Enter to open the GitHub device page, paste the code, and approve.

### 2. Sync Your Stars

```bash
# Full reconcile (new stars, metadata, and unstars)
starepo sync

# Add-only (stars since last sync)
starepo sync --incremental

# Skip embedding generation (faster)
starepo sync --no-embeddings
```

### 3. Search

Run `starepo` with no arguments to browse interactively: type to search, `↑↓` to move, `Enter` to open in the browser.

```bash
# Semantic search (natural language)
starepo search "react state management library"
starepo search "ai design tool"

# Search with structured filters
starepo search "react" --lang TypeScript --topic hooks
starepo search --query "state" --since 2026-03-01 --until 2026-03-08
starepo search --lang TypeScript --days 7

# Limit results
starepo search "python web framework" --limit 5

# Sort results
starepo search "rust cli" --sort stars
starepo search "react" --sort forks --order asc

# JSON output
starepo search "rust cli" --json

# Compact one-line results
starepo search "rust cli" --oneline
```

## Commands

### `auth`

Authenticate with GitHub (runs automatically on first use).

```bash
starepo auth
starepo auth --force  # Re-authenticate (e.g. to switch accounts)
starepo auth --logout # Remove the stored token
```

### `sync`

Sync your GitHub starred repositories.

```bash
starepo sync                 # Full reconcile (new stars, metadata, unstars)
starepo sync --incremental   # Only fetch stars since last sync
starepo sync --force         # Same as a full reconcile
starepo sync --no-embeddings # Skip embeddings
```

**Note:** First sync generates embeddings for semantic search (~0.5s per repo). For 1000+ stars, this takes ~10 minutes.

### `embed`

Generate or regenerate embeddings for semantic search.

```bash
starepo embed              # Generate missing embeddings only
starepo embed --force      # Regenerate all embeddings
```

**Use cases:**
- Resume interrupted embedding generation
- Upgrade to a newer embedding model
- Fix corrupted embeddings

### `browse [query]`

Full-screen interactive search. This is also what a bare `starepo` opens in a terminal; in scripts and pipes it prints help instead, so use `search --json` there.

```bash
starepo              # same as `starepo browse`
starepo browse "vector database"
```

| Key | Action |
|---|---|
| typing | Filter instantly by keyword; semantic results replace them after a short pause |
| `↑` `↓` / `Ctrl-P` `Ctrl-N` | Move the selection (`PgUp` `PgDn` `Home` `End` jump) |
| `Enter` | Open the selected repo in your browser |
| `Ctrl-Y` | Copy the repo URL |
| `Tab` | Cycle sort: relevance → recently starred → most stars → recently updated |
| `Ctrl-W` / `Ctrl-U` | Delete a word / clear the query |
| `Esc` | Clear the query; press again to quit (`Ctrl-C` quits anytime) |

Wide terminals (100+ columns) show a preview pane with the description, topics, and dates; narrower ones show the selected description in a strip under the list.

### `search [query]`

Search your starred repositories.

```bash
starepo search "query"
starepo search --query "query"
starepo search "query" --limit 10
starepo search "query" --lang TypeScript --topic react
starepo search "query" --since 2026-03-01 --until 2026-03-08
starepo search --lang TypeScript --days 7
starepo search "query" --sort stars           # Sort by star count (desc)
starepo search "query" --sort forks --order asc  # Sort by forks ascending
starepo search "query" --json
starepo search "query" --oneline
```

In a terminal, `starepo search` with no query or filters opens the interactive browser (see `browse`).

**Search modes:**
- If embeddings exist: **Hybrid search** (vector + keyword, ranked with reciprocal rank fusion)
- Otherwise: **Keyword search** (full-text fallback)

**Sort options (`--sort`):** `relevance` (default), `stars`, `forks`, `starred`, `updated`

**Order options (`--order`):** `desc` (default), `asc`

### `list`

List your starred repositories with filters.

```bash
starepo list
starepo list --query "react"
starepo list --lang TypeScript
starepo list --topic ai
starepo list --since 2026-03-01 --until 2026-03-08
starepo list --days 7
starepo list --limit 20
starepo list --sort stars              # Sort by star count (desc)
starepo list --sort starred --order asc  # Oldest starred first
starepo list --sort updated            # Recently updated first
starepo list --json
starepo list --oneline
```

**Sort options (`--sort`):** `starred` (default), `stars`, `forks`, `updated`

**Order options (`--order`):** `desc` (default), `asc`

### `info <owner/repo>`

Show detailed information about a repository.

```bash
starepo info facebook/react
```

### `status`

Show local auth, database, sync, and embedding status.

```bash
starepo status
starepo status --json
```

## Configuration

All data is stored in XDG-compliant directories:

- **Config**: `~/.config/starepo/`
  - `auth.json` - GitHub token
  - `meta.json` - Sync metadata
- **Data**: `~/.local/share/starepo/`
  - `lancedb/` - LanceDB database with embeddings

## Architecture

### Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| Language | TypeScript (Node.js) | Type-safe CLI development |
| GitHub API | `@octokit/rest` | Official SDK with pagination |
| Auth | `@octokit/auth-oauth-device` | CLI-friendly Device Flow |
| Storage | `@lancedb/lancedb` | Zero-compilation vector DB |
| Embeddings | `@huggingface/transformers` | Local, offline-capable |
| CLI | `commander` | Lightweight, type-safe |

### Search Strategy

**L1: Keyword Search (FTS)**
- LanceDB INVERTED index on name/description/topics
- Fallback to filter-based search if index unavailable
- Instant results, zero dependencies

**L2: Vector Search**
- Local embeddings via quantized `Xenova/bge-m3` q8 (1024-dim, about 550 MB cached on first use)
- Cosine similarity ranking
- Supports natural language and multilingual queries

**L3: Hybrid Search**
- Combines vector + keyword results with reciprocal rank fusion
- Deduplicates and re-ranks by fused relevance
- Best of both worlds

## Development

```bash
# Clone the repository
git clone https://github.com/yangyang0507/starepo.git
cd starepo

# Install dependencies
npm install

# Build
npm run build

# Dev mode (with tsx)
npm run dev -- search "query"

# Type check
npx tsc --noEmit

# Test locally
npm link
starepo --help
```

## Troubleshooting

### Upgrading from 1.x

Starepo 2.0 requires Node.js 22.12+ and no longer includes `starepo serve`. Search from agents with the CLI or the starepo skill.

LanceDB was upgraded to 0.38. If `starepo search` or `starepo sync` fails to open the local database, delete it and resync:

```bash
rm -rf "${XDG_DATA_HOME:-$HOME/.local/share}/starepo/lancedb"
starepo sync --force
```

Existing FTS indexes are rebuilt automatically on the next search.

### No search results

Run `starepo sync` to ensure:
1. Data is synced from GitHub
2. Embeddings are generated (first sync, or later with `starepo embed`)

### Slow first sync

Embedding generation takes ~0.5s per repo. For 1000+ stars:
- Use `--no-embeddings` for faster initial sync
- Generate embeddings later with `starepo embed`

### Command not found after global install

Ensure npm global bin directory is in your PATH:
```bash
npm config get prefix
# Add <prefix>/bin to your PATH
```

## License

MIT

## Credits

Built with:
- [LanceDB](https://github.com/lancedb/lancedb) - Modern vector database
- [Transformers.js](https://github.com/huggingface/transformers.js) - Local ML inference
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
