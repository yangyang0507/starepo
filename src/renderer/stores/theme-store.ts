import { create } from 'zustand';
import { themeAPI } from '@/api';
import type { ThemeMode } from '@shared/types';

interface ThemeStore {
  theme: ThemeMode;
  isLoading: boolean;
  error: string | null;
  themeListenerSetup?: boolean;
  
  // Actions
  initTheme: () => Promise<void>;
  toggleTheme: () => Promise<void>;
  changeTheme: (newTheme: ThemeMode) => Promise<void>;
  clearError: () => void;
}

// Helper function to update DOM theme
const updateDOMTheme = (themeMode: ThemeMode) => {
  // Remove existing theme classes
  document.documentElement.classList.remove('dark', 'light');

  if (themeMode === 'dark') {
    document.documentElement.classList.add('dark');
  } else if (themeMode === 'light') {
    document.documentElement.classList.add('light');
  } else {
    // system theme - detect system theme
    const systemIsDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    if (systemIsDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.add('light');
    }
  }
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  theme: 'system',
  isLoading: true,
  error: null,
  themeListenerSetup: false,

  initTheme: async () => {
    const { isLoading } = get();
    if (!isLoading) return; // Prevent multiple initializations

    try {
      set({ error: null });

      // Check localStorage for theme setting
      const localTheme = localStorage.getItem('theme') as ThemeMode | null;

      if (localTheme) {
        // Use local setting if available
        await themeAPI.setTheme(localTheme);
        set({ theme: localTheme, isLoading: false });
        updateDOMTheme(localTheme);
      } else {
        // Otherwise get current theme (defaults to system)
        const currentTheme = await themeAPI.getTheme();
        set({ theme: currentTheme, isLoading: false });
        updateDOMTheme(currentTheme);
      }

      // Set up theme change listener (only once)
      if (!get().themeListenerSetup) {
        themeAPI.onThemeChanged((newTheme) => {
          set({ theme: newTheme });
          updateDOMTheme(newTheme);
        });
        set({ themeListenerSetup: true });
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to load theme';
      set({ 
        error: errorMessage, 
        isLoading: false,
        theme: 'system' 
      });
      console.error('Failed to load theme:', err);
      // Set default theme on error
      updateDOMTheme('system');
    }
  },

  toggleTheme: async () => {
    try {
      set({ error: null });
      const newTheme = await themeAPI.toggleTheme();
      set({ theme: newTheme });
      updateDOMTheme(newTheme);
      localStorage.setItem('theme', newTheme);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to toggle theme';
      set({ error: errorMessage });
      console.error('Failed to toggle theme:', err);
    }
  },

  changeTheme: async (newTheme: ThemeMode) => {
    try {
      set({ error: null });
      const updatedTheme = await themeAPI.setTheme(newTheme);
      set({ theme: updatedTheme });
      updateDOMTheme(updatedTheme);
      localStorage.setItem('theme', updatedTheme);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to change theme';
      set({ error: errorMessage });
      console.error('Failed to change theme:', err);
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));