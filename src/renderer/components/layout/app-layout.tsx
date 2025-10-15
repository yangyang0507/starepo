import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TitleBar } from "./title-bar";
import { cn } from "@/utils/tailwind";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: string;
  className?: string;
}

export function AppLayout({ children, title, className }: AppLayoutProps) {
  return (
    <div className={cn("flex h-screen flex-col bg-background", className)}>
      {/* 自定义标题栏 */}
      <TitleBar title={title} />
      
      {/* 主要内容区域 */}
      <div className="flex flex-1 overflow-hidden min-w-0">
        <SidebarProvider>
          <AppSidebar />
          <SidebarInset className="flex flex-1 flex-col min-h-0 min-w-0">
            {/* 页面内容 */}
            <div className="flex flex-1 flex-col overflow-hidden min-h-0 min-w-0">
              <div className="flex-1 overflow-y-auto min-h-0 min-w-0">
                {children}
              </div>
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}

export default AppLayout;
