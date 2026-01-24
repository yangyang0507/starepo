import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useChatStore, getConversationSummary } from "@/stores/chat-store";
import { useMemo } from "react";

export function ChatHistoryList() {
  // ✅ 响应式订阅 sessions
  const sessions = useChatStore((state) => state.sessions);
  const currentConversationId = useChatStore(
    (state) => state.currentConversationId,
  );
  const createSession = useChatStore((state) => state.createSession);
  const selectSession = useChatStore((state) => state.selectSession);
  const deleteSession = useChatStore((state) => state.deleteSession);

  // 派生数据：从 sessions 获取 ID 列表
  const conversationIds = useMemo(() => Object.keys(sessions), [sessions]);

  const handleNewChat = () => {
    const newId = createSession();
    console.log("[ChatHistoryList] Created new chat:", newId);
  };

  const handleSelectConversation = (id: string) => {
    selectSession(id);
  };

  const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirm("确定要删除此对话吗？")) {
      deleteSession(id).catch((error) => {
        console.error(
          "[ChatHistoryList] Failed to delete conversation:",
          error,
        );
      });
    }
  };

  const groupByDate = (ids: string[]) => {
    const now = Date.now();
    const today = now - 24 * 60 * 60 * 1000;
    const yesterday = today - 24 * 60 * 60 * 1000;
    const last7Days = yesterday - 6 * 24 * 60 * 60 * 1000;

    const groups: Record<string, string[]> = {
      今天: [],
      昨天: [],
      最近7天: [],
      更早: [],
    };

    ids.forEach((id) => {
      const summary = getConversationSummary(id);
      const time = summary.lastMessageTime || 0;

      if (time > today) {
        groups["今天"].push(id);
      } else if (time > yesterday) {
        groups["昨天"].push(id);
      } else if (time > last7Days) {
        groups["最近7天"].push(id);
      } else {
        groups["更早"].push(id);
      }
    });

    Object.keys(groups).forEach((groupName) => {
      groups[groupName].sort((a, b) => {
        const timeA = getConversationSummary(a).lastMessageTime || 0;
        const timeB = getConversationSummary(b).lastMessageTime || 0;
        return timeB - timeA;
      });
    });

    return groups;
  };

  const grouped = groupByDate(conversationIds);
  const groupKeys = Object.keys(grouped).filter((k) => grouped[k].length > 0);

  return (
    <div className="flex h-full flex-col">
      <div className="border-border/40 flex h-14 items-center justify-between border-b px-3">
        <Button
          variant="ghost"
          className="hover:bg-accent text-muted-foreground hover:text-foreground h-9 w-full justify-start gap-2 rounded-lg font-normal"
          onClick={handleNewChat}
        >
          <Plus className="h-4 w-4" />
          <span className="text-sm">新对话</span>
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-3">
        {groupKeys.map((groupName) => (
          <div key={groupName} className="mb-6">
            <div className="text-muted-foreground/60 px-3 py-2 text-[11px] font-medium tracking-wider uppercase">
              {groupName}
            </div>
            <div className="space-y-0.5">
              {grouped[groupName].map((id) => {
                const summary = getConversationSummary(id);
                const isActive = id === currentConversationId;
                return (
                  <div
                    key={id}
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSelectConversation(id)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        handleSelectConversation(id);
                      }
                    }}
                    className={`group relative flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2.5 transition-all duration-200 ${
                      isActive
                        ? "bg-accent text-accent-foreground shadow-sm font-medium"
                        : "text-muted-foreground/80 hover:bg-accent/50 hover:text-foreground"
                    }`}
                  >
                    {isActive && (
                      <div className="absolute left-0 top-1/2 h-4 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
                    )}
                    <MessageSquare
                      className={`h-4 w-4 flex-shrink-0 transition-colors ${
                        isActive
                          ? "text-primary"
                          : "text-muted-foreground group-hover:text-foreground"
                      }`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm leading-relaxed">
                      {summary.title}
                    </span>
                    {isActive && (
                      <button
                        onClick={(e) => handleDeleteConversation(e, id)}
                        className="hover:bg-destructive/10 hover:text-destructive -mr-1 flex-shrink-0 rounded-md p-1 opacity-0 transition-all group-hover:opacity-100"
                        title="删除对话"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {conversationIds.length === 0 && (
          <div className="flex flex-col items-center justify-center py-12 text-center opacity-60">
            <div className="bg-muted/50 mb-3 flex h-12 w-12 items-center justify-center rounded-2xl">
              <MessageSquare className="text-muted-foreground h-5 w-5" />
            </div>
            <p className="text-muted-foreground text-sm">暂无对话记录</p>
            <p className="text-muted-foreground/70 mt-1 text-xs">
              点击上方按钮开始新对话
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
