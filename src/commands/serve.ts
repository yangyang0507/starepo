import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { hybridSearch } from '../lib/search.js';
import { listRepos, getRepoByName, getStats, upsertRepos, Repo } from '../lib/storage.js';
import { ensureAuth } from './auth.js';
import { createOctokit, fetchAllStars } from '../lib/github.js';
import { setMeta } from '../lib/config.js';
import { resolveStarredTimeRange } from '../lib/time.js';

function repoToObject(repo: Repo): Record<string, unknown> {
  return {
    id: repo.id,
    full_name: repo.full_name,
    name: repo.name,
    description: repo.description,
    url: repo.html_url,
    homepage: repo.homepage,
    language: repo.language,
    topics: (() => { try { return JSON.parse(repo.topics); } catch { return []; } })(),
    stars: repo.stars_count,
    forks: repo.forks_count,
    starred_at: repo.starred_at,
  };
}

export async function runServe(): Promise<void> {
  const server = new Server(
    { name: 'starepo', version: '0.1.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: [
      {
        name: 'search_stars',
        description: 'Search your GitHub starred repositories by keyword or semantic description.',
        inputSchema: {
          type: 'object',
          properties: {
            query: { type: 'string', description: 'Search query (keyword or natural language)' },
            language: { type: 'string', description: 'Filter by programming language' },
            topic: { type: 'string', description: 'Filter by topic tag' },
            since: { type: 'string', description: 'Filter stars on/after date (ISO format)' },
            until: { type: 'string', description: 'Filter stars on/before date (ISO format)' },
            days: { type: 'number', description: 'Filter stars from last N days' },
            limit: { type: 'number', description: 'Max results (default: 10)' },
          },
        },
      },
      {
        name: 'list_stars',
        description: 'List your GitHub starred repositories with optional filters.',
        inputSchema: {
          type: 'object',
          properties: {
            language: { type: 'string', description: 'Filter by programming language' },
            topic: { type: 'string', description: 'Filter by topic tag' },
            query: { type: 'string', description: 'Search query (keyword or natural language)' },
            since: { type: 'string', description: 'Filter stars on/after date (ISO format)' },
            until: { type: 'string', description: 'Filter stars on/before date (ISO format)' },
            days: { type: 'number', description: 'Filter stars from last N days' },
            limit: { type: 'number', description: 'Max results (default: 50)' },
          },
        },
      },
      {
        name: 'get_star_info',
        description: 'Get detailed information about a specific starred repository.',
        inputSchema: {
          type: 'object',
          properties: {
            full_name: { type: 'string', description: 'Repository full name (e.g., "owner/repo")' },
          },
          required: ['full_name'],
        },
      },
      {
        name: 'sync_stars',
        description: 'Sync your GitHub starred repositories from GitHub.',
        inputSchema: { type: 'object', properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    switch (name) {
      case 'search_stars': {
        const query = (args?.query as string | undefined) ?? '';
        let range;
        try {
          range = resolveStarredTimeRange({
            since: args?.since as string | undefined,
            until: args?.until as string | undefined,
            days: args?.days as number | undefined,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new McpError(ErrorCode.InvalidParams, message);
        }
        const limit = (args?.limit as number) ?? 10;
        const hasFilter = Boolean(args?.language || args?.topic || range.starredAfter || range.starredBefore);
        if (!query && !hasFilter) {
          throw new McpError(
            ErrorCode.InvalidParams,
            'Provide query or at least one filter (language/topic/since/until/days).'
          );
        }
        const results = await hybridSearch(query, limit, {
          language: args?.language as string | undefined,
          topic: args?.topic as string | undefined,
          starredAfter: range.starredAfter,
          starredBefore: range.starredBefore,
        });
        return {
          content: [{ type: 'text', text: JSON.stringify(results.map(repoToObject), null, 2) }],
        };
      }

      case 'list_stars': {
        const query = args?.query as string | undefined;
        let range;
        try {
          range = resolveStarredTimeRange({
            since: args?.since as string | undefined,
            until: args?.until as string | undefined,
            days: args?.days as number | undefined,
          });
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          throw new McpError(ErrorCode.InvalidParams, message);
        }
        const repos = query
          ? await hybridSearch(query, (args?.limit as number) ?? 50, {
            language: args?.language as string | undefined,
            topic: args?.topic as string | undefined,
            starredAfter: range.starredAfter,
            starredBefore: range.starredBefore,
          })
          : await listRepos({
            language: args?.language as string | undefined,
            topic: args?.topic as string | undefined,
            starredAfter: range.starredAfter,
            starredBefore: range.starredBefore,
            limit: (args?.limit as number) ?? 50,
          });
        return {
          content: [{ type: 'text', text: JSON.stringify(repos.map(repoToObject), null, 2) }],
        };
      }

      case 'get_star_info': {
        const fullName = args?.full_name as string;
        if (!fullName) throw new McpError(ErrorCode.InvalidParams, 'full_name is required');
        const repo = await getRepoByName(fullName);
        if (!repo) {
          return {
            content: [{ type: 'text', text: `Repository "${fullName}" not found. Run sync_stars first.` }],
          };
        }
        return {
          content: [{ type: 'text', text: JSON.stringify(repoToObject(repo), null, 2) }],
        };
      }

      case 'sync_stars': {
        const token = await ensureAuth();
        const octokit = createOctokit(token);
        const repos = await fetchAllStars(octokit);
        await upsertRepos(repos);
        setMeta('last_sync', new Date().toISOString());
        const stats = await getStats();
        return {
          content: [{ type: 'text', text: `Sync complete. Total: ${stats.count} starred repos.` }],
        };
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  });

  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: [
      {
        uri: 'starepo://stars',
        name: 'All Starred Repositories',
        description: 'Overview of all your GitHub starred repositories',
        mimeType: 'application/json',
      },
    ],
  }));

  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const { uri } = request.params;

    if (uri === 'starepo://stars') {
      const stats = await getStats();
      const repos = await listRepos({ limit: 100 });
      return {
        contents: [{
          uri,
          mimeType: 'application/json',
          text: JSON.stringify({ stats, repos: repos.map(repoToObject) }, null, 2),
        }],
      };
    }

    const match = uri.match(/^starepo:\/\/stars\/(.+)$/);
    if (match) {
      const repo = await getRepoByName(match[1]);
      if (!repo) throw new McpError(ErrorCode.InvalidRequest, `Repository "${match[1]}" not found`);
      return {
        contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(repoToObject(repo), null, 2) }],
      };
    }

    throw new McpError(ErrorCode.InvalidRequest, `Unknown resource URI: ${uri}`);
  });

  const transport = new StdioServerTransport();
  await server.connect(transport);
}
