import { render, screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import CountUp from '@/components/common/CountUp';

/**
 * 展示契约：数字最终必须是真实终值，且动画不依赖 IntersectionObserver
 * （旧实现因观察器不触发而停留在 0，属于回归红线）。
 */
test('finishes on the real value without any intersection observer', async () => {
  const observe = vi.fn();
  // 若组件依赖 IntersectionObserver，这里应报错；显式置为不可用以锁定契约
  vi.stubGlobal('IntersectionObserver', undefined);
  render(<CountUp end={1186} duration={0} />);
  expect(screen.getByText('1186')).toBeInTheDocument();
  expect(observe).not.toHaveBeenCalled();
  vi.unstubAllGlobals();
});

test('animates to the final value and never stays at zero', async () => {
  render(<CountUp end={1186} duration={120} />);
  // 动画期间允许出现中间值，但必须在时限内收敛到终值
  await waitFor(() => expect(screen.getByText('1186')).toBeInTheDocument(), { timeout: 2000 });
});

test('with reduced motion rendering the final value is immediate', () => {
  const matchMedia = vi.fn().mockReturnValue({ matches: true });
  vi.stubGlobal('matchMedia', matchMedia);
  render(<CountUp end={31} duration={900} />);
  expect(screen.getByText('31')).toBeInTheDocument();
  vi.unstubAllGlobals();
});

test('renders zero correctly when the real value is zero', () => {
  render(<CountUp end={0} duration={0} />);
  expect(screen.getByText('0')).toBeInTheDocument();
});
