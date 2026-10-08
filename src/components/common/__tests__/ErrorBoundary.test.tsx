import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ErrorBoundary } from '@/components/common/ErrorBoundary';

/**
 * 全局错误边界契约：子组件抛错时显示可读错误态而不是白屏，
 * 并提供“重试”入口让用户返回可用状态。
 */
function Boom(): React.JSX.Element {
  throw new Error('render explosion');
}

describe('ErrorBoundary', () => {
  it('renders a readable fallback with a recovery action when children throw', () => {
    // React 会在测试中把未捕获渲染错误重新抛到控制台；显式忽略
    const silence = vi.spyOn(console, 'error').mockImplementation(() => {});
    render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    silence.mockRestore();

    expect(screen.getByRole('heading', { name: /页面暂时无法显示|Something went wrong/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /刷新页面|Reload/ })).toBeInTheDocument();
  });

  it('renders children normally when no error occurs', () => {
    render(
      <ErrorBoundary>
        <p>正常内容</p>
      </ErrorBoundary>,
    );
    expect(screen.getByText('正常内容')).toBeInTheDocument();
  });
});
