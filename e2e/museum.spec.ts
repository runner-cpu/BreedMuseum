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
 * 四个路由（本轮重设计后的全部页面）。
 * 用例在 `reducedMotion: 'reduce'` 下运行：3D 场景走「直显」分支，
 * 断言基于 DOM（计数、表格、按钮），不依赖帧动画。
 */
for (const path of ['/', '/arcade', '/about', '/breed/hetian-chicken', '/breed/not-a-real-breed', '/not-a-route']) {
  test('public route ' + path + ' loads without backend', async ({ page, baseURL }) => {
    await page.goto('/#' + path);
    await expect(page.locator('main h1')).toHaveCount(1);
    await expect(page.locator('main h1')).toBeVisible();
    await expect(page).not.toHaveTitle(/React|Vite/);
    const description = page.locator('meta[name="description"]').last();
    await expect(description).toHaveAttribute('content', /.+/);
    await expect(page.locator('link[rel="canonical"]')).toHaveCount(1);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true);
    if (path === '/not-a-route') {
      await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
      expect(page.url()).toContain('/not-a-route');
    }
    if (path === '/breed/not-a-real-breed') {
      await expect(page.getByRole('heading', { name: '档案未找到' })).toBeVisible();
    }
  });
}

/** 旧路由必须重定向到光图，不能 404（已发布外链兼容）。 */
for (const legacy of ['/map', '/encyclopedia', '/dashboard', '/compare', '/pasture', '/recommend', '/ai']) {
  test('legacy route ' + legacy + ' redirects to the light map', async ({ page }) => {
    await page.goto('/#' + legacy);
    await expect(page).toHaveURL(/#\/$/);
    await expect(page.locator('main h1')).toBeVisible();
  });
}

test('light map exposes the lens switcher, province focus and the digest table', async ({ page }) => {
  await page.goto('/#/');
  // HUD 文案：钩子句与落点计数
  await expect(page.getByText(/你家的省份亮了几个/)).toBeVisible();
  // 四个镜头
  const tabs = page.getByRole('tab');
  await expect(tabs).toHaveCount(4);
  await expect(page.getByRole('tab', { name: '国家级保护' })).toBeVisible();
  // 省份聚焦侧栏：点一个省份后出现该省品种列表
  await page.getByRole('button', { name: /^云南 \d+$/ }).click();
  await expect(page.getByRole('heading', { name: '云南' })).toBeVisible();
  // 无障碍等价物：摘要表必须存在且合计与馆藏一致
  const summary = page.locator('details', { hasText: '光图数据摘要' });
  await summary.locator('summary').click();
  await expect(summary.locator('table')).toBeVisible();
  await expect(summary.getByRole('row', { name: /合计/ })).toContainText('1186');
});

test('lens switching keeps the conclusion line in sync', async ({ page }) => {
  await page.goto('/#/');
  await page.getByRole('tab', { name: '国家级保护' }).click();
  await expect(page.getByText(/271 个品种拥有国家级身份/)).toBeVisible();
  await page.getByRole('tab', { name: '濒危之窗' }).click();
  await expect(page.getByText(/82 个记录被编辑标注为濒危/)).toBeVisible();
});

test('search inside the light map opens a breed record', async ({ page }) => {
  await page.goto('/#/');
  const search = page.getByRole('searchbox', { name: /检索品种/ });
  await search.fill('河田鸡');
  await page.getByRole('button', { name: /^河田鸡/ }).first().click();
  await expect(page).toHaveURL(/#\/breed\//);
  await expect(page.getByRole('heading', { name: '河田鸡', level: 1 })).toBeVisible();
});

test('breed record shows the archive header and official source links', async ({ page }, testInfo) => {
  await page.goto('/#/breed/hetian-chicken');
  await expect(page.getByRole('heading', { name: '河田鸡', level: 1 })).toBeVisible();
  await expect(page.getByText(/^档案编号 BM-/)).toBeVisible();
  // 卷宗头部必须给出官方来源入口
  await expect(page.getByRole('link', { name: /2024 名录官方页面/ })).toHaveAttribute(
    'href',
    /nahs\.org\.cn/,
  );
  if (testInfo.project.name === 'desktop') {
    await expect(page.getByRole('heading', { name: '数据来源与核验' })).toBeVisible();
  }
});

test('arcade exposes three playable exhibits with keyboard-usable options', async ({ page }) => {
  await page.goto('/#/arcade');
  await expect(page.getByRole('heading', { name: '找家挑战' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '识图挑战' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '知识问答' })).toBeVisible();

  // 装置一：选一个省份作答，必须出现反馈（正确或距离提示）
  await page.getByRole('group', { name: '选择省份作答' }).getByRole('button').first().click();
  await expect(page.getByText(/答对了|方向不对/)).toBeVisible();

  // 装置二：识图选项作答后展示解析与代表品种
  await page.getByRole('group', { name: '选择类别' }).getByRole('button').first().click();
  await expect(page.getByText(/剪影取自馆藏类别的/)).toBeVisible();

  // 装置三：问答作答后给出解析与档案入口
  await page.getByRole('group', { name: '选择答案' }).getByRole('button', { name: /./ }).first().click();
  await expect(page.getByRole('link', { name: /查看「.+」档案/ })).toBeVisible();
});

test('about page carries provenance, mapping table, quality dashboard and disclosure', async ({ page }) => {
  await page.goto('/#/about');
  await expect(page.getByRole('heading', { name: '馆史与库房' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '数据来源链' })).toBeVisible();
  await expect(page.getByRole('heading', { name: '质量仪表盘' })).toBeVisible();
  await expect(page.getByRole('heading', { name: /AI 使用披露与第三方资源/ })).toBeVisible();
  // 官方来源链与映射表
  await expect(page.getByRole('link', { name: /官方 PDF/ })).toHaveAttribute('href', /nahs\.org\.cn/);
  await expect(page.getByText('诚实映射表', { exact: false })).toBeVisible();
  // 质量仪表盘数字来自常量：馆藏记录总数
  await expect(page.getByText('1186', { exact: true })).toBeVisible();
});

test('mobile menu exposes the three primary destinations and closes by keyboard', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile');
  await page.goto('/#/');
  await page.getByRole('button', { name: '打开导航菜单' }).click();
  const menu = page.getByRole('dialog');
  // 导航为 3 项：畜种光图 / 互动厅 / 馆史与库房
  await expect(menu.getByRole('navigation').getByRole('link')).toHaveCount(3);
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
