import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, test } from 'vitest';
import ThiConsolePanel from '@/components/thi/ThiConsolePanel';
import { SettingsProvider } from '@/contexts/AppSettings';

const renderPanel = (props?: Parameters<typeof ThiConsolePanel>[0]) =>
  render(
    <MemoryRouter>
      <SettingsProvider>
        <ThiConsolePanel {...props} />
      </SettingsProvider>
    </MemoryRouter>,
  );

test('default adult yak at 18℃ / 55% / 3200m lands in the comfort band', () => {
  renderPanel();
  expect(screen.getByText('应激等级：舒适')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: '热应激分级色带' })).toBeInTheDocument();
  expect(screen.getByText('三条优先管理动作')).toBeInTheDocument();
});

test('raising the temperature to 30℃ moves the level into danger/extreme', () => {
  renderPanel();
  fireEvent.change(screen.getByRole('slider', { name: '日间温度' }), { target: { value: '30' } });
  expect(screen.getByText(/^应激等级：/).textContent).toMatch(/危险|极端/);
  // 危险档的前三条优先动作必须覆盖通风 / 放牧 / 补饲三类可执行动作
  const suggestions = screen.getAllByRole('listitem').map((li) => li.textContent ?? '');
  expect(suggestions.some((s) => /通风|喷淋/.test(s))).toBe(true);
  expect(suggestions.some((s) => /放牧/.test(s))).toBe(true);
  expect(suggestions.some((s) => /补饲/.test(s))).toBe(true);
});

test('the Yushu summer preset fills a calf scenario and computes a level', () => {
  renderPanel({ variant: 'compact', tone: 'dark' });
  fireEvent.click(screen.getByRole('button', { name: /玉树夏季/ }));
  // 预设：牦牛 / 32℃ / 45% / 4200m / 幼畜 → 必然进入危险或极端档
  // compact 变体不渲染仪表盘 caption，等级以徽章形式出现
  expect(screen.getByText(/^(危险|极端)$/)).toBeInTheDocument();
  expect(screen.getByLabelText('日间温度（数值输入）')).toHaveValue(32);
  expect(screen.getByLabelText('海拔（数值输入）')).toHaveValue(4200);
});

test('compact variant exposes the link to the full console', () => {
  renderPanel({ variant: 'compact', tone: 'dark' });
  expect(screen.getByRole('button', { name: /打开完整决策台/ })).toBeInTheDocument();
});
