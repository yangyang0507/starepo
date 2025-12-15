/**
 * 应用信息区块
 */

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Info } from 'lucide-react';

export function AppInfoSection() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Info className="h-5 w-5" />
          应用信息
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">版本：</span>
            <span className="text-muted-foreground">1.0.0</span>
          </div>
          <div>
            <span className="font-medium">平台：</span>
            <span className="text-muted-foreground">Electron</span>
          </div>
          <div>
            <span className="font-medium">Node.js：</span>
            <span className="text-muted-foreground">20.x</span>
          </div>
          <div>
            <span className="font-medium">Electron：</span>
            <span className="text-muted-foreground">37.x</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Starepo - GitHub Star 智能管理工具
        </p>
      </CardContent>
    </Card>
  );
}
