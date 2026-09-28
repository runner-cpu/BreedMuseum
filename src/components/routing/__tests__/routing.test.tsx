import { screen, waitFor } from '@testing-library/react';
import { expect, test, vi } from 'vitest';
import { renderAppAt } from '@/test/render';

test('unknown address stays visible on a true 404', async () => {
  renderAppAt('/missing-breed-page');
  expect(await screen.findByRole('heading', { name: '页面未找到' })).toBeVisible();
  expect(window.location.hash).toContain('/missing-breed-page');
  expect(screen.getByText('/missing-breed-page')).toBeVisible();
  await waitFor(() => expect(document.title).toContain('页面未找到'));
});
test('AI without backend explains its state and keeps museum navigation', async () => {
  vi.stubEnv('VITE_SUPABASE_URL', '');
  vi.stubEnv('VITE_SUPABASE_ANON_KEY', '');
  renderAppAt('/ai');
  expect(await screen.findByRole('heading', { name: 'AI 服务尚未配置' })).toBeVisible();
  expect(screen.getByRole('link', { name: '浏览品种百科' })).toHaveAttribute('href', '#/encyclopedia');
  vi.unstubAllEnvs();
});
