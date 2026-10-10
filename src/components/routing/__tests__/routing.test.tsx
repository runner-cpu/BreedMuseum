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
 * 页面清单：`/` 光图、`/arcade` 互动厅总览、`/arcade/:game` 单台装置、
 * `/breed/:id` 档案、`/about` 馆史；其余旧路径必须重定向到光图，不能 404。
 */
test('legacy routes redirect to the light map instead of 404', async () => {
  for (const legacy of LEGACY_ROUTES) {
    renderAppAt(legacy);
    await waitFor(() => expect(window.location.hash).toBe('#/'), { timeout: 5000 });
    expect(screen.queryByRole('heading', { name: '页面未找到' })).toBeNull();
  }
});

test('arcade overview lists the three exhibits as separate entrances', async () => {
  renderAppAt('/arcade');
  expect(await screen.findByRole('heading', { name: '互动厅 · 三台展教装置' })).toBeVisible();
  // 三台装置各自成页：总览只给入口（链接），不把三台挤在同一屏
  for (const title of ['找家挑战', '识图挑战', '知识问答']) {
    expect(screen.getByRole('link', { name: new RegExp(title) })).toBeVisible();
  }
  expect(screen.queryByRole('group', { name: '选择省份作答' })).toBeNull();
});

test('each arcade exhibit has its own page and can switch to the others', async () => {
  for (const [game, title, group] of [
    ['find-home', '找家挑战', '选择省份作答'],
    ['identify', '识图挑战', '选择类别'],
    ['quiz', '知识问答', '选择答案'],
  ] as const) {
    const view = renderAppAt('/arcade/' + game);
    expect(await screen.findByRole('heading', { name: title })).toBeVisible();
    // 当前装置只渲染自己那一台
    expect(screen.getByRole('group', { name: group })).toBeVisible();
    // 切换器里三个装置都在，可随时换台
    expect(screen.getByRole('navigation', { name: '切换展教装置' }).querySelectorAll('a')).toHaveLength(3);
    view.unmount();
  }
});

test('an unknown exhibit name falls back to the arcade overview', async () => {
  renderAppAt('/arcade/not-a-game');
  expect(await screen.findByRole('heading', { name: '互动厅 · 三台展教装置' })).toBeVisible();
  await waitFor(() => expect(window.location.hash).toBe('#/arcade'));
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
