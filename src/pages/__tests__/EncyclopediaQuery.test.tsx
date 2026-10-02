import { fireEvent, screen, waitFor } from '@testing-library/react';
import type { ReactNode } from 'react';
import { expect, test, vi } from 'vitest';

vi.mock('react-virtuoso', () => ({
  VirtuosoGrid: ({
    data,
    itemContent,
  }: { data: unknown[]; itemContent: (index: number, item: unknown) => ReactNode }) => (
    <div>{data.map((item, index) => <div key={index}>{itemContent(index, item)}</div>)}</div>
  ),
}));

import { categories, endangeredLevels, provinces } from '@/data/breeds';
import { renderAppAt } from '@/test/render';

test('encyclopedia search is reflected in a canonical share URL', async () => {
  renderAppAt('/encyclopedia');
  const input = await screen.findByRole('searchbox', { name: '搜索百科品种' });

  fireEvent.change(input, { target: { value: ' 河田鸡 ' } });

  await waitFor(() => {
    expect(window.location.hash).toContain('/encyclopedia?search=%E6%B2%B3%E7%94%B0%E9%B8%A1');
  });
});

test('encyclopedia detail links navigate to the map without being overwritten by filters', async () => {
  renderAppAt(`/encyclopedia?search=${encodeURIComponent('河田鸡')}`);
  const detailButton = await screen.findByRole('button', { name: '查看河田鸡' });

  fireEvent.click(detailButton);

  await waitFor(() => {
    expect(window.location.hash).toContain('/map?breed_id=hetian-chicken');
  });
  expect(window.location.hash).not.toContain('/encyclopedia');
});

test('encyclopedia restores every supported filter from a share URL', async () => {
  const search = ' \u6cb3\u7530\u9e21 ';
  const province = provinces[19];
  const category = categories[0];
  const endangered = endangeredLevels[1];
  renderAppAt(
    `/encyclopedia?search=${encodeURIComponent(search)}&province=${encodeURIComponent(province)}&category=${encodeURIComponent(category)}&endangered=${encodeURIComponent(endangered)}`,
  );

  const input = await screen.findByRole('searchbox', { name: '\u641c\u7d22\u767e\u79d1\u54c1\u79cd' });
  expect(input).toHaveValue(search.trim());

  const selects = await screen.findAllByRole('combobox');
  expect(selects[0]).toHaveTextContent(province);
  expect(selects[1]).toHaveTextContent(endangered);
  const activeCategory = screen.getAllByRole('button').find(
    (button) => button.getAttribute('aria-pressed') === 'true' && button.textContent?.includes(category),
  );
  expect(activeCategory).toBeDefined();
});

test('encyclopedia writes filter changes back to the share URL', async () => {
  renderAppAt('/encyclopedia');
  const category = categories[1];
  const categoryButton = screen.getAllByRole('button').find(
    (button) => button.getAttribute('aria-pressed') === 'false' && button.textContent?.includes(category),
  );
  expect(categoryButton).toBeDefined();
  fireEvent.click(categoryButton!);

  await waitFor(() => {
    expect(window.location.hash).toContain(`/encyclopedia?category=${encodeURIComponent(category)}`);
  });
});

test('encyclopedia follows browser URL navigation without restoring stale filters', async () => {
  renderAppAt(`/encyclopedia?search=${encodeURIComponent('\u6cb3\u7530\u9e21')}`);
  const input = await screen.findByRole('searchbox', { name: '\u641c\u7d22\u767e\u79d1\u54c1\u79cd' });

  window.location.hash = `/encyclopedia?search=${encodeURIComponent('\u9ad8\u90ae\u9e2d')}`;

  await waitFor(() => {
    expect(input).toHaveValue('\u9ad8\u90ae\u9e2d');
    expect(window.location.hash).toContain('search=%E9%AB%98%E9%82%AE%E9%B8%AD');
  });
});
