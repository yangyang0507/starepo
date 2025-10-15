import { createRoute } from "@tanstack/react-router";
import { RootRoute } from "./root";
import HomePage from "@/pages/home-page";
import StatsPage from "@/pages/stats-page";
import GitHubRepositoriesPage from "@/pages/github-repositories-page";
import SettingsPage from "@/pages/settings-page";
import { PerformanceDashboard } from "@/components/performance-dashboard";

/**
 * 路由添加指南：
 * 
 * 添加新路由的步骤：
 * 1. 在 '../pages/' 目录创建新的页面组件（例如：NewPage.tsx）
 * 2. 在文件顶部导入新的页面组件
 * 3. 使用 createRoute() 定义新路由
 * 4. 在 RootRoute.addChildren([...]) 中添加新路由
 * 5. 如果需要，在 RootRoute 的导航部分添加新链接
 * 
 * 示例：
 * 1. 创建 '../pages/NewPage.tsx'
 * 2. 导入：import NewPage from '../pages/NewPage';
 * 3. 定义路由：
 *    const NewRoute = createRoute({
 *      getParentRoute: () => RootRoute,
 *      path: '/new',
 *      component: NewPage,
 *    });
 * 4. 添加到路由树：RootRoute.addChildren([HomeRoute, NewRoute, ...])
 * 5. 添加链接：<Link to="/new">New Page</Link>
 */

export const HomeRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/",
  component: HomePage,
});

export const StatsPageRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/stats-page",
  component: StatsPage,
});

export const GitHubRepositoriesRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/github-repositories",
  component: GitHubRepositoriesPage,
});

export const SettingsRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/settings",
  component: SettingsPage,
});

export const PerformanceRoute = createRoute({
  getParentRoute: () => RootRoute,
  path: "/performance",
  component: PerformanceDashboard,
});

export const rootTree = RootRoute.addChildren([
  HomeRoute,
  StatsPageRoute,
  GitHubRepositoriesRoute,
  SettingsRoute,
  PerformanceRoute,
]);
