import { Button } from "@/components/ui/button";
import { MessageSquare, Plus } from "lucide-react";

export function ChatHistoryList() {
    // 模拟历史记录数据
    const history = [
        { id: '1', title: '如何使用 Tailwind CSS?', date: '今天' },
        { id: '2', title: 'React Performance Optimization', date: '昨天' },
        { id: '3', title: 'Electron IPC Communication', date: '前天' },
    ];

    return (
        <div className="flex flex-col h-full bg-muted/20 border-r">
            <div className="flex items-center h-12 px-3 border-b">
                <Button variant="outline" className="w-full justify-start gap-2" size="sm">
                    <Plus className="w-4 h-4" />
                    <span>新对话</span>
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-2">
                <div className="space-y-1">
                    {history.map((item) => (
                        <button
                            key={item.id}
                            className="w-full flex items-center gap-2 p-2 text-sm text-left rounded-md hover:bg-accent hover:text-accent-foreground transition-colors group"
                        >
                            <MessageSquare className="w-4 h-4 text-muted-foreground group-hover:text-accent-foreground" />
                            <span className="truncate flex-1">{item.title}</span>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
}
