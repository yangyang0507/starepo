import { Button } from "@/components/ui/button";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { useChatStore, getConversationIds, getConversationSummary } from "@/stores/chat-store";

export function ChatHistoryList() {
    const { currentConversationId, setConversationId, deleteConversation } = useChatStore();
    const conversationIds = getConversationIds();

    // 新建对话
    const handleNewChat = () => {
        const newId = Date.now().toString();
        setConversationId(newId);
    };

    // 选择对话
    const handleSelectConversation = (id: string) => {
        setConversationId(id);
    };

    // 删除对话
    const handleDeleteConversation = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm("确定要删除此对话吗？")) {
            deleteConversation(id);
        }
    };

    // 按时间分组
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
        <div className="flex flex-col h-full bg-muted/20 border-r">
            <div className="flex items-center h-12 px-3 border-b">
                <Button
                    variant="outline"
                    className="w-full justify-start gap-2"
                    size="sm"
                    onClick={handleNewChat}
                >
                    <Plus className="w-4 h-4" />
                    <span>新对话</span>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                {groupKeys.map(groupName => (
                    <div key={groupName} className="mb-4">
                        <div className="px-2 py-1 text-xs text-muted-foreground font-medium">
                            {groupName}
                        </div>
                        <div className="space-y-1">
                            {grouped[groupName].map(id => {
                                const summary = getConversationSummary(id);
                                const isActive = id === currentConversationId;
                                return (
                                    <button
                                        key={id}
                                        onClick={() => handleSelectConversation(id)}
                                        className={`w-full flex items-center gap-2 p-2 text-sm text-left rounded-md transition-colors group ${
                                            isActive
                                                ? "bg-accent text-accent-foreground"
                                                : "hover:bg-accent hover:text-accent-foreground"
                                        }`}
                                    >
                                        <MessageSquare className={`w-4 h-4 flex-shrink-0 ${
                                            isActive ? "text-accent-foreground" : "text-muted-foreground group-hover:text-accent-foreground"
                                        }`} />
                                        <span className="truncate flex-1 min-w-0">{summary.title}</span>
                                        {isActive && (
                                            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <button
                                                    onClick={(e) => handleDeleteConversation(e, id)}
                                                    className="p-1 hover:bg-destructive/20 hover:text-destructive rounded"
                                                    title="删除"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>
                                            </div>
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
                {conversationIds.length === 0 && (
                    <div className="text-center text-muted-foreground text-sm py-8">
                        暂无对话记录
                    </div>
                )}
            </div>
        </div>
    );
}
