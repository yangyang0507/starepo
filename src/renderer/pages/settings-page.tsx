import { AppLayout } from "@/components/layout/app-layout";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { AISettingsSection } from "@/components/ai";
import {
  GitHubAccountSection,
  AppearanceSection,
  SyncSection,
  AdvancedSection,
  AppInfoSection,
} from "@/components/settings";

export default function SettingsPage() {
  return (
    <AppLayout title="设置">
      <header className="flex h-16 shrink-0 items-center gap-2 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">设置</h1>
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-4 p-4 pt-0">
        {/* GitHub 账户设置 */}
        <GitHubAccountSection />

        {/* 外观设置 */}
        <AppearanceSection />

        {/* AI 设置 */}
        <AISettingsSection />

        {/* 同步设置 */}
        <SyncSection />

        {/* 高级设置 */}
        <AdvancedSection />

        {/* 应用信息 */}
        <AppInfoSection />

        {/* 底部空间 */}
        <div className="h-10" />
      </div>
    </AppLayout>
  );
}
