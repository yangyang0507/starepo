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
  initializeData: (globalUser?: GitHubUser) => Promise<void>;
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
  initializeData: async (globalUser?: GitHubUser) => {
    set({ loading: true, error: null });

    try {
      // 优先使用全局认证状态中的用户信息，避免主进程状态不同步问题
      let user: GitHubUser;
      if (globalUser) {
        console.log('使用全局认证状态的用户信息:', globalUser.login);
        user = globalUser;
      } else {
        console.log('从主进程获取用户信息...');
        try {
          user = await githubAPI.getCurrentUser() as GitHubUser;
          console.log('成功获取到用户信息:', user?.login, '公开仓库数:', user?.public_repos);
        } catch (userError) {
          console.error('获取用户信息失败:', userError);
          throw userError;
        }
      }

      // Get all starred repositories
      console.log('开始获取 starred 仓库数据...');
      let starredData: any;
      try {
        starredData = await githubAPI.getAllStarredRepositoriesEnhanced({
          batchSize: 100,
          useDatabase: true,
        });
        console.log('成功获取到增强版 starred 数据:', starredData);
      } catch (starredError) {
        console.error('获取增强版 starred 数据失败，尝试回退到基础接口:', starredError);
        starredData = await githubAPI.getAllStarredRepositories({
          batchSize: 100,
        });
      }

      const repositories = starredData.repositories.map((starredRepo: any) => ({
        ...starredRepo,
        starred_at: undefined,
      })) as GitHubRepository[];

      console.log('处理后的仓库列表长度:', repositories.length);

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
      let starredData;
      try {
        starredData = await githubAPI.getAllStarredRepositoriesEnhanced({
          batchSize: 100,
          useDatabase: true,
          forceRefresh: true,
        });
      } catch (error) {
        console.warn('增强版刷新失败，回退到基础接口:', error);
        starredData = await githubAPI.getAllStarredRepositories({
          batchSize: 100,
          forceRefresh: true,
        });
      }

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
    const { repositories, searchQuery } = get();
    const query = searchQuery.trim();

    if (!query) {
      const sorted = [...repositories].sort(
        (a, b) =>
          new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
      );
      set({ displayRepositories: sorted });
      return;
    }

    try {
      const searchResult = await searchAPI.searchRepositories({
        query,
        limit: 1500,
        sortBy: 'relevance',
        sortOrder: 'desc',
      });

      const uniqueRepositories = Array.from(
        new Map(
          (searchResult?.repositories || []).map(repo => [repo.id, repo]),
        ).values(),
      );

      set({ displayRepositories: uniqueRepositories });
    } catch (error) {
      console.error('搜索失败:', error);

      const fallbackQuery = query.toLowerCase();
      const fallbackResults = repositories
        .filter(repo =>
          repo.name.toLowerCase().includes(fallbackQuery) ||
          repo.description?.toLowerCase().includes(fallbackQuery) ||
          repo.owner.login.toLowerCase().includes(fallbackQuery),
        )
        .sort(
          (a, b) =>
            new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
        );

      set({ displayRepositories: fallbackResults });
    }
  },
}));
