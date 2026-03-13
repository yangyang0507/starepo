import { describe, it, expect, beforeEach, vi } from 'vitest';

const handlers = new Map<string, (request: any) => Promise<any>>();

vi.mock('@modelcontextprotocol/sdk/server/index.js', () => ({
  Server: class MockServer {
    setRequestHandler(schema: { method: string }, handler: (request: any) => Promise<any>) {
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

  it('exposes sync_stars with incremental support and forwards the option to runSync', async () => {
    const runSync = vi.fn().mockResolvedValue(undefined);

    vi.doMock('../src/lib/search.js', () => ({
      hybridSearch: vi.fn(),
    }));
    vi.doMock('../src/lib/storage.js', () => ({
      listRepos: vi.fn(),
      getRepoByName: vi.fn(),
      getStats: vi.fn().mockResolvedValue({ count: 42, lastSync: null }),
    }));
    vi.doMock('../src/lib/time.js', () => ({
      resolveStarredTimeRange: vi.fn().mockReturnValue({}),
    }));
    vi.doMock('../src/commands/sync.js', () => ({
      runSync,
    }));
    vi.doMock('../src/lib/version.js', () => ({
      VERSION: '9.9.9-test',
    }));

    const { runServe } = await import('../src/commands/serve.js');
    await runServe();

    const listToolsHandler = handlers.get('tools/list');
    const callToolHandler = handlers.get('tools/call');

    expect(listToolsHandler).toBeDefined();
    expect(callToolHandler).toBeDefined();

    const listed = await listToolsHandler!({ params: {} });
    const syncTool = listed.tools.find((tool: { name: string }) => tool.name === 'sync_stars');
    expect(syncTool).toBeDefined();
    expect(syncTool.inputSchema.properties.incremental).toBeDefined();

    const result = await callToolHandler!({
      params: {
        name: 'sync_stars',
        arguments: { incremental: true },
      },
    });

    expect(runSync).toHaveBeenCalledWith({ incremental: true });
    expect(result.content[0].text).toContain('42');
  });
});
