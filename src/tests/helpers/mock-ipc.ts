/**
 * IPC Mock 工具
 * 用于模拟 Electron IPC 通信
 */

import { vi } from "vitest";

export interface MockIPCHandlers {
  handle: ReturnType<typeof vi.fn>;
  invoke: ReturnType<typeof vi.fn>;
  send: ReturnType<typeof vi.fn>;
  on: ReturnType<typeof vi.fn>;
  removeListener: ReturnType<typeof vi.fn>;
}

export function createMockIPC(): MockIPCHandlers {
  const handlers = new Map<string, Function>();
  const listeners = new Map<string, Set<Function>>();

  return {
    handle: vi.fn((channel: string, handler: Function) => {
      handlers.set(channel, handler);
    }),

    invoke: vi.fn(async (channel: string, ...args: any[]) => {
      const handler = handlers.get(channel);
      if (!handler) {
        throw new Error(`No handler registered for channel: ${channel}`);
      }
      return handler({}, ...args);
    }),

    send: vi.fn((channel: string, ...args: any[]) => {
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        channelListeners.forEach((listener) => listener({}, ...args));
      }
    }),

    on: vi.fn((channel: string, listener: Function) => {
      if (!listeners.has(channel)) {
        listeners.set(channel, new Set());
      }
      listeners.get(channel)!.add(listener);
    }),

    removeListener: vi.fn((channel: string, listener: Function) => {
      const channelListeners = listeners.get(channel);
      if (channelListeners) {
        channelListeners.delete(listener);
      }
    }),
  };
}

export function mockElectronAPI() {
  const ipc = createMockIPC();

  return {
    invoke: ipc.invoke,
    send: ipc.send,
    on: ipc.on,
    removeListener: ipc.removeListener,
  };
}

export function setupGlobalMocks() {
  const electronAPI = mockElectronAPI();

  (global as any).window = {
    ...global.window,
    electronAPI,
  };

  return electronAPI;
}
