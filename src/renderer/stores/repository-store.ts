import { create } from 'zustand';
import { githubServices } from '@/services/github';
import { indexedDBStorage } from '@/services/storage/indexeddb';
import type {
  GitHubRepository,
  GitHubUser,
  FilterOptions,
  ViewOptions,
} from '@/services/github/types';
import { getSearchEngine } from '@/services/search';

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
      const isAuthenticated = githubServices.auth.isAuthenticated();
      if (!isAuthenticated) {
        set({
          loading: false,
          error: '请先进行GitHub认证',
        });
        return;
      }

      // Get user info
      const user = await githubServices.user.getCurrentUser();

      // Get all starred repositories
      const starredData = await githubServices.star.getAllStarredRepositories({
        batchSize: 100,
        onProgress: (loaded, total) => {
          const progress = total ? Math.round((loaded / total) * 100) : null;
          set({
            loadingProgress: progress,
            totalLoaded: loaded,
          });
        },
      });

      const repositories = starredData.repositories.map((starredRepo) => ({
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
        totalLoaded: starredData.totalLoaded,
        fromCache: starredData.fromCache || false,
        cacheStatus: null,
        refreshMessage: null,
      });

      await get().applyFiltersAndSearch();

      // Start sync service
      await githubServices.sync.startIncrementalSync();
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
      const starredData = await githubServices.star.getAllStarredRepositories({
        batchSize: 100,
        forceRefresh: true,
        onProgress: (loaded, total) => {
          const progress = total ? Math.round((loaded / total) * 100) : null;
          set({
            loadingProgress: progress,
            totalLoaded: loaded,
          });
        },
      });

      const repositories = starredData.repositories.map((starredRepo) => ({
        ...starredRepo,
        starred_at: undefined,
      })) as GitHubRepository[];

      const starredRepoIds = new Set(repositories.map((repo) => repo.id));

      set({
        repositories,
        starredRepoIds,
        syncing: false,
        loadingProgress: null,
        totalLoaded: starredData.totalLoaded,
        fromCache: starredData.fromCache || false,
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
      const user = await githubServices.user.getCurrentUser();
      set({ user });
      console.log('用户信息已刷新');
    } catch (error) {
      console.error('刷新用户信息失败:', error);
    }
  },

  starRepository: async (repo: GitHubRepository) => {
    try {
      await githubServices.star.starRepository(repo.owner.login, repo.name);
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
      await githubServices.star.unstarRepository(repo.owner.login, repo.name);
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
      await githubServices.auth.clearAuth();
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
    const { user } = get();
    if (!user) return;

    try {
      const cacheStatus = await indexedDBStorage.getCacheStatus(user.login);
      set({ cacheStatus });

      // If cache exists but is stale, start background update
      if (cacheStatus.hasCache && !cacheStatus.isFresh) {
        console.log('缓存已过期，启动后台更新...');
        // Async update, don't block UI
        githubServices.star
          .getAllStarredRepositories({
            forceRefresh: true,
            batchSize: 100,
            onProgress: (loaded) => {
              console.log(`后台更新进度: ${loaded} 个仓库`);
            },
          })
          .then((result) => {
            console.log(`后台更新完成，共 ${result.totalLoaded} 个仓库`);
            // Update cache status
            set({
              cacheStatus: {
                hasCache: true,
                isFresh: true,
                lastUpdated: new Date(),
                totalCount: result.totalLoaded,
              },
            });
          })
          .catch((error) => {
            console.warn('后台更新失败:', error);
          });
      }
    } catch (error) {
      console.warn('检查缓存状态失败:', error);
    }
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

    // If there is a search/filter, use the engine
    const searchEngine = getSearchEngine();

    if (!searchEngine.isReady()) {
      await searchEngine.initialize(repositories);
    }

    const results = await searchEngine.search({
      text: searchQuery,
      type: "keyword",
      options: {
        limit: 1500, // Get more results to avoid default limit issue
        filters: {
          ...filterOptions,
        },
        sortBy: filterOptions.sortBy,
        sortOrder: filterOptions.sortOrder,
      },
    });

    set({ displayRepositories: results.map((r) => r.repository) });
  },
}));
