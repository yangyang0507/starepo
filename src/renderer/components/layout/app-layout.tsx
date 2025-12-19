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
    <div className={cn("flex h-screen flex-col bg-muted/30", className)}>
      {/* 自定义标题栏 */}
      <TitleBar title={title} />

      {/* 主要内容区域 */}
      <div className="flex flex-1 overflow-hidden">
        <SidebarProvider
          defaultOpen={false}
          style={
            {
              "--sidebar-width": "3rem",
              "--sidebar-width-icon": "3rem",
            } as React.CSSProperties
          }
        >
          <AppSidebar variant="inset" collapsible="icon" />
          <SidebarInset>
            {/* 页面内容 */}
            <div className="flex flex-1 flex-col overflow-hidden">
              {children}
            </div>
          </SidebarInset>
        </SidebarProvider>
      </div>
    </div>
  );
}

export default AppLayout;
