import React from "react";
import { useTheme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";

export default function ToggleTheme() {
  const { theme, toggleTheme, isLoading } = useTheme();

  const getThemeLabel = (theme: string) => {
    switch (theme) {
      case "light":
        return "🌞 浅色";
      case "dark":
        return "🌙 深色";
      case "system":
        return "💻 系统";
      default:
        return "🌞 浅色";
    }
  };

  return (
    <Button
      onClick={toggleTheme}
      disabled={isLoading}
      variant="outline"
      size="sm"
    >
      {getThemeLabel(theme)}
    </Button>
  );
}
