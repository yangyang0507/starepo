import { ChatInterface } from "@/components/chat";
import { AppLayout } from "@/components/layout/app-layout";
import { initializeChatStore } from "@/stores/chat-store";
import React from 'react';
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();

  // 初始化聊天 store
  React.useEffect(() => {
    initializeChatStore();
  }, []);

  return (
    <AppLayout title={t("appName")}>
      <div className="flex flex-1 flex-col gap-0 p-0 pt-0 overflow-hidden">
        {/* AI 聊天界面 - 填充整个剩余空间 */}
        <ChatInterface conversationId="default" />
      </div>
    </AppLayout>
  );
}
