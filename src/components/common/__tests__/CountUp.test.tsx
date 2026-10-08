import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import CountUp from '@/components/common/CountUp';

/**
 * 展示契约：数字组件必须始终渲染真实终值，不允许出现“停留在 0”的
 * 中间态（历史归零计数动画在截图/后台标签页场景下的故障模式）。
 */
test('renders the final value immediately without a zero start', () => {
  render(<CountUp end={1186} />);
  expect(screen.getByText('1186')).toBeInTheDocument();
  expect(screen.queryByText('0')).not.toBeInTheDocument();
});

test('renders zero correctly when the real value is zero', () => {
  render(<CountUp end={0} />);
  expect(screen.getByText('0')).toBeInTheDocument();
});
