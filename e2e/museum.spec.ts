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

/**
 * 页面清单（本轮重设计后的全部页面）：
 * `/`（序厅首页）、`/explore`（地图探索）、`/arcade`（总览）、`/arcade/:game`（三台装置各自成页）、
 * `/compare`、已移除的 `/breed/:id` 与 `/about`、以及其他未知路径的 404。
 * 用例在 `reducedMotion: 'reduce'` 下运行：地图与互动装置走静态可验证分支，
 * 断言基于 DOM（计数、表格、按钮），不依赖帧动画。
 */
for (const path of [
  '/',
  '/explore',
  '/map',
  '/arcade',
  '/arcade/find-home',
  '/arcade/identify',
  '/arcade/quiz',
  '/dashboard',
  '/compare',
  '/about',
  '/breed/hetian-chicken',
  '/breed/not-a-real-breed',
  '/not-a-route',
]) {
  test('public route ' + path + ' loads without backend', async ({ page, baseURL }) => {
    await page.goto('/#' + path);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page).not.toHaveTitle(/React|Vite/);
    const description = page.locator('meta[name="description"]').last();
    await expect(description).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    // 舞台配色必须跟主题走：浅色模式下内容区不能还是黑的
    const tone = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--stage').trim());
    expect(tone).toMatch(/^#[0-9a-f]{6}$/i);
    if (path === '/not-a-route') {
      await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
      expect(page.url()).toContain('/not-a-route');
    }
    if (path === '/about' || path.startsWith('/breed/')) {
      await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
    }
  });
}

/** 旧路由必须重定向到首页序厅，不能 404（已发布外链兼容）。地图旧入口保留为探索页别名。 */
for (const legacy of ['/pasture', '/recommend', '/ai', '/home']) {
  test('legacy route ' + legacy + ' redirects to the museum foyer', async ({ page }) => {
    await page.goto('/#' + legacy);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('main h1')).toBeVisible();
  });
}

test('dashboard route exposes interactive collection charts', async ({ page }) => {
  await page.goto('/#/dashboard');
  await expect(page.getByRole('heading', { name: '看见地方品种的分布与缺口' })).toBeVisible();
  await expect(page.getByRole('img', { name: '馆藏品种区域分布图' })).toBeVisible();
  await expect(page.getByRole('img', { name: '馆藏类别构成环形图' })).toBeVisible();
  await expect(page.getByRole('img', { name: '保护名录匹配横向条形图' })).toBeVisible();
  await expect(page.getByRole('img', { name: '省份馆藏数量排名图' })).toBeVisible();
  await expect(page.getByRole('region', { name: '馆藏核心指标' }).getByText('国家级保护匹配')).toBeVisible();
});

test('home introduces the museum and guides visitors into exploration', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { name: /中国地方畜禽.*品种数字博物馆/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: '四个数字，认识这座馆' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '选择一种进入方式' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '从一张品种卡开始' })).toBeVisible();
  // The foyer's primary CTA is labelled "开始探索".  It should take visitors
  // to the dedicated map instead of relying on the removed home overview block.
  await page.getByRole('button', { name: '开始探索' }).click();
  await expect(page).toHaveURL(/#\/explore$/);
  await expect(page.getByRole('heading', { name: '地图探索' })).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/#\/$/);
  // The old long-form about/collection panel was removed from the foyer.
  await expect(page.getByRole('heading', { name: '把名录里的名字，重新放回土地', exact: true })).toHaveCount(0);
  await expect(page.getByText('1,186', { exact: true }).first()).toBeVisible();
});

test('explore route exposes category tabs and a focused map', async ({ page }) => {
  await page.goto('/#/explore');
  await expect(page.getByRole('heading', { name: '地图探索' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '全国品种分布' })).toBeVisible();
  await expect(page.getByRole('tablist', { name: '地图镜头' })).toBeVisible();
  await expect(page.getByRole('tab')).toHaveCount(16);
  await page.getByRole('tab', { name: '鸡' }).click();
  await expect(page.getByRole('tab', { name: '鸡' })).toHaveAttribute('aria-selected', 'true');
  await expect(page.getByText(/个产区簇 ·/)).toBeVisible();
});

test('explore category tabs keep the map focused', async ({ page }) => {
  await page.goto('/#/explore');
  await page.getByRole('tab', { name: '全部' }).click();
  await expect(page.getByRole('tab', { name: '全部' })).toHaveAttribute('aria-selected', 'true');
  await page.getByRole('tab', { name: '牛' }).click();
  await expect(page.getByRole('tab', { name: '牛' })).toHaveAttribute('aria-selected', 'true');
});

test('encyclopedia search opens a breed detail panel', async ({ page }) => {
  await page.goto('/#/encyclopedia');
  const search = page.getByRole('searchbox', { name: /搜索品种名称/ });
  await search.fill('河田鸡');
  await page.getByRole('button', { name: /河田鸡/ }).first().click();
  await expect(page).toHaveURL(/#\/encyclopedia\?.*breed=hetian-chicken/);
  await expect(page.getByRole('dialog', { name: '河田鸡详情' })).toBeVisible();
  await expect(page.getByRole('dialog').getByRole('heading', { name: '河田鸡', level: 2 })).toBeVisible();
});

test('removed breed archive route remains a true 404', async ({ page }) => {
  await page.goto('/#/breed/hetian-chicken');
  await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
  await expect(page.getByText('/breed/hetian-chicken', { exact: true })).toBeVisible();
});

test('arcade overview hands out one entrance per exhibit', async ({ page }) => {
  await page.goto('/#/arcade');
  await expect(page.getByRole('heading', { name: '互动厅 · 三台展教装置' })).toBeVisible();
  const entrances = page.getByRole('link', { name: /进场/ });
  await expect(entrances).toHaveCount(3);
  // 总览页不渲染任何装置本体：一台都不许挤在这里
  await expect(page.getByRole('group', { name: '选择省份作答' })).toHaveCount(0);
  await expect(page.getByRole('group', { name: '选择答案' })).toHaveCount(0);
});

test('each arcade exhibit is its own page and switches without going back', async ({ page }) => {
  await page.goto('/#/arcade/find-home');
  await expect(page.getByRole('heading', { name: '找家挑战' })).toBeVisible();
  await page.getByRole('group', { name: '选择省份作答' }).getByRole('button').first().click();
  await expect(page.getByText(/答对了|方向不对/)).toBeVisible();
  // 从找家直接换到问答，不必回总览
  await page.getByRole('navigation', { name: '切换展教装置' }).getByRole('link', { name: '知识问答' }).click();
  await expect(page).toHaveURL(/#\/arcade\/quiz$/);
  await expect(page.getByRole('heading', { name: '知识问答' })).toBeVisible();
  await page.getByRole('group', { name: '选择答案' }).getByRole('button').first().click();
  await expect(page.getByRole('link', { name: /查看「.+」详情/ })).toBeVisible();
  // 第三台：识图
  await page.getByRole('navigation', { name: '切换展教装置' }).getByRole('link', { name: '识图挑战' }).click();
  await page.getByRole('group', { name: '选择类别' }).getByRole('button').first().click();
  await expect(page.getByText(/剪影取自馆藏类别的/)).toBeVisible();
});

test('an unknown exhibit falls back to the arcade overview', async ({ page }) => {
  await page.goto('/#/arcade/not-a-game');
  await expect(page).toHaveURL(/#\/arcade$/);
  await expect(page.getByRole('heading', { name: '互动厅 · 三台展教装置' })).toBeVisible();
});

/** 主题开关在桌面顶栏、移动端在抽屉里；两种视口都能拿到同一个菜单。 */
async function chooseTheme(page: Page, label: RegExp) {
  const trigger = page.locator('button[aria-label="切换主题"]:visible');
  if ((await trigger.count()) === 0) {
    await page.getByRole('button', { name: '打开导航菜单' }).click();
  }
  await page.locator('button[aria-label="切换主题"]:visible').first().click();
  await page.getByRole('menuitem', { name: label }).click();
}

/** 用一个十六进制底色算相对亮度，判断「浅底 / 深底」。 */
async function stageLuminance(page: Page): Promise<number> {
  return page.evaluate(() => {
    const hex = getComputedStyle(document.documentElement).getPropertyValue('--stage').trim();
    const value = hex.replace('#', '');
    const channels = [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16) / 255);
    const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  });
}

test('theme switch repaints the stage instead of leaving it black', async ({ page }) => {
  await page.goto('/#/');

  await chooseTheme(page, /浅色模式/);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  const lightStage = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--stage').trim(),
  );
  const lightLuminance = await stageLuminance(page);
  // 浅色舞台必须是亮底：不能出现「切了浅色还是黑的」
  expect(lightLuminance).toBeGreaterThan(0.6);
  // 页面正文颜色也必须跟着换（否则就是「黑底黑字」）
  const bodyColor = await page.evaluate(() => getComputedStyle(document.body).color);
  expect(bodyColor).not.toMatch(/rgba?\(255,\s*255,\s*255/);

  await chooseTheme(page, /深色模式/);
  await expect(page.locator('html')).toHaveClass(/dark/);
  const darkStage = await page.evaluate(() =>
    getComputedStyle(document.documentElement).getPropertyValue('--stage').trim(),
  );
  const darkLuminance = await stageLuminance(page);
  expect(darkLuminance).toBeLessThan(0.1);
  expect(lightStage).not.toBe(darkStage);
});

test('dashboard page exposes collection coverage and quality summaries', async ({ page }) => {
  await page.goto('/#/dashboard');
  await expect(page.getByRole('heading', { name: '看见地方品种的分布与缺口' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '数据覆盖度' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '保护与风险' })).toBeVisible();
  await expect(page.getByText('1,186', { exact: true }).first()).toBeVisible();
});

test('mobile menu exposes the three primary destinations and closes by keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const menu = page.getByRole('dialog');
  // 导航为 6 项：首页 / 地图探索 / 品种百科 / 数据看板 / 互动厅 / 品种对比
  await expect(menu.getByRole('navigation').getByRole('link')).toHaveCount(6);
  await page.keyboard.press('Escape'); await expect(menu).not.toBeVisible();
});

test('offline notice preserves the current page', async ({ page }) => {
  await page.goto('/#/arcade');
  await expect(page.locator('main h1')).toBeVisible();
  await page.context().setOffline(true);
  await expect(page.getByRole('status', { name: '当前处于离线状态' })).toBeVisible();
  await expect(page.locator('main h1')).toBeVisible();
  await page.context().setOffline(false);
});
