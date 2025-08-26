import * as React from "react";
import {
  AudioWaveform,
  BookOpen,
  Bot,
  Command,
  Frame,
  GalleryVerticalEnd,
  Map,
  PieChart,
  Settings2,
  SquareTerminal,
  Star,
  Github,
} from "lucide-react";

import { NavMain } from "@/components/nav-main";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarRail,
} from "@/components/ui/sidebar";

// This is sample data.
const data = {
  user: {
    name: "StarRepo User",
    email: "user@example.com",
    avatar: "/avatars/shadcn.jpg",
  },
  teams: [
    {
      name: "StarRepo",
      logo: GalleryVerticalEnd,
      plan: "个人版",
    },
    {
      name: "StarRepo Pro",
      logo: AudioWaveform,
      plan: "专业版",
    },
    {
      name: "StarRepo Team",
      logo: Command,
      plan: "团队版",
    },
  ],
  navMain: [
    {
      title: "首页",
      url: "/",
      icon: SquareTerminal,
      isActive: true,
    },
    {
      title: "GitHub 仓库",
      url: "/github-repositories",
      icon: Github,
    },
    {
      title: "我的收藏",
      url: "#",
      icon: Star,
      items: [
        {
          title: "已收藏",
          url: "#",
        },
        {
          title: "最近查看",
          url: "#",
        },
        {
          title: "推荐仓库",
          url: "#",
        },
      ],
    },
    {
      title: "统计分析",
      url: "#",
      icon: PieChart,
      items: [
        {
          title: "数据概览",
          url: "#",
        },
        {
          title: "趋势分析",
          url: "#",
        },
        {
          title: "导出报告",
          url: "#",
        },
      ],
    },
    {
      title: "设置",
      url: "/second-page",
      icon: Settings2,
      items: [
        {
          title: "账户设置",
          url: "#",
        },
        {
          title: "同步设置",
          url: "#",
        },
        {
          title: "主题设置",
          url: "#",
        },
      ],
    },
  ]
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher teams={data.teams} />
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={data.navMain} />
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={data.user} />
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
