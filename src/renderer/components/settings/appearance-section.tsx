/**
 * 外观设置区块
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Globe, Monitor, Moon, Palette, Sun } from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from 'react-i18next';
import { setAppLanguage } from '@/utils/language-helpers';
import type { ThemeMode } from '@shared/types';

export function AppearanceSection() {
  const { theme, changeTheme, isLoading: themeLoading } = useTheme();
  const { i18n } = useTranslation();

  const getThemeIcon = (themeMode: ThemeMode) => {
    switch (themeMode) {
      case 'light':
        return <Sun className="h-4 w-4" />;
      case 'dark':
        return <Moon className="h-4 w-4" />;
      case 'system':
        return <Monitor className="h-4 w-4" />;
      default:
        return <Monitor className="h-4 w-4" />;
    }
  };

  const getThemeLabel = (themeMode: ThemeMode) => {
    switch (themeMode) {
      case 'light':
        return '浅色';
      case 'dark':
        return '深色';
      case 'system':
        return '跟随系统';
      default:
        return '跟随系统';
    }
  };

  const getLanguageLabel = (lang: string) => {
    switch (lang) {
      case 'zh-CN':
        return '🇨🇳 中文简体';
      case 'en':
        return '🇺🇸 English';
      default:
        return '🇺🇸 English';
    }
  };

  const handleLanguageChange = async (lang: string) => {
    await setAppLanguage(lang);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          外观设置
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* 主题设置 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">主题模式</p>
            <p className="text-xs text-muted-foreground">
              选择应用的外观主题
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                className="w-[140px] justify-start"
                disabled={themeLoading}
              >
                {getThemeIcon(theme)}
                <span className="ml-2">{getThemeLabel(theme)}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={theme}
                onValueChange={(value) => changeTheme(value as ThemeMode)}
              >
                <DropdownMenuRadioItem value="light">
                  <Sun className="mr-2 h-4 w-4" />
                  浅色
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="dark">
                  <Moon className="mr-2 h-4 w-4" />
                  深色
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="system">
                  <Monitor className="mr-2 h-4 w-4" />
                  跟随系统
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* 语言设置 */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium">语言</p>
            <p className="text-xs text-muted-foreground">
              选择应用的显示语言
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="w-[140px] justify-start">
                <Globe className="mr-2 h-4 w-4" />
                {getLanguageLabel(i18n.language)}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuRadioGroup
                value={i18n.language}
                onValueChange={handleLanguageChange}
              >
                <DropdownMenuRadioItem value="zh-CN">
                  🇨🇳 中文简体
                </DropdownMenuRadioItem>
                <DropdownMenuRadioItem value="en">
                  🇺🇸 English
                </DropdownMenuRadioItem>
              </DropdownMenuRadioGroup>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardContent>
    </Card>
  );
}