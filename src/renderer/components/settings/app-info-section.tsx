/**
 * 应用信息区块
 */

export function AppInfoSection() {
  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-xl font-semibold">应用信息</h2>
          <p className="text-sm text-muted-foreground mt-1">
            查看应用版本和系统信息
          </p>
        </div>
      </div>

      <div className="space-y-5">
        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="font-medium">版本：</span>
            <span className="text-muted-foreground ml-2">1.0.0</span>
          </div>
          <div>
            <span className="font-medium">平台：</span>
            <span className="text-muted-foreground ml-2">Electron</span>
          </div>
          <div>
            <span className="font-medium">Node.js：</span>
            <span className="text-muted-foreground ml-2">20.x</span>
          </div>
          <div>
            <span className="font-medium">Electron：</span>
            <span className="text-muted-foreground ml-2">37.x</span>
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Starepo - GitHub Star 智能管理工具
        </p>
      </div>
    </div>
  );
}
