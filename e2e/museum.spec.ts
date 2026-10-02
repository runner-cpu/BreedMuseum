import { expect, test, type Page } from 'playwright/test';
import { readFileSync } from 'node:fs';
const placeholder = readFileSync('public/brand/breed-placeholder.svg');
const errors = new WeakMap<Page, string[]>();
test.beforeEach(async ({ page, baseURL }) => {
  const seen: string[] = []; errors.set(page, seen);
  const localOrigin = baseURL ? new URL(baseURL).origin : '';
  page.on('pageerror', error => seen.push(error.message));
  page.on('console', message => { if (message.type() === 'error') seen.push(message.text()); });
  // Breed photo providers are not part of deterministic UI acceptance.
  await page.route('**/*', route => {
    const request = route.request();
    if (new URL(request.url()).origin !== localOrigin && request.resourceType() === 'image') return route.fulfill({ contentType: 'image/svg+xml', body: placeholder });
    return route.continue();
  });
});
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]); });
for (const path of ['/', '/map', '/dashboard', '/encyclopedia', '/compare', '/ai', '/not-a-route']) {
  test('public route ' + path + ' loads without backend', async ({ page, baseURL }) => {
    await page.goto('/#' + path);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page).not.toHaveTitle(/React|Vite/);
    const description = page.locator('meta[name="description"]').last();
    await expect(description).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    const expectedCanonical = new URL('/', baseURL ?? page.url()).href;
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', expectedCanonical);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBe(true);
    if (path === '/ai') await expect(page.getByRole('heading', { name: 'AI 服务尚未配置' })).toBeVisible();
    if (path === '/not-a-route') { await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible(); expect(page.url()).toContain('/not-a-route'); }
  });
}
test('canonical aliases find exactly one correct breed', async ({ page }) => {
  await page.goto('/#/encyclopedia');
  const input = page.getByRole('searchbox', { name: '搜索百科品种' });
  for (const [query, canonical] of [['青海驴', '青海毛驴'], ['准噶尔双峰驼', '新疆准噶尔双峰驼'], ['山麻鸭', '龙岩山麻鸭'], ['驯鹿', '敖鲁古雅驯鹿'], ['河田鸡', '河田鸡']]) {
    await input.fill(query);
    await expect(page.getByRole('button', { name: '查看' + canonical, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '查看' + canonical, exact: true })).toHaveCount(1);
    if (query === '山麻鸭') await expect(page.getByRole('button', { name: '查看微山麻鸭', exact: true })).toBeVisible();
  }
  await input.fill('不存在的品种xyz');
  await expect(page.getByRole('button', { name: /查看全部/ })).toBeVisible();
});
test('source detail and compare work across routes', async ({ page }, testInfo) => {
  const mobile = testInfo.project.name === 'mobile';
  await page.goto('/#/encyclopedia?search=' + encodeURIComponent('河田鸡'));
  await page.getByRole('button', { name: '查看河田鸡', exact: true }).click();
  const detail = mobile ? page.getByRole('dialog') : page.getByRole('complementary', { name: '品种详情' });
  await expect(detail.getByRole('heading', { name: '数据来源与核验' })).toBeVisible();
  await expect(detail.getByText('2026-09-27', { exact: true })).toBeVisible();
  await expect(detail.getByRole('link', { name: /940/ })).toHaveAttribute('href', new RegExp('^https://www[.]moa[.]gov[.]cn/'));
  await detail.getByRole('button', { name: '加入对比', exact: true }).click();
  await expect(detail.getByRole('button', { name: '对比中', exact: true })).toBeVisible();
  if (mobile) await page.getByRole('button', { name: '关闭面板' }).click();
  await page.evaluate(() => { location.hash = '/compare'; });
  await expect(page.getByRole('button', { name: '移除河田鸡' })).toBeVisible();
  await page.getByRole('button', { name: '移除河田鸡' }).click();
  await expect(page.getByRole('button', { name: '浏览百科并选择品种' })).toBeVisible();
});
test('mobile menu exposes all six destinations and closes by keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const menu = page.getByRole('dialog');
  await expect(menu.getByRole('navigation').getByRole('link')).toHaveCount(6);
  await page.keyboard.press('Escape'); await expect(menu).not.toBeVisible();
  await page.getByRole('button', { name: '打开品种搜索' }).click();
  await menu.getByRole('searchbox').fill('河田鸡');
  await menu.getByRole('button', { name: '开始搜索' }).click();
  await expect(page.getByRole('button', { name: '河田鸡', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /畜种筛选/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^牛/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('charts expose readable tables and dark theme works', async ({ page }, testInfo) => {
  await page.goto('/#/dashboard');
  await page.locator('summary').first().click();
  await expect(page.locator('details[open] table')).toBeVisible();
  if (testInfo.project.name === 'mobile') await page.getByRole('button', { name: '打开导航菜单' }).click();
  await page.getByRole('button', { name: '切换主题', exact: true }).click();
  await page.getByRole('menuitem', { name: '深色模式' }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});
test('offline notice preserves the current page', async ({ page }) => {
  await page.goto('/#/encyclopedia');
  await expect(page.locator('main h1')).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByRole('status', { name: '当前处于离线状态' })).toBeVisible();
  await expect(page.locator('main h1')).toBeVisible();
  await page.context().setOffline(false);
});
