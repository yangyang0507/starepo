---
name: starepo
description: Search GitHub starred repositories with semantic/hybrid search. Trigger when user asks to find, search, or explore their GitHub stars, or wants to recall starred projects by topic, language, or description.
---

# Starepo — GitHub Stars Semantic Search

Use the `starepo` CLI to help users find repositories in their GitHub starred collection through hybrid (vector + full-text) search.

## When to Use

- User asks: "find my starred repos about X", "search my stars for Y"
- User wants to recall a repo they starred but can't remember the name
- User asks to list stars filtered by language, topic, or date
- User wants to see details about a specific starred repo

## Setup (First Time)

Run these steps once. Skip any step that's already done.

```bash
# 1. Install the CLI
npm install -g starepo

# 2. Authenticate with GitHub (Device Flow — no token needed)
starepo auth

# 3. Sync all starred repos from GitHub
starepo sync

# 4. Generate local embeddings for semantic search
starepo embed
```

Check sync status anytime:
```bash
starepo list --limit 5
```

## Semantic Search

```bash
# Search by meaning (recommended)
starepo search "fast key-value store in Rust"
starepo search "react state management without boilerplate"
starepo search "machine learning in Python"

# With language filter
starepo search "http server" --lang Go

# With topic filter
starepo search "ui components" --topic react

# JSON output (for further processing)
starepo search "cli tools" --json

# Control number of results (default: 10)
starepo search "databases" --limit 20
```

## List & Filter

```bash
# List all starred repos
starepo list

# Filter by language
starepo list --lang TypeScript

# Filter by topic
starepo list --topic "machine-learning"

# Filter by date starred
starepo list --since 2026-01-01
starepo list --days 30        # starred in last 30 days
starepo list --since 2026-01-01 --until 2026-03-01
```

## Repo Details

```bash
starepo info facebook/react
starepo info vercel/next.js
```

## Sync & Embed

```bash
# Quick sync (only new stars since last sync)
starepo sync --incremental

# Full re-sync
starepo sync

# Regenerate all embeddings (after model update)
starepo embed --force
```

## MCP Server (for Claude Desktop / Cursor)

Add to `claude_desktop_config.json`:
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

## Workflow Tips

1. **First search fails or returns nothing** → Run `starepo sync` then `starepo embed`
2. **Stale results** → Run `starepo sync --incremental` to fetch new stars
3. **Poor semantic relevance** → Embeddings may be missing; run `starepo embed`
4. **Filter + search** → Combine `--query` with `--lang`/`--topic`/`--days` for precise results
5. **Automation** → Use `--json` flag to pipe results to `jq` or other tools
