import { AppLayout } from "@/components/layout/app-layout";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();

  return (
    <AppLayout title={t("appName")}>
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">首页</h1>
        </div>
      </header>
      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
          {/* 欢迎区域 */}
          <div className="bg-card rounded-xl border p-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="mb-2 text-2xl font-bold">
                  🌟 欢迎使用 {t("appName")}
                </h1>
                <p className="text-muted-foreground">
                  管理和探索您的 GitHub 仓库，发现优质开源项目
                </p>
              </div>
              <div className="text-6xl">
                🌟
              </div>
            </div>
          </div>

          {/* 快速操作区域 */}
          <div className="grid auto-rows-min gap-4 md:grid-cols-3">
            <div className="bg-card rounded-xl border p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  🔍
                </div>
                <div>
                  <h3 className="font-semibold">探索仓库</h3>
                  <p className="text-muted-foreground text-sm">发现热门项目</p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  ⭐
                </div>
                <div>
                  <h3 className="font-semibold">我的收藏</h3>
                  <p className="text-muted-foreground text-sm">
                    管理已收藏项目
                  </p>
                </div>
              </div>
            </div>

            <div className="bg-card rounded-xl border p-6 transition-shadow hover:shadow-md">
              <div className="mb-3 flex items-center gap-3">
                <div className="bg-primary/10 flex h-10 w-10 items-center justify-center rounded-lg">
                  📊
                </div>
                <div>
                  <h3 className="font-semibold">数据统计</h3>
                  <p className="text-muted-foreground text-sm">查看使用分析</p>
                </div>
              </div>
            </div>
          </div>

          {/* 主要内容区域 */}
          <div className="bg-card flex min-h-[60vh] flex-col items-center justify-center rounded-xl border p-8">
            <div className="space-y-4 text-center">
              <div className="mb-4 text-6xl">🚀</div>
              <h2 className="text-xl font-semibold">开始您的 GitHub 之旅</h2>
              <p className="text-muted-foreground max-w-md">
                通过左侧导航栏快速访问您的 GitHub 仓库、收藏夹和各种功能
              </p>
            </div>
          </div>
      </div>
    </AppLayout>
  );
}
