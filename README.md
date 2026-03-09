# Starepo

Search your GitHub starred repositories with semantic search.

English | [简体中文](./README.zh.md)

## Features

- 🔍 **Semantic Search** - Natural language queries powered by local embeddings
- ⚡ **Fast Keyword Search** - Full-text search fallback for instant results
- 🔃 **Flexible Sorting** - Sort results by stars, forks, starred date, or updated date
- 🤖 **MCP Server** - Integrate with Claude Desktop, Cursor, and other AI tools
- 🔐 **Zero Config** - GitHub Device Flow authentication, no tokens needed
- 💾 **Local Storage** - All data stored locally with LanceDB (no compilation required)
- 🌍 **Multilingual** - Supports English, Chinese, and other languages

## Installation

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

## MCP Server Integration

Starepo can run as an MCP server to integrate with AI assistants.

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "starepo": {
      "command": "starepo",
      "args": ["serve"]
    }
  }
}
```

Or if installed locally:

```json
{
  "mcpServers": {
    "starepo": {
      "command": "npx",
      "args": ["starepo", "serve"]
    }
  }
}
```

### Available MCP Tools

- `search_stars(query?, language?, topic?, since?, until?, days?, limit?)` - Search repositories with combined filters
- `list_stars(query?, language?, topic?, since?, until?, days?, limit?)` - List with combined filters
- `get_star_info(full_name)` - Get repository details
- `sync_stars()` - Trigger sync from GitHub

### MCP Resources

- `starepo://stars` - All starred repositories overview
- `starepo://stars/{owner}/{repo}` - Specific repository details

## Quick Start

### 1. Authenticate with GitHub

```bash
starepo auth
```

Follow the prompts to authorize via GitHub Device Flow.

### 2. Sync Your Stars

```bash
# Full sync (first time)
starepo sync

# Incremental sync (only new stars)
starepo sync --incremental

# Skip embedding generation (faster)
starepo sync --no-embeddings
```

### 3. Search

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
```

## Commands

### `auth`

Authenticate with GitHub (runs automatically on first use).

```bash
starepo auth
starepo auth --force  # Re-authenticate
```

### `sync`

Sync your GitHub starred repositories.

```bash
starepo sync                # Full sync
starepo sync --incremental  # Only new stars
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
```

**Search modes:**
- If embeddings exist: **Hybrid search** (vector + keyword)
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
```

**Sort options (`--sort`):** `starred` (default), `stars`, `forks`, `updated`

**Order options (`--order`):** `desc` (default), `asc`

### `info <owner/repo>`

Show detailed information about a repository.

```bash
starepo info facebook/react
```

### `serve`

Start the MCP server (stdio mode).

```bash
starepo serve
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
| Language | TypeScript (Node.js) | MCP SDK native support |
| GitHub API | `@octokit/rest` | Official SDK with pagination |
| Auth | `@octokit/auth-oauth-device` | CLI-friendly Device Flow |
| Storage | `@lancedb/lancedb` | Zero-compilation vector DB |
| Embeddings | `@xenova/transformers` | Local, offline-capable |
| CLI | `commander` | Lightweight, type-safe |
| MCP | `@modelcontextprotocol/sdk` | Official SDK |

### Search Strategy

**L1: Keyword Search (FTS)**
- LanceDB INVERTED index on name/description/topics
- Fallback to filter-based search if index unavailable
- Instant results, zero dependencies

**L2: Vector Search**
- Local embeddings via `Xenova/bge-m3` (1024-dim)
- Cosine similarity ranking
- Supports natural language and multilingual queries

**L3: Hybrid Search**
- Combines vector + keyword results
- Deduplicates and re-ranks by relevance
- Best of both worlds

## Development

```bash
# Clone the repository
git clone https://github.com/yourusername/starepo.git
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

### No search results

Run `starepo sync` to ensure:
1. Data is synced from GitHub
2. Embeddings are generated (first sync only)

### Slow first sync

Embedding generation takes ~0.5s per repo. For 1000+ stars:
- Use `--no-embeddings` for faster initial sync
- Generate embeddings later by running `starepo sync` again

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
- [Transformers.js](https://github.com/xenova/transformers.js) - Local ML inference
- [Octokit](https://github.com/octokit/octokit.js) - GitHub API client
- [MCP SDK](https://github.com/modelcontextprotocol/sdk) - Model Context Protocol
