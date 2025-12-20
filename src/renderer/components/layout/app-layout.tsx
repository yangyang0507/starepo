import React from "react";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { TitleBar } from "./title-bar";
import { cn } from "@/utils/tailwind";

interface AppLayoutProps {
  children: React.ReactNode;
  title?: React.ReactNode;
  className?: string;
}

export function AppLayout({ children, title, className }: AppLayoutProps) {
  return (
    <div className={cn("flex h-screen flex-col bg-muted/30", className)}>
      {/* 自定义标题栏 */}
      <TitleBar title={title} />

      {/* 主要内容区域 */}
      <div className="flex flex-1 min-h-0 overflow-hidden">
        <SidebarProvider
          defaultOpen={false}
          style={
            {
              "--sidebar-width": "2.25rem",
              "--sidebar-width-icon": "2.25rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" collapsible="icon" />
          <SidebarInset className="!m-0 min-h-0 overflow-hidden">
            {/* 页面内容 - 移除 variant=inset 带来的 margin */}
            {children}
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}

export default AppLayout;
