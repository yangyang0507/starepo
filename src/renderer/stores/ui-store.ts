import { create } from 'zustand';
import type { FilterOptions, ViewOptions } from '@/services/github/types';

interface UIStore {
  // Search and filter state
  searchQuery: string;
  filters: FilterOptions;
  viewOptions: ViewOptions;
  currentPage: number;

  // Actions
  setSearchQuery: (query: string) => void;
  setFilters: (filters: FilterOptions) => void;
  setViewOptions: (options: ViewOptions) => void;
  setCurrentPage: (page: number) => void;
  resetPage: () => void;
  resetFilters: () => void;
}

const defaultFilters: FilterOptions = {
  sortBy: 'updated',
  sortOrder: 'desc',
  showArchived: false,
  showForks: true,
};

const defaultViewOptions: ViewOptions = {
  layout: 'grid',
  itemsPerPage: 20,
  showDescription: true,
  showLanguage: true,
  showStats: true,
  showTopics: true,
};

export const useUIStore = create<UIStore>((set) => ({
  // Initial state
  searchQuery: '',
  filters: defaultFilters,
  viewOptions: defaultViewOptions,
  currentPage: 1,

  // Actions
  setSearchQuery: (query: string) => {
    set({ searchQuery: query, currentPage: 1 }); // Reset page when searching
  },

  setFilters: (filters: FilterOptions) => {
    set({ filters, currentPage: 1 }); // Reset page when filtering
  },

  setViewOptions: (options: ViewOptions) => {
    set((state) => ({
      viewOptions: options,
      // Reset page if items per page changed
      currentPage: options.itemsPerPage !== state.viewOptions.itemsPerPage ? 1 : state.currentPage,
    }));
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },

  resetPage: () => {
    set({ currentPage: 1 });
  },

  resetFilters: () => {
    set({
      searchQuery: '',
      filters: defaultFilters,
      viewOptions: defaultViewOptions,
      currentPage: 1,
    });
  },
}));