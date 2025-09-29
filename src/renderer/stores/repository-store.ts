import { create } from 'zustand';
import { githubAPI, searchAPI } from '@/api';
import type {
  GitHubRepository,
  GitHubUser,
  FilterOptions,
  ViewOptions,
  AuthState,
} from "@shared/types"

interface CacheStatus {
  hasCache: boolean;
  isFresh: boolean;
  lastUpdated?: Date;
  totalCount?: number;
}

interface RepositoryStore {
  // State
  user: GitHubUser | null;
  repositories: GitHubRepository[];
  displayRepositories: GitHubRepository[];
  starredRepoIds: Set<number>;
  loading: boolean;
  error: string | null;
  syncing: boolean;
  loadingProgress: number | null;
  totalLoaded: number;
  fromCache: boolean;
  cacheStatus: CacheStatus | null;
  refreshMessage: string | null;
  searchQuery: string;
  filterOptions: FilterOptions;
  viewOptions: ViewOptions;
  currentPage: number;

  // Actions
  initializeData: () => Promise<void>;
  refreshData: () => Promise<void>;
  refreshUserInfo: () => Promise<void>;
  starRepository: (repo: GitHubRepository) => Promise<void>;
  unstarRepository: (repo: GitHubRepository) => Promise<void>;
  logout: () => Promise<void>;
  clearError: () => void;
  clearRefreshMessage: () => void;
  checkAndUpdateCache: () => Promise<void>;
  setSearchQuery: (query: string) => void;
  setFilterOptions: (options: Partial<FilterOptions>) => void;
  setViewOptions: (options: Partial<ViewOptions>) => void;
  setCurrentPage: (page: number) => void;
  applyFiltersAndSearch: () => Promise<void>;
}

export const useRepositoryStore = create<RepositoryStore>((set, get) => ({
  // Initial state
  user: null,
  repositories: [],
  displayRepositories: [],
  starredRepoIds: new Set(),
  loading: true,
  error: null,
  syncing: false,
  loadingProgress: null,
  totalLoaded: 0,
  fromCache: false,
  cacheStatus: null,
  refreshMessage: null,
  searchQuery: '',
  filterOptions: {
    sortBy: 'updated',
    sortOrder: 'desc',
    showArchived: false,
    showForks: true,
  },
  viewOptions: {
    layout: 'grid',
    itemsPerPage: 20,
    showDescription: true,
    showLanguage: true,
    showStats: true,
    showTopics: true,
  },
  currentPage: 1,

  // Actions
  initializeData: async () => {
    set({ loading: true, error: null });

    try {
      // Check authentication
      const authState = await githubAPI.getAuthState() as AuthState;
      if (!authState.isAuthenticated) {
        set({
          loading: false,
          error: '请先进行GitHub认证',
        });
        return;
      }

      // Get user info
      const user = await githubAPI.getCurrentUser() as GitHubUser;

      // Get all starred repositories
      const starredData = await githubAPI.getAllStarredRepositories({
        batchSize: 100,
        onProgress: (loaded: number, total: number) => {
          const progress = total ? Math.round((loaded / total) * 100) : null;
          set({
            loadingProgress: progress,
            totalLoaded: loaded,
          });
        },
      });

      const repositories = (starredData as any).repositories.map((starredRepo: any) => ({
        ...starredRepo,
        starred_at: undefined,
      })) as GitHubRepository[];

      const starredRepoIds = new Set(repositories.map((repo) => repo.id));

      set({
        user,
        repositories,
        starredRepoIds,
        loading: false,
        error: null,
        syncing: false,
        loadingProgress: null,
        totalLoaded: (starredData as any).totalLoaded,
        fromCache: (starredData as any).fromCache || false,
        cacheStatus: null,
        refreshMessage: null,
      });

      await get().applyFiltersAndSearch();

      // TODO: Start sync service (需要在 main 进程实现)
      // await githubAPI.startIncrementalSync();
    } catch (error) {
      console.error('初始化失败:', error);
      set({
        loading: false,
        error: error instanceof Error ? error.message : '初始化失败，请稍后重试',
      });
    }
  },

  refreshData: async () => {
    const { syncing } = get();
    if (syncing) return;

    set({ syncing: true, error: null, refreshMessage: null });

    try {
      // Force refresh all data
      const starredData = await githubAPI.getAllStarredRepositories({
        batchSize: 100,
        forceRefresh: true,
        onProgress: (loaded: number, total: number) => {
          const progress = total ? Math.round((loaded / total) * 100) : null;
          set({
            loadingProgress: progress,
            totalLoaded: loaded,
          });
        },
      });

      const repositories = (starredData as any).repositories.map((starredRepo: any) => ({
        ...starredRepo,
        starred_at: undefined,
      })) as GitHubRepository[];

      const starredRepoIds = new Set(repositories.map((repo) => repo.id));

      set({
        repositories,
        starredRepoIds,
        syncing: false,
        loadingProgress: null,
        totalLoaded: (starredData as any).totalLoaded,
        fromCache: (starredData as any).fromCache || false,
        refreshMessage: `刷新完成，共加载 ${repositories.length} 个仓库`,
      });

      await get().applyFiltersAndSearch();

      // Also refresh user info
      await get().refreshUserInfo();

      // Clear message after 3 seconds
      setTimeout(() => {
        set({ refreshMessage: null });
      }, 3000);
    } catch (error) {
      console.error('刷新失败:', error);
      set({
        syncing: false,
        error: error instanceof Error ? error.message : '刷新失败，请稍后重试',
        refreshMessage: '刷新失败，请稍后重试',
      });

      // Clear message after 3 seconds
      setTimeout(() => {
        set({ refreshMessage: null });
      }, 3000);
    }
  },

  refreshUserInfo: async () => {
    try {
      const user = await githubAPI.getCurrentUser() as GitHubUser;
      set({ user });
      console.log('用户信息已刷新');
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  },

  starRepository: async (repo: GitHubRepository) => {
    try {
      await githubAPI.starRepository(repo.owner.login, repo.name);
      const { starredRepoIds } = get();
      set({
        starredRepoIds: new Set([...starredRepoIds, repo.id]),
      });
      // Refresh user info to update star count
      await get().refreshUserInfo();
    } catch (error) {
      console.error('Star操作失败:', error);
      set({
        error: error instanceof Error ? error.message : 'Star操作失败，请稍后重试',
      });
    }
  },

  unstarRepository: async (repo: GitHubRepository) => {
    try {
      await githubAPI.unstarRepository(repo.owner.login, repo.name);
      const { starredRepoIds } = get();
      const newStarredRepoIds = new Set(starredRepoIds);
      newStarredRepoIds.delete(repo.id);
      set({ starredRepoIds: newStarredRepoIds });
      // Refresh user info to update star count
      await get().refreshUserInfo();
    } catch (error) {
      console.error('Unstar操作失败:', error);
      set({
        error: error instanceof Error ? error.message : 'Unstar操作失败，请稍后重试',
      });
    }
  },

  logout: async () => {
    try {
      await githubAPI.clearAuth();
      set({
        user: null,
        repositories: [],
        displayRepositories: [],
        starredRepoIds: new Set(),
        loading: false,
        error: null,
        syncing: false,
        loadingProgress: null,
        totalLoaded: 0,
        fromCache: false,
        cacheStatus: null,
        refreshMessage: null,
      });
    } catch (error) {
      console.error('登出失败:', error);
      set({
        error: error instanceof Error ? error.message : '登出失败，请稍后重试',
      });
    }
  },

  clearError: () => {
    set({ error: null });
  },

  clearRefreshMessage: () => {
    set({ refreshMessage: null });
  },

  checkAndUpdateCache: async () => {
    // TODO: 实现缓存状态检查 - 当前跳过缓存检查
    console.log('缓存状态检查功能待实现');
  },

  setSearchQuery: (query) => {
    set({ searchQuery: query });
    get().applyFiltersAndSearch();
  },

  setFilterOptions: (options) => {
    set((state) => ({ filterOptions: { ...state.filterOptions, ...options } }));
    get().applyFiltersAndSearch();
  },

  

  setViewOptions: (options) => {
    set((state) => ({ viewOptions: { ...state.viewOptions, ...options } }));
  },

  setCurrentPage: (page: number) => {
    set({ currentPage: page });
  },

  applyFiltersAndSearch: async () => {
    const { repositories, searchQuery, filterOptions } = get();

    const isQueryEmpty = !searchQuery.trim();
    const hasActiveSimpleFilters =
      filterOptions.language ||
      filterOptions.topic ||
      filterOptions.minStars !== undefined ||
      filterOptions.maxStars !== undefined;
    const areFiltersEmpty = !hasActiveSimpleFilters;

    if (isQueryEmpty && areFiltersEmpty) {
      // No search or filter, just sort and display all
      const sorted = [...repositories].sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        switch (filterOptions.sortBy) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "stars":
            aValue = a.stargazers_count;
            bValue = b.stargazers_count;
            break;
          case "created":
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case "updated":
          default:
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
        }

        if (filterOptions.sortOrder === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });
      set({ displayRepositories: sorted });
      return;
    }

    // Use the new LanceDB search API
    try {
      const searchResult = await searchAPI.searchRepositories({
        query: searchQuery.trim() || undefined,
        language: filterOptions.language,
        minStars: filterOptions.minStars,
        maxStars: filterOptions.maxStars,
        limit: 1500,
        sortBy: filterOptions.sortBy === 'name' ? 'relevance' : filterOptions.sortBy,
        sortOrder: filterOptions.sortOrder,
      });

      set({ displayRepositories: searchResult?.repositories || [] });
    } catch (error) {
      console.error('搜索失败:', error);
      // 搜索失败时，使用本地过滤作为后备
      const filtered = repositories.filter(repo => {
        let matches = true;

        // 搜索查询过滤
        if (searchQuery.trim()) {
          const query = searchQuery.toLowerCase();
          matches = matches && (
            repo.name.toLowerCase().includes(query) ||
            repo.description?.toLowerCase().includes(query) ||
            repo.owner.login.toLowerCase().includes(query)
          );
        }

        // 语言过滤
        if (filterOptions.language) {
          matches = matches && repo.language === filterOptions.language;
        }

        // 星标数过滤
        if (filterOptions.minStars !== undefined) {
          matches = matches && repo.stargazers_count >= filterOptions.minStars;
        }
        if (filterOptions.maxStars !== undefined) {
          matches = matches && repo.stargazers_count <= filterOptions.maxStars;
        }

        // 其他过滤条件
        if (!filterOptions.showArchived && repo.archived) {
          matches = false;
        }
        if (!filterOptions.showForks && repo.fork) {
          matches = false;
        }

        return matches;
      });

      // 排序
      const sorted = [...filtered].sort((a, b) => {
        let aValue: string | number, bValue: string | number;
        switch (filterOptions.sortBy) {
          case "name":
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case "stars":
            aValue = a.stargazers_count;
            bValue = b.stargazers_count;
            break;
          case "created":
            aValue = new Date(a.created_at).getTime();
            bValue = new Date(b.created_at).getTime();
            break;
          case "updated":
          default:
            aValue = new Date(a.updated_at).getTime();
            bValue = new Date(b.updated_at).getTime();
            break;
        }

        if (filterOptions.sortOrder === "asc") {
          return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        } else {
          return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
        }
      });

      set({ displayRepositories: sorted });
    }
  },
}));
