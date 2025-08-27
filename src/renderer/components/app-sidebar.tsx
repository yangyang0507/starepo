import * as React from "react";
import {
  PieChart,
  Settings2,
  SquareTerminal,
  Star,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { Logo } from "@/components/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// This is sample data.
const data = {
  navMain: [
    {
      title: "首页",
      url: "/",
      icon: SquareTerminal,
      isActive: true,
    },
    {
      title: "我的 Star",
      url: "/github-repositories",
      icon: Star,
    },
    {
      title: "统计分析",
      url: "/second-page",
      icon: PieChart,
    },
    {
      title: "设置",
      url: "/settings",
      icon: Settings2,
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <Logo />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarRail />
    </Sidebar>
  );
}
