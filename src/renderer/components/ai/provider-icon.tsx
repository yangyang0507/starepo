/**
 * Provider Icon 组件
 * 支持自定义上传的图标或显示文字 fallback
 */

// 使用 import.meta.glob 预加载所有 provider 图标
// Vite 会在构建时静态分析并打包这些文件
const providerIcons = import.meta.glob<string>(
  "@assets/images/providers/*.svg",
  {
    eager: true,
    query: "?url",
    import: "default",
  }
);

// 将路径映射为文件名索引，方便查找
// 例如: { "openai.svg": "blob:http://...", "anthropic.svg": "blob:http://..." }
const iconMap = Object.entries(providerIcons).reduce(
  (acc, [path, url]) => {
    const fileName = path.split("/").pop() || "";
    acc[fileName] = url;
    return acc;
  },
  {} as Record<string, string>
);

// 调试：输出已加载的图标
console.log("[ProviderIcon] Loaded provider icons:", Object.keys(iconMap));

export interface ProviderIconProps {
  /** Provider 的唯一标识或名称 */
  provider: string;
  /** 自定义图标路径（相对于 assets/images/，例如 "providers/openai.svg"） */
  iconPath?: string;
  size?: number;
  /**
   * 是否反色显示（用于深色背景）
   */
  invert?: boolean;
  className?: string;
}

/**
 * 获取文字 fallback（取名称的前两个字符大写）
 */
function getTextFallback(provider: string): string {
  if (!provider) return "??";

  // 移除特殊字符，只保留字母和数字
  const cleaned = provider.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, "");

  // 取前两个字符
  const text = cleaned.slice(0, 2).toUpperCase();
  return text || "??";
}

/**
 * ProviderIcon 组件
 *
 * 如果提供了 iconPath，显示自定义图标
 * 否则显示文字 fallback
 *
 * @example
 * ```tsx
 * <ProviderIcon provider="openai" iconPath="openai.svg" size={24} />
 * <ProviderIcon provider="My Custom AI" size={24} />
 * ```
 */
export function ProviderIcon({
  provider,
  iconPath,
  size = 24,
  invert = false,
  className = "",
}: ProviderIconProps) {
  // 如果有自定义图标路径，显示图标
  if (iconPath) {
    // 判断是 base64 data URL 还是本地文件路径
    const isDataUrl = iconPath.startsWith("data:");

    let iconUrl: string | undefined;

    if (isDataUrl) {
      // Base64 data URL，直接使用
      iconUrl = iconPath;
    } else {
      // 本地文件路径，从预加载的 iconMap 中查找
      // 提取文件名，例如 "providers/openai.svg" -> "openai.svg"
      const fileName = iconPath.split("/").pop() || "";
      iconUrl = iconMap[fileName];

      // 如果在 iconMap 中找不到，说明是自定义上传的图标，使用原路径
      if (!iconUrl) {
        console.warn(
          `[ProviderIcon] Icon not found in iconMap: ${fileName}, this might be a custom uploaded icon`
        );
        // 对于自定义上传的图标（base64），iconPath 本身就是 data URL
        // 如果不是 data URL，则无法加载
        if (iconPath.startsWith("data:")) {
          iconUrl = iconPath;
        }
      }
    }

    // 如果有可用的图标 URL，显示图标
    if (iconUrl) {
      return (
        <img
          src={iconUrl}
          alt={`${provider} icon`}
          width={size}
          height={size}
          className={className}
          style={{
            display: "block",
            objectFit: "contain",
            filter: invert ? "invert(1) brightness(1.2)" : "none",
          }}
          onError={(e) => {
            // 图标加载失败，隐藏图片
            const target = e.target as HTMLImageElement;
            target.style.display = "none";
            console.warn(`[ProviderIcon] Failed to load icon: ${iconPath}`);
          }}
        />
      );
    }
  }

  // 没有图标或图标加载失败，显示文字 fallback
  const text = getTextFallback(provider);

  return (
    <div
      className={`flex items-center justify-center rounded font-bold ${className}`}
      style={{
        width: size,
        height: size,
        fontSize: size * 0.4,
        backgroundColor: invert ? "transparent" : "currentColor",
        color: invert ? "currentColor" : "var(--background)",
        opacity: invert ? 1 : 0.8,
      }}
      title={provider}
    >
      {text}
    </div>
  );
}
