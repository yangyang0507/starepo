import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useChatStore, getConversationSummary } from "@/stores/chat-store";
import { useMemo } from "react";

export function ChatHistoryList() {
    // ✅ 响应式订阅 sessions
    const sessions = useChatStore(state => state.sessions);
    const currentConversationId = useChatStore(state => state.currentConversationId);
    const createSession = useChatStore(state => state.createSession);
    const selectSession = useChatStore(state => state.selectSession);
    const deleteSession = useChatStore(state => state.deleteSession);

    // 派生数据：从 sessions 获取 ID 列表
    const conversationIds = useMemo(() => Object.keys(sessions), [sessions]);

    const handleNewChat = () => {
        const newId = createSession();
        console.log('[ChatHistoryList] Created new chat:', newId);
    };

    const handleSelectConversation = (id: string) => {
        selectSession(id);
    };

    const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("确定要删除此对话吗？")) {
            deleteSession(id).catch(error => {
                console.error('[ChatHistoryList] Failed to delete conversation:', error);
            });
        }
    };

    const groupByDate = (ids: string[]) => {
        const now = Date.now();
        const today = now - 24 * 60 * 60 * 1000;
        const yesterday = today - 24 * 60 * 60 * 1000;
        const last7Days = yesterday - 6 * 24 * 60 * 60 * 1000;

        const groups: Record<string, string[]> = {
            "今天": [],
            "昨天": [],
            "最近7天": [],
            "更早": [],
        };

        ids.forEach(id => {
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

        return groups;
    };

    const grouped = groupByDate(conversationIds);
    const groupKeys = Object.keys(grouped).filter(k => grouped[k].length > 0);

    return (
        <div className="flex flex-col h-full bg-muted/20">
            <div className="flex items-center justify-between h-14 px-3 border-b border-border/50">
                <Button
                    variant="ghost"
                    className="w-full justify-start gap-2 h-9 hover:bg-accent text-muted-foreground hover:text-foreground"
                    onClick={handleNewChat}
                >
                    <Plus className="w-4 h-4" />
                    <span className="text-sm font-medium">新对话</span>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto px-2 py-3">
                {groupKeys.map(groupName => (
                    <div key={groupName} className="mb-5">
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-semibold tracking-wide uppercase">
                            {groupName}
                        </div>
                        <div className="space-y-0.5">
                            {grouped[groupName].map(id => {
                                const summary = getConversationSummary(id);
                                const isActive = id === currentConversationId;
                                return (
                                    <div
                                        key={id}
                                        role="button"
                                        tabIndex={0}
                                        onClick={() => handleSelectConversation(id)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSelectConversation(id);
                                            }
                                        }}
                                        className={`group relative flex items-center gap-2.5 px-2.5 py-2 rounded-lg cursor-pointer transition-all ${
                                            isActive
                                                ? "bg-accent text-accent-foreground shadow-sm"
                                                : "text-muted-foreground hover:bg-accent/50 hover:text-foreground"
                                        }`}
                                    >
                                        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                                            isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-foreground"
                                        }`} />
                                        <span className="truncate flex-1 min-w-0 text-sm leading-relaxed">{summary.title}</span>
                                        {isActive && (
                                            <button
                                                onClick={(e) => handleDeleteConversation(e, id)}
                                                className="flex-shrink-0 p-1.5 -mr-1.5 rounded-md hover:bg-destructive/20 hover:text-destructive opacity-0 group-hover:opacity-100 transition-all"
                                                title="删除对话"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {conversationIds.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
                            <MessageSquare className="w-5 h-5 text-muted-foreground" />
                        </div>
                        <p className="text-sm text-muted-foreground">暂无对话记录</p>
                        <p className="text-xs text-muted-foreground/70 mt-1">点击上方按钮开始新对话</p>
                    </div>
                )}
            </div>
        </div>
    );
}
