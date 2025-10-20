import React from 'react';
import { AppLayout } from "@/components/layout/app-layout";
import { Separator } from "@/components/ui/separator";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useTranslation } from "react-i18next";
import { ChatInterface } from "@/components/chat";
import { initializeChatStore } from "@/stores/chat-store";
import { Button } from "@/components/ui/button";
import { Settings } from "lucide-react";
import { useRouter } from "@tanstack/react-router";

export default function HomePage() {
  const { t } = useTranslation();
  const router = useRouter();

  // 初始化聊天 store
  React.useEffect(() => {
    initializeChatStore();
  }, []);

  const handleOpenAISettings = React.useCallback(() => {
    router.navigate({ to: "/settings", hash: "ai-settings" });
  }, [router]);

  return (
    <AppLayout title={t("appName")}>
      <header className="flex h-16 shrink-0 items-center justify-between pr-4 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12">
        <div className="flex items-center gap-2 px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator
            orientation="vertical"
            className="mr-2 data-[orientation=vertical]:h-4"
          />
          <h1 className="text-base font-medium">AI 助手</h1>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
          onClick={handleOpenAISettings}
        >
          <Settings className="h-4 w-4" />
          设置
        </Button>
      </header>
      <div className="flex flex-1 flex-col gap-0 p-0 pt-0 overflow-hidden">
        {/* AI 聊天界面 - 填充整个剩余空间 */}
        <ChatInterface conversationId="default" />
      </div>
    </AppLayout>
  );
}
