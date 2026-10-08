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
for (const path of ['/', '/map', '/dashboard', '/encyclopedia', '/compare', '/ai', '/pasture', '/recommend', '/not-a-route']) {
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
test('mobile menu exposes all seven destinations and closes by keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const menu = page.getByRole('dialog');
  await expect(menu.getByRole('navigation').getByRole('link')).toHaveCount(7);
  await page.keyboard.press('Escape'); await expect(menu).not.toBeVisible();
  await page.getByRole('button', { name: '打开品种搜索' }).click();
  await menu.getByRole('searchbox').fill('河田鸡');
  await menu.getByRole('button', { name: '开始搜索' }).click();
  await expect(page.getByRole('button', { name: '河田鸡', exact: true })).toBeVisible();
  await page.getByRole('button', { name: /畜种筛选/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: /^牛/ }).click();
  await expect(page.getByRole('dialog')).not.toBeVisible();
});
test('homepage stats show real values without scrolling', async ({ page }) => {
  await page.goto('/#/');
  // 首屏数据看板：四个核心数字必须直接是真实值（历史 CountUp 归零 bug 回归门禁）
  const stats = page.locator('p.tabular-nums');
  await expect(stats.first()).toHaveText(/\d+/);
  await expect(stats.nth(0)).toHaveText('1186'); // 已收录品种
  await expect(stats.nth(1)).toHaveText('66'); // 青藏高原品种（青海 + 西藏）
  await expect(stats.nth(2)).toHaveText('31'); // 覆盖省份
  await expect(stats.nth(3)).toHaveText('13'); // 国家级保护品种（940号公告）
});
test('homepage core entry cards show preview thumbnails', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('img', { name: /牧场决策台预览/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /品种推荐预览/ })).toBeVisible();
  await expect(page.getByRole('img', { name: /品种地图预览/ })).toBeVisible();
});
test('pasture console computes THI and updates stress level', async ({ page }) => {
  await page.goto('/#/pasture');
  await expect(page.locator('main h1')).toBeVisible();
  // 默认牦牛 18℃ / 55% / 3200m → 有效 THI 落到舒适区间
  const levelBadge = page.locator('figcaption', { hasText: '应激等级：' });
  await expect(levelBadge).toHaveText(/应激等级：舒适/);
  const gauge = page.getByRole('img', { name: /有效 THI/ });
  await expect(gauge).toBeVisible();
  // 绿→黄→橙→红分级色带必须存在
  await expect(page.getByRole('img', { name: '热应激分级色带' })).toBeVisible();
  // 调高温度后进入警戒/危险档，三条优先建议随之更新
  const temp = page.getByRole('slider', { name: '日间温度' });
  await temp.fill('30');
  await expect(levelBadge).toHaveText(/应激等级：危险|应激等级：极端/);
  await expect(page.getByRole('heading', { name: /管理建议 · 应激等级/ })).toBeVisible();
  await expect(page.getByText('三条优先管理动作')).toBeVisible();
  const top3 = page.locator('ol li').filter({ hasText: /通风|放牧|补饲/ });
  expect(await top3.count()).toBeGreaterThanOrEqual(3);
});
test('breed advisor returns scored plateau recommendations', async ({ page }) => {
  await page.goto('/#/recommend');
  await page.getByRole('button', { name: '生成推荐' }).click();
  await expect(page.getByRole('heading', { name: '推荐结果' })).toBeVisible();
  const items = page.locator('ol > li');
  await expect(items.first()).toBeVisible();
  await expect(items.first().getByText(/适应性评分 \d+/)).toBeVisible();
  // 决策路径：海拔 / 用途 / 模式三条匹配理由必须出现
  await expect(items.first().getByText('海拔匹配')).toBeVisible();
  await expect(items.first().getByText('用途匹配')).toBeVisible();
  await expect(items.first().getByText('模式匹配')).toBeVisible();
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
