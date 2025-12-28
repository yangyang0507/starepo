import { useState } from "react";
import { AppLayout } from "@/components/layout/app-layout";
import { AISettingsPage } from "@/components/ai";
import {
  GitHubSection,
  PreferencesSection,
  AppInfoSection,
} from "@/components/settings";
import {
  Github,
  Palette,
  Bot,
  Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

type SettingsTab = "ai" | "github" | "preferences" | "about";

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<SettingsTab>("ai");

  const menuItems: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "ai", label: "AI 助手", icon: <Bot className="h-4 w-4" /> },
    { id: "github", label: "GitHub 连接", icon: <Github className="h-4 w-4" /> },
    { id: "preferences", label: "偏好设置", icon: <Palette className="h-4 w-4" /> },
    { id: "about", label: "关于应用", icon: <Info className="h-4 w-4" /> },
  ];

  return (
    <AppLayout title="设置">
      <div className="flex h-full overflow-hidden">
        {/* Settings Sidebar */}
        <aside className="w-56 border-r bg-muted/10 flex flex-col">
          <div className="flex-1 overflow-y-auto py-3 px-3">
              <nav className="space-y-1">
                {menuItems.map((item) => (
                  <Button
                    key={item.id}
                    variant={activeTab === item.id ? "secondary" : "ghost"}
                    className={cn(
                      "w-full justify-start h-9 px-3",
                      activeTab === item.id && "bg-secondary font-medium"
                    )}
                    onClick={() => setActiveTab(item.id)}
                  >
                    {item.icon}
                    <span className="ml-2.5">{item.label}</span>
                  </Button>
                ))}
              </nav>
          </div>
        </aside>

        {/* Content Area */}
        <main className="flex-1 overflow-y-auto">
          <div className="h-full">
            {activeTab === "ai" && <AISettingsPage />}
            {activeTab === "github" && <GitHubSection />}
            {activeTab === "preferences" && <PreferencesSection />}
            {activeTab === "about" && <AppInfoSection />}
          </div>
        </main>
      </div>
    </AppLayout>
  );
}
