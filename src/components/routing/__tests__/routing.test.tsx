import { screen, waitFor } from '@testing-library/react';
import { expect, test } from 'vitest';
import { renderAppAt } from '@/test/render';
import { LEGACY_ROUTES } from '@/routes';

test('unknown address stays visible on a true 404', async () => {
  renderAppAt('/missing-breed-page');
  expect(await screen.findByRole('heading', { name: '页面未找到' })).toBeVisible();
  expect(window.location.hash).toContain('/missing-breed-page');
  expect(screen.getByText('/missing-breed-page')).toBeVisible();
  await waitFor(() => expect(document.title).toContain('页面未找到'));
});

/**
 * 四个路由（/ 光图、/arcade 互动厅、/breed/:id 档案、/about 馆史）
 * 是本轮重设计的全部页面；其余旧路径必须重定向到光图，不能 404。
 */
test('legacy routes redirect to the light map instead of 404', async () => {
  for (const legacy of LEGACY_ROUTES) {
    renderAppAt(legacy);
    await waitFor(() => expect(window.location.hash).toBe('#/'), { timeout: 5000 });
    expect(screen.queryByRole('heading', { name: '页面未找到' })).toBeNull();
  }
});

test('arcade route renders the three exhibits', async () => {
  renderAppAt('/arcade');
  expect(await screen.findByRole('heading', { name: '互动厅 · 三台展教装置' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '找家挑战' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '识图挑战' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '知识问答' })).toBeVisible();
});

test('about route exposes provenance, mapping table and AI disclosure', async () => {
  renderAppAt('/about');
  expect(await screen.findByRole('heading', { name: '馆史与库房' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '数据来源链' })).toBeVisible();
  expect(screen.getByText(/诚实映射表/)).toBeVisible();
  expect(screen.getByRole('heading', { name: /AI 使用披露与第三方资源/ })).toBeVisible();
  // 官方来源链必须可点击
  expect(screen.getAllByRole('link', { name: /官方页面|官方 PDF|公告页面/ }).length).toBeGreaterThanOrEqual(2);
});

test('breed record route explains a missing id and links back', async () => {
  renderAppAt('/breed/not-a-real-breed');
  expect(await screen.findByRole('heading', { name: '档案未找到' })).toBeVisible();
  expect(screen.getByRole('link', { name: /返回光图/ })).toBeVisible();
});
