# End-to-End, Documentation and Release Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove the upgraded museum works on desktop and 390px mobile without backend configuration, then deliver an evidence-based multi-angle audit and synchronized project documentation.

**Architecture:** Playwright drives the production build in a configuration-free test mode and treats console failures and horizontal overflow as test failures. A small typed documentation utility derives totals from the same runtime dataset, while Markdown remains the source of truth for regenerated PDFs. The release closes with one command matrix and a recorded before/after evidence table.

**Tech Stack:** Playwright 1.62, Vitest 4, TypeScript/tsx, Vite preview, Python ReportLab PDF utility, Markdown

## Global Constraints

- Test desktop and a 390px-wide mobile viewport.
- Static smoke flows must run with Supabase URL/key absent; the AI route must show a clear unconfigured state.
- Console errors, unhandled promise rejections and duplicate React key warnings fail E2E.
- Verify that every main route is reachable, unknown routes show 404 and mobile pages have no document-level horizontal overflow.
- The final audit covers product, data, UX, visual design, mobile, accessibility, performance, reliability, security/privacy, SEO, internationalization, maintainability, testing, dependencies, deployment, documentation and content rights.
- README and manuals must not describe removed login/favorite features or retain stale totals such as 568, 592, 628 or 687.
- Markdown is authoritative; regenerate both website and breed-data PDFs after their Markdown sources are final.
- Dependency findings are classified by exploitability and production reachability; do not force unsafe major upgrades merely to print zero advisories.
- Do not expose the contents of any local environment file in output, reports or test artifacts.
- Follow TDD for utilities and E2E specs, and commit each task only after its checks pass.

---

## File Map

- `playwright.config.ts`: production-preview web server, desktop and mobile projects.
- `e2e/museum.smoke.spec.ts`: navigation, search, detail, comparison, AI degradation and 404 flows.
- `e2e/helpers/consoleGuard.ts`: console/page-error collection that fails tests.
- `tasks/sync-data-docs.ts`: deterministic runtime statistics and marked-section replacement.
- `tasks/__tests__/sync-data-docs.test.ts`: document-marker and generated-statistics tests.
- `docs/项目全面审计与改进报告.md`: 20-angle findings, completed remediation and residual risks.
- `README.md`, `docs/网站说明书.md`, `docs/品种数据手册.md`, `docs/品种图片索引.csv`: synchronized current documentation.
- `docs/网站说明书.pdf`, `docs/品种数据手册.pdf`: regenerated deliverables.

### Task 1: Add desktop and 390px Playwright smoke coverage

**Files:**
- Create: `playwright.config.ts`
- Create: `e2e/helpers/consoleGuard.ts`
- Create: `e2e/museum.smoke.spec.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: Playwright projects `desktop-chromium` and `mobile-390`
- Produces: `guardConsole(page): { assertClean(): void }`
- Produces: scripts `build:e2e` and `test:e2e`

- [ ] **Step 1: Write the user-visible smoke specification**

```ts
import { expect, test } from '@playwright/test';
import { guardConsole } from './helpers/consoleGuard';

let consoleGuard: ReturnType<typeof guardConsole>;
test.beforeEach(async ({ page }) => {
  consoleGuard = guardConsole(page);
});
test.afterEach(() => consoleGuard.assertClean());

test('static museum journey works without backend configuration', async ({ page }) => {
  await page.goto('/#/');
  await expect(page.getByRole('heading', { level: 1 })).toContainText('中国');
  await page.getByRole('link', { name: '品种地图' }).click();
  await page.getByRole('searchbox', { name: '搜索品种' }).fill('准噶尔双峰驼');
  await expect(page.getByText('新疆准噶尔双峰驼')).toBeVisible();
  await page.getByText('新疆准噶尔双峰驼').first().click();
  await expect(page.getByRole('heading', { name: '数据来源与核验' })).toBeVisible();

  await page.goto('/#/ai');
  await expect(page.getByRole('heading', { name: 'AI 服务尚未配置' })).toBeVisible();

  await page.goto('/#/definitely-missing');
  await expect(page.getByRole('heading', { name: '页面未找到' })).toBeVisible();
  await expect(page).toHaveURL(/#\/definitely-missing$/);
});

test('every main route avoids document-level horizontal overflow', async ({ page }) => {
  for (const path of ['/', '/map', '/dashboard', '/encyclopedia', '/compare', '/ai']) {
    await page.goto(`/#${path}`);
    await expect.poll(() => page.evaluate(() =>
      document.documentElement.scrollWidth <= document.documentElement.clientWidth + 1,
    )).toBe(true);
  }
});
```

- [ ] **Step 2: Run the new E2E script and verify missing configuration/spec failure**

Run: `pnpm test:e2e`  
Expected: FAIL before Playwright config and scripts exist, then expose any remaining navigation/overflow defects during implementation.

- [ ] **Step 3: Implement deterministic preview and console guarding**

```ts
// playwright.config.ts
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  use: { baseURL: 'http://127.0.0.1:4173', trace: 'retain-on-failure' },
  webServer: { command: 'pnpm preview --host 127.0.0.1 --port 4173', port: 4173, reuseExistingServer: false },
  projects: [
    { name: 'desktop-chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile-390', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
});
```

`guardConsole` listens for `pageerror` and console messages of type `error`, excludes only explicitly documented browser-extension noise (none in CI), and throws one combined error in `assertClean`. Use `vite build --mode test` for `build:e2e`, so the local `.env.production` is not loaded, then run Playwright against that build. Add these exact flows to the spec: mobile opens the menu and reaches all six links, opens category filters, searches and opens map detail; desktop opens dashboard, encyclopedia and comparison; both projects exercise AI degradation and 404. For overflow, compare `scrollWidth <= clientWidth + 1` rather than hard-coding the browser’s device-scale interpretation.

- [ ] **Step 4: Run both Playwright projects**

Run: `pnpm build:e2e`  
Expected: production output succeeds without backend values.  
Run: `pnpm exec playwright test --project=desktop-chromium`  
Expected: PASS.  
Run: `pnpm exec playwright test --project=mobile-390`  
Expected: PASS at 390px with no console error or document overflow.

- [ ] **Step 5: Commit E2E coverage**

```bash
git add playwright.config.ts e2e package.json
git commit -m "test: cover desktop and mobile museum journeys"
```

### Task 2: Write the evidence-based 20-angle project audit

**Files:**
- Create: `docs/项目全面审计与改进报告.md`
- Modify: `docs/prd.md` where product scope contradicts the shipped public museum
- Modify: `docs/DESIGN.md` where brand or responsive rules are stale

**Interfaces:**
- Produces: one audit table per angle with `现状证据`, `影响`, `本轮处理`, `剩余风险`, `优先级`
- Records: baseline 687 records, 11 duplicate-ID groups, 2.63 MB/754 KB initial bundle, missing-backend white screen and zero tests
- Records: final dataset count, audit result, route chunks, bundle sizes, test counts and E2E projects from command output

- [ ] **Step 1: Create the audit structure with all required angles**

Use these exact sections:

1. 产品定位与目标受众
2. 数据完整性
3. 数据可信度、来源与统计口径
4. 功能正确性
5. 信息架构与导航
6. 交互体验
7. 视觉设计与品牌一致性
8. 移动端与响应式
9. 无障碍与键盘操作
10. 性能与资源加载
11. 稳定性、错误处理与离线体验
12. 安全、隐私与配置管理
13. SEO、语义结构与可发现性
14. 国际化与中文回退
15. 内容质量、图片来源与版权
16. 代码结构与可维护性
17. 测试与质量保障
18. 依赖与供应链风险
19. 构建、部署与浏览器兼容
20. 文档、维护流程与后续路线

- [ ] **Step 2: Collect reproducible before/after evidence**

Run and record non-secret output from:

```powershell
git rev-parse --short HEAD
pnpm data:audit
pnpm typecheck
pnpm lint
pnpm test -- --reporter=verbose
pnpm build
pnpm bundle:check
pnpm exec playwright test
pnpm audit --prod
```

Count runtime records and categories through the tested data-summary utility from Task 3, not regex. Do not copy environment values, request headers or local filesystem usernames into the report.

- [ ] **Step 3: Write findings, decisions and residual risks**

For every section, cite concrete files, test names, build measurements or visible behavior. Mark completed items separately from open risks. Required open risks include: bee/silkworm metric-model incompatibility, legacy narrative/image provenance awaiting record-by-record review, client-side rendering SEO limits, hash routing tradeoff and the need for independent review before claiming image reuse rights. Prioritize residual issues P0–P3 with a short rationale.

- [ ] **Step 4: Cross-check the report against the design specification**

Run: `rg -n "登录|收藏|568|592|628|687个|1090" docs/项目全面审计与改进报告.md docs/prd.md docs/DESIGN.md`  
Expected: historical numbers appear only in clearly labeled baseline evidence; removed functionality is not described as current.

- [ ] **Step 5: Commit the comprehensive audit**

```bash
git add docs/项目全面审计与改进报告.md docs/prd.md docs/DESIGN.md
git commit -m "docs: add comprehensive project quality audit"
```

### Task 3: Generate consistent statistics and synchronize all user documentation

**Files:**
- Create: `tasks/sync-data-docs.ts`
- Create: `tasks/__tests__/sync-data-docs.test.ts`
- Modify: `package.json`
- Modify: `README.md`
- Modify: `docs/网站说明书.md`
- Modify: `docs/品种数据手册.md`
- Modify: `docs/品种图片索引.csv`
- Regenerate: `docs/网站说明书.pdf`
- Regenerate: `docs/品种数据手册.pdf`

**Interfaces:**
- Produces: `buildDataSummary(items: readonly Breed[]): DataSummary`
- Produces: `replaceGeneratedSection(markdown: string, marker: string, content: string): string`
- Produces: script `docs:sync` and dev dependency `tsx`

- [ ] **Step 1: Write deterministic summary and marker tests**

```ts
test('buildDataSummary derives totals and sorted category counts', () => {
  const summary = buildDataSummary([pigFixture, cattleFixture, secondPigFixture]);
  expect(summary).toEqual({
    total: 3, provinceCount: 2, categoryCount: 2,
    categories: [{ name: '猪', count: 2 }, { name: '牛', count: 1 }],
    nationalProtectionCount: 0,
  });
});

test('replaceGeneratedSection changes only the named marked block', () => {
  const input = 'before\n<!-- data-summary:start -->\nold\n<!-- data-summary:end -->\nafter';
  expect(replaceGeneratedSection(input, 'data-summary', 'new')).toBe(
    'before\n<!-- data-summary:start -->\nnew\n<!-- data-summary:end -->\nafter',
  );
});
```

- [ ] **Step 2: Run utility tests and verify the module is absent**

Run: `pnpm exec vitest run tasks/__tests__/sync-data-docs.test.ts`  
Expected: FAIL because the documentation utility does not exist.

- [ ] **Step 3: Implement data-derived documentation and update prose**

Implement pure exports in `sync-data-docs.ts`; execute writes only under an `import.meta.url` CLI guard. The CLI updates marked sections in README, website manual and data manual using the actual `breeds` array and `getBreedMetadata`, then validates there is exactly one start/end marker pair per file. Add `tsx` as a pinned dev dependency and expose `docs:sync` through package scripts.

Update prose outside generated sections:

- README: current public features, Node/pnpm prerequisites, optional AI variables, safe `.env.example` setup, scripts, GitHub Pages route model, source policy and project structure.
- 网站说明书: remove login/favorite flows; document the mobile menu, filters, comparison, AI unavailable state, keyboard navigation, data sources and 404.
- 品种数据手册: state the final runtime total, category table, 940 announcement scope, 23 additions, three canonical aliases, eight merges, three homophone ID repairs, editorial radar disclaimer and 2026-09-27 verification date.
- 图片索引: add the 23 records with `/brand/breed-placeholder.svg`, source status “待取得可复用图片” and no fabricated author/license fields; update three renamed rows.

- [ ] **Step 4: Sync, regenerate PDFs and verify dates/content**

Run: `pnpm docs:sync`  
Expected: all three Markdown files receive the same final total and category values.  
Run: `python tasks/md_to_pdf.py docs/网站说明书.md docs/网站说明书.pdf`  
Expected: regenerated website manual PDF.  
Run: `python tasks/md_to_pdf.py docs/品种数据手册.md docs/品种数据手册.pdf`  
Expected: regenerated data manual PDF.  
Run: `rg -n "登录|收藏|568|592|628|687个|1090" README.md docs/网站说明书.md docs/品种数据手册.md`  
Expected: no stale current-feature or current-total claims.

- [ ] **Step 5: Commit synchronized documentation**

```bash
git add package.json pnpm-lock.yaml tasks/sync-data-docs.ts tasks/__tests__/sync-data-docs.test.ts README.md docs/网站说明书.md docs/网站说明书.pdf docs/品种数据手册.md docs/品种数据手册.pdf docs/品种图片索引.csv
git commit -m "docs: synchronize manuals with verified dataset"
```

### Task 4: Run the release gate and close the audit with final evidence

**Files:**
- Modify: `docs/项目全面审计与改进报告.md`
- Modify: `README.md` if command names changed during execution
- Modify: `package.json` only if the aggregate `check` script is incomplete

**Interfaces:**
- Produces: one `pnpm check` release gate covering typecheck, lint, unit/component tests, data audit and production build/budget
- Produces: final evidence table with commands, dates, status and non-secret measurements

- [ ] **Step 1: Make the aggregate check explicit and cross-platform**

The final script order is:

```json
{
  "scripts": {
    "check": "pnpm typecheck && pnpm lint && pnpm test && pnpm data:audit && pnpm build && pnpm bundle:check",
    "check:all": "pnpm check && pnpm build:e2e && pnpm exec playwright test"
  }
}
```

- [ ] **Step 2: Run dependency/security inspection without exposing configuration**

Run: `pnpm audit --prod`  
Expected: record advisory IDs, severity, affected production path and whether the vulnerable code is reachable; an advisory is not silently ignored.  
Run: `pnpm outdated`  
Expected: record only upgrades relevant to security, browser support or maintained compatibility; no automatic major-version sweep.

- [ ] **Step 3: Execute the complete release gate**

Run: `pnpm check:all`  
Expected: typecheck, Biome, Vitest, data audit, production build, bundle budget and both Playwright projects all PASS.

- [ ] **Step 4: Perform the final manual acceptance pass**

Inspect the production preview in light/dark modes at 1440×900 and 390×844:

- mark, wordmark, favicon and image fallback are visually coherent;
- all 23 new names search to one correct record;
- the three old aliases reach their canonical records;
- data-source links and verification dates render;
- mobile navigation, filter drawer and map detail are usable by touch and keyboard;
- no page-level horizontal overflow exists;
- missing external images retain their frame and show the SVG fallback;
- static routes work with no backend config and AI explains its unavailable state;
- unknown URL remains visible on the 404 page.

- [ ] **Step 5: Record final numbers and commit the release evidence**

Update the audit’s evidence table with the final commit, dataset count, official-list match count, tests passed, E2E projects passed, entry raw/gzip size, async chunk names and remaining dependency advisories. Then:

```bash
git add docs/项目全面审计与改进报告.md README.md package.json
git commit -m "chore: record final quality upgrade verification"
```

Run: `git status --short --branch`  
Expected: clean working tree on `main`, ahead only by the reviewed upgrade commits.
