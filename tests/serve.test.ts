import { describe, it, expect, beforeEach, vi } from 'vitest';

type MockRequest = { params: Record<string, unknown> };
type MockResponse = {
  tools?: Array<{ name: string; inputSchema: { properties: Record<string, unknown> } }>;
  content?: Array<{ text: string }>;
};
type RequestHandler = (request: MockRequest) => Promise<MockResponse>;

const handlers = new Map<string, RequestHandler>();
const sampleRepo = {
  id: 1,
  full_name: 'user/repo',
  name: 'repo',
  description: 'A useful repo',
  html_url: 'https://github.com/user/repo',
  homepage: '',
  language: 'TypeScript',
  topics: '["cli"]',
  stars_count: 10,
  forks_count: 2,
  starred_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-02T00:00:00Z',
};

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class MockServer {
    setRequestHandler(schema: { method: string }, handler: RequestHandler) {
      handlers.set(schema.method, handler);
    }
    async connect() {}
  },
}));

vi.mock('@modelcontextprotocol/sdk/server/stdio.js', () => ({
  StdioServerTransport: class MockTransport {},
}));

vi.mock('@modelcontextprotocol/sdk/types.js', () => ({
  CallToolRequestSchema: { method: 'tools/call' },
  ListToolsRequestSchema: { method: 'tools/list' },
  ListResourcesRequestSchema: { method: 'resources/list' },
  ReadResourceRequestSchema: { method: 'resources/read' },
  ErrorCode: {
    InvalidParams: 'InvalidParams',
    MethodNotFound: 'MethodNotFound',
    InvalidRequest: 'InvalidRequest',
  },
  McpError: class McpError extends Error {
    code: string;
    constructor(code: string, message: string) {
      super(message);
      this.code = code;
    }
  },
}));

describe('runServe', () => {
  beforeEach(() => {
    handlers.clear();
    vi.resetModules();
  });

  async function startServer(mocks: {
    hybridSearch?: ReturnType<typeof vi.fn>;
    listRepos?: ReturnType<typeof vi.fn>;
    getRepoByName?: ReturnType<typeof vi.fn>;
    getStats?: ReturnType<typeof vi.fn>;
    runSync?: ReturnType<typeof vi.fn>;
    resolveStarredTimeRange?: ReturnType<typeof vi.fn>;
  } = {}) {
    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: mocks.hybridSearch ?? vi.fn(),
    }));
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: mocks.listRepos ?? vi.fn(),
      getRepoByName: mocks.getRepoByName ?? vi.fn(),
      getStats: mocks.getStats ?? vi.fn().mockResolvedValue({ count: 42, lastSync: null }),
    }));
    vi.doMock('../src/lib/time.js', () => ({
      resolveStarredTimeRange: mocks.resolveStarredTimeRange ?? vi.fn().mockReturnValue({}),
    }));
    vi.doMock('../src/commands/sync.js', () => ({
      runSync: mocks.runSync ?? vi.fn(),
    }));
    vi.doMock('../src/lib/version.js', () => ({
      VERSION: '9.9.9-test',
    }));

    const { runServe } = await import('../src/commands/serve.js');
    await runServe();

    return {
      listToolsHandler: handlers.get('tools/list')!,
      callToolHandler: handlers.get('tools/call')!,
      listResourcesHandler: handlers.get('resources/list')!,
      readResourceHandler: handlers.get('resources/read')!,
    };
  }

  it('exposes sync_stars with force support and forwards the option to runSync', async () => {
    const runSync = vi.fn().mockResolvedValue(undefined);
    const { listToolsHandler, callToolHandler } = await startServer({ runSync });

    const listed = await listToolsHandler!({ params: {} });
    const syncTool = listed.tools?.find((tool) => tool.name === 'sync_stars');
    expect(syncTool).toBeDefined();
    expect(syncTool?.inputSchema.properties.force).toBeDefined();

    const result = await callToolHandler!({
      params: {
        name: 'sync_stars',
        arguments: { force: true },
      },
    });

    expect(runSync).toHaveBeenCalledWith({ force: true });
    expect(result.content?.[0].text).toContain('42');
  });

  it('rejects invalid tool limits before running a search', async () => {
    const hybridSearch = vi.fn();
    const { callToolHandler } = await startServer({ hybridSearch });
    await expect(callToolHandler!({
      params: {
        name: 'search_stars',
        arguments: { query: 'react', limit: 0 },
      },
    })).rejects.toMatchObject({
      code: 'InvalidParams',
      message: expect.stringContaining('Invalid limit value'),
    });

    expect(hybridSearch).not.toHaveBeenCalled();
  });

  it('routes search and list tools with filters and serialized repo output', async () => {
    const hybridSearch = vi.fn().mockResolvedValue([sampleRepo]);
    const listRepos = vi.fn().mockResolvedValue([sampleRepo]);
    const resolveStarredTimeRange = vi.fn().mockReturnValue({ starredAfter: '2026-01-01T00:00:00.000Z' });
    const { callToolHandler } = await startServer({ hybridSearch, listRepos, resolveStarredTimeRange });

    const searchResult = await callToolHandler({
      params: {
        name: 'search_stars',
        arguments: { query: 'cli', language: 'TypeScript', limit: 5, since: '2026-01-01' },
      },
    });
    const listResult = await callToolHandler({
      params: {
        name: 'list_stars',
        arguments: { topic: 'cli', limit: 3, since: '2026-01-01' },
      },
    });

    expect(hybridSearch).toHaveBeenCalledWith('cli', 5, {
      language: 'TypeScript',
      topic: undefined,
      starredAfter: '2026-01-01T00:00:00.000Z',
      starredBefore: undefined,
    });
    expect(listRepos).toHaveBeenCalledWith({
      language: undefined,
      topic: 'cli',
      starredAfter: '2026-01-01T00:00:00.000Z',
      starredBefore: undefined,
      limit: 3,
    });
    expect(resolveStarredTimeRange).toHaveBeenCalledWith({ since: '2026-01-01', until: undefined, days: undefined });
    expect(JSON.parse(searchResult.content![0].text)[0]).toMatchObject({ full_name: 'user/repo', topics: ['cli'] });
    expect(JSON.parse(listResult.content![0].text)[0]).toMatchObject({ full_name: 'user/repo' });
  });

  it('returns repository info and starred resources', async () => {
    const getRepoByName = vi.fn().mockResolvedValue(sampleRepo);
    const listRepos = vi.fn().mockResolvedValue([sampleRepo]);
    const getStats = vi.fn().mockResolvedValue({ count: 1, lastSync: '2026-01-03T00:00:00Z' });
    const { callToolHandler, listResourcesHandler, readResourceHandler } = await startServer({
      getRepoByName,
      listRepos,
      getStats,
    });

    const infoResult = await callToolHandler({
      params: { name: 'get_star_info', arguments: { full_name: 'user/repo' } },
    });
    const resources = await listResourcesHandler({ params: {} });
    const allStars = await readResourceHandler({ params: { uri: 'starepo://stars' } });
    const oneStar = await readResourceHandler({ params: { uri: 'starepo://stars/user/repo' } });

    expect(JSON.parse(infoResult.content![0].text)).toMatchObject({ full_name: 'user/repo' });
    expect(resources.resources?.[0]).toMatchObject({ uri: 'starepo://stars' });
    expect(JSON.parse(allStars.contents![0].text)).toMatchObject({ stats: { count: 1 } });
    expect(JSON.parse(oneStar.contents![0].text)).toMatchObject({ full_name: 'user/repo' });
  });
});
