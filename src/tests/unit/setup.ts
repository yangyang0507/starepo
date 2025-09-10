import "@testing-library/jest-dom";
import { vi } from "vitest";

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock Electron API
const mockElectronAPI = {
  theme: {
    getTheme: vi.fn().mockResolvedValue('light'),
    setTheme: vi.fn().mockResolvedValue('light'),
    toggleTheme: vi.fn().mockResolvedValue('dark'),
    onThemeChanged: vi.fn().mockReturnValue(() => {}), // Return cleanup function
  },
  window: {
    minimize: vi.fn().mockResolvedValue({ success: true }),
    maximize: vi.fn().mockResolvedValue({ success: true }),
    close: vi.fn().mockResolvedValue({ success: true }),
  },
  language: {
    getLanguage: vi.fn().mockResolvedValue({ success: true, data: 'zh-CN' }),
    setLanguage: vi.fn().mockResolvedValue({ success: true }),
  },
};

// Mock window.electronAPI
Object.defineProperty(window, 'electronAPI', {
  writable: true,
  value: mockElectronAPI,
});

// Mock window.electronWindow
Object.defineProperty(window, 'electronWindow', {
  writable: true,
  value: {
    minimize: vi.fn(),
    maximize: vi.fn(),
    close: vi.fn(),
  },
});
