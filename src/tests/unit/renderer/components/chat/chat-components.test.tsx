/**
 * ToolCallCard 和 MessageContentRenderer 组件测试
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ToolCallCard } from '@/components/chat/tool-call-card';
import { MessageContentRenderer } from '@/components/chat/message-content';
import { MessagePart } from '@shared/types';

describe('ToolCallCard', () => {
  it('应该正确渲染 calling 状态', () => {
    render(
      <ToolCallCard
        toolName="search_repositories"
        args={{ query: 'react' }}
        status="calling"
      />
    );

    expect(screen.getByText('search_repositories')).toBeInTheDocument();
    expect(screen.getByText('执行中')).toBeInTheDocument();
  });

  it('应该正确渲染 success 状态', () => {
    render(
      <ToolCallCard
        toolName="search_repositories"
        args={{ query: 'react' }}
        status="success"
        result={{ repositories: [] }}
        startedAt={Date.now() - 1000}
        endedAt={Date.now()}
      />
    );

    expect(screen.getByText('已完成')).toBeInTheDocument();
    expect(screen.getByText(/1\.00s/)).toBeInTheDocument();
  });

  it('应该正确渲染 error 状态', () => {
    render(
      <ToolCallCard
        toolName="search_repositories"
        args={{ query: 'react' }}
        status="error"
        error="API Error"
      />
    );

    expect(screen.getByText('失败')).toBeInTheDocument();
    expect(screen.getByText('API Error')).toBeInTheDocument();
  });

  it('应该显示工具参数', () => {
    render(
      <ToolCallCard
        toolName="search_repositories"
        args={{ query: 'react', limit: 10 }}
        status="calling"
      />
    );

    expect(screen.getByText(/query/)).toBeInTheDocument();
    expect(screen.getByText(/react/)).toBeInTheDocument();
  });

  it('应该在 success 状态下显示结果', () => {
    const result = { repositories: [{ name: 'test-repo' }] };
    render(
      <ToolCallCard
        toolName="search_repositories"
        args={{ query: 'react' }}
        status="success"
        result={result}
      />
    );

    expect(screen.getByText(/test-repo/)).toBeInTheDocument();
  });
});

describe('MessageContentRenderer', () => {
  it('应该在没有 parts 时降级显示纯文本', () => {
    render(
      <MessageContentRenderer
        content="Hello World"
        isStreaming={false}
      />
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('应该正确渲染 TextPart', () => {
    const parts: MessagePart[] = [
      {
        type: 'text',
        id: 'text_1',
        content: 'Hello World',
      },
    ];

    render(
      <MessageContentRenderer
        parts={parts}
        content="Hello World"
        isStreaming={false}
      />
    );

    expect(screen.getByText('Hello World')).toBeInTheDocument();
  });

  it('应该正确渲染 ToolCallPart', () => {
    const parts: MessagePart[] = [
      {
        type: 'tool_call',
        id: 'tool_1',
        toolCallId: 'call_123',
        toolName: 'search_repositories',
        args: { query: 'react' },
        status: 'success',
        result: { repositories: [] },
      },
    ];

    render(
      <MessageContentRenderer
        parts={parts}
        content=""
        isStreaming={false}
      />
    );

    expect(screen.getByText('search_repositories')).toBeInTheDocument();
    expect(screen.getByText('已完成')).toBeInTheDocument();
  });

  it('应该正确渲染混合内容', () => {
    const parts: MessagePart[] = [
      {
        type: 'text',
        id: 'text_1',
        content: 'Searching...',
      },
      {
        type: 'tool_call',
        id: 'tool_1',
        toolCallId: 'call_123',
        toolName: 'search_repositories',
        args: { query: 'react' },
        status: 'success',
        result: { repositories: [] },
      },
      {
        type: 'text',
        id: 'text_2',
        content: 'Found results',
      },
    ];

    render(
      <MessageContentRenderer
        parts={parts}
        content="Searching...Found results"
        isStreaming={false}
      />
    );

    expect(screen.getByText('Searching...')).toBeInTheDocument();
    expect(screen.getByText('search_repositories')).toBeInTheDocument();
    expect(screen.getByText('Found results')).toBeInTheDocument();
  });

  it('应该在流式状态下显示光标', () => {
    const parts: MessagePart[] = [
      {
        type: 'text',
        id: 'text_1',
        content: 'Hello',
      },
    ];

    const { container } = render(
      <MessageContentRenderer
        parts={parts}
        content="Hello"
        isStreaming={true}
      />
    );

    // 检查是否有 animate-pulse 类（光标动画）
    const cursor = container.querySelector('.animate-pulse');
    expect(cursor).toBeInTheDocument();
  });
});
