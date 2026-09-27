# Reliability, SEO and Performance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all static museum pages work without backend configuration, expose real route metadata and 404 behavior, and cut the initial JavaScript payload by loading AI, charts and export tooling only when needed.

**Architecture:** A validated runtime-config module becomes the only route to Supabase and creates its client lazily. Route definitions own lazy page components and SEO metadata, while the shared shell supplies Suspense and branded error states. Vite emits a manifest that a deterministic bundle-budget script checks after every production build.

**Tech Stack:** React 18, React Router 7 compatibility API, React Helmet Async, Supabase JS, Vite 8, Vitest, dynamic `import()`

## Global Constraints

- Home, map, dashboard, encyclopedia, compare and 404 must render with both Supabase variables absent.
- Only the AI page may show a clear “service not configured” state when backend configuration is missing.
- Never print or copy plaintext environment values into source, tests, logs or documentation.
- Keep HashRouter and relative Vite base compatibility for the existing GitHub Pages subpath deployment.
- Every principal route needs a distinct title, description, canonical link and base Open Graph metadata.
- Unknown routes render a real 404 and preserve the requested path; they do not redirect home.
- AI, PDF/screenshot, charts, QR and optional monitoring code must not enter the initial page chunk.
- Fix the Vite ESM `__dirname` warning with `import.meta.dirname` or `fileURLToPath`.
- Do not rewrite Git history during this change. Stop tracking live deployment configuration, keep the local file intact, and provide a value-free example.
- Follow TDD and commit each task only after focused tests and the relevant build check pass.

---

## File Map

- `src/config/backend.ts`: validation and lazy Supabase client factory.
- `src/components/ai/BackendUnavailable.tsx`: explicit no-config state.
- `src/routes.tsx`: lazy page registry and bilingual route metadata.
- `src/components/routing/RouteView.tsx`: route metadata, Suspense and component rendering.
- `src/components/common/PageMeta.tsx`: title, description, canonical and Open Graph tags.
- `src/pages/NotFound.tsx`: in-shell branded 404 with requested path.
- `src/components/common/AppLoading.tsx`: lightweight route fallback.
- `tasks/check-bundle-size.mjs`: Vite manifest and gzip budget enforcement.
- `.env.example`, `.gitignore`: safe configuration contract.
- Tests cover missing configuration, lazy client creation, metadata, 404, errors and chunk boundaries.

### Task 1: Make backend configuration optional and lazy

**Files:**
- Create: `src/config/backend.ts`
- Create: `src/config/__tests__/backend.test.ts`
- Create: `src/components/ai/BackendUnavailable.tsx`
- Create: `src/components/ai/__tests__/BackendUnavailable.test.tsx`
- Modify: `src/pages/AIAssistantPage.tsx`
- Modify: `src/lib/sse.ts`
- Delete: `src/db/supabase.ts` after its eager client import has no callers

**Interfaces:**
- Produces: `readBackendConfig(env?: RuntimeEnv): BackendConfig | null`
- Produces: `getSupabaseClient(config?: BackendConfig | null): Promise<SupabaseClient | null>`
- Produces: `BackendUnavailable(): JSX.Element`

- [ ] **Step 1: Write missing/partial/valid configuration tests**

```ts
describe('readBackendConfig', () => {
  it.each([{}, { VITE_SUPABASE_URL: 'https://example.supabase.co' }, { VITE_SUPABASE_ANON_KEY: 'public-key' }])(
    'returns null for absent or partial config',
    (env) => expect(readBackendConfig(env)).toBeNull(),
  );

  it('returns trimmed valid config without logging values', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(readBackendConfig({
      VITE_SUPABASE_URL: ' https://example.supabase.co ',
      VITE_SUPABASE_ANON_KEY: ' public-key ',
    })).toEqual({ url: 'https://example.supabase.co', anonKey: 'public-key' });
    expect(warn).not.toHaveBeenCalled();
  });
});

test('lazy client returns null without importing or constructing Supabase', async () => {
  expect(await getSupabaseClient(null)).toBeNull();
});
```

```tsx
test('explains that AI is unavailable while preserving static navigation', () => {
  renderWithProviders(<BackendUnavailable />);
  expect(screen.getByRole('heading', { name: 'AI 服务尚未配置' })).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '浏览品种百科' })).toHaveAttribute('href', '/encyclopedia');
});
```

- [ ] **Step 2: Run focused tests and verify missing modules fail**

Run: `pnpm exec vitest run src/config/__tests__/backend.test.ts src/components/ai/__tests__/BackendUnavailable.test.tsx`  
Expected: FAIL because the config API and unavailable state do not exist.

- [ ] **Step 3: Implement validation and lazy client creation**

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
export interface RuntimeEnv { VITE_SUPABASE_URL?: string; VITE_SUPABASE_ANON_KEY?: string }
export interface BackendConfig { url: string; anonKey: string }
let clientPromise: Promise<SupabaseClient> | undefined;

export function readBackendConfig(env: RuntimeEnv = import.meta.env): BackendConfig | null {
  const url = env.VITE_SUPABASE_URL?.trim();
  const anonKey = env.VITE_SUPABASE_ANON_KEY?.trim();
  if (!url || !anonKey) return null;
  try { new URL(url); } catch { return null; }
  return { url, anonKey };
}

export function getSupabaseClient(config = readBackendConfig()): Promise<SupabaseClient | null> {
  if (!config) return Promise.resolve(null);
  clientPromise ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(config.url, config.anonKey),
  );
  return clientPromise;
}
```

At the top of `AIAssistantPage`, resolve `const backend = readBackendConfig()` and render `BackendUnavailable` before any AI handler is reachable. Each handler calls `await getSupabaseClient(backend)` and treats null as the same explicit unavailable state. Pass the validated URL/key into `sendStreamRequest`; remove file-scope casts of missing environment values and the eager `supabase` import.

- [ ] **Step 4: Run tests and prove static pages render with an empty environment**

Run: `pnpm exec vitest run src/config src/components/ai`  
Expected: PASS.  
Run: `pnpm typecheck`  
Expected: exit code 0.

- [ ] **Step 5: Commit optional backend support**

```bash
git add src/config src/components/ai src/pages/AIAssistantPage.tsx src/lib/sse.ts src/db/supabase.ts
git commit -m "fix: make backend configuration optional"
```

### Task 2: Add real route metadata and a non-redirecting 404

**Files:**
- Create: `src/components/routing/RouteView.tsx`
- Create: `src/components/routing/__tests__/routing.test.tsx`
- Modify: `src/routes.tsx`
- Modify: `src/App.tsx`
- Modify: `src/components/common/PageMeta.tsx`
- Modify: `src/pages/NotFound.tsx`
- Modify: `src/contexts/AppSettings.tsx`
- Modify: `index.html`

**Interfaces:**
- Produces: `RouteMeta { zh: MetaText; en: MetaText }` and route entries with `Component`
- Produces: `PageMeta({ title, description, canonicalPath, image? })`
- Guarantees: wildcard renders `NotFound`; metadata follows the active language

- [ ] **Step 1: Write route and head-tag behavior tests**

```tsx
test.each([
  ['/', '中国地方畜禽品种数字博物馆'],
  ['/map', '品种分布地图'],
  ['/dashboard', '畜禽品种数据看板'],
  ['/encyclopedia', '畜禽品种百科'],
  ['/compare', '品种对比'],
])('%s exposes route-specific metadata', async (path, title) => {
  renderAppAt(path);
  await waitFor(() => expect(document.title).toContain(title));
  expect(document.head.querySelector('meta[name="description"]')?.getAttribute('content')).not.toBe('');
});

test('unknown path stays put and renders a true 404', async () => {
  renderAppAt('/missing-breed-page');
  expect(await screen.findByRole('heading', { name: '页面未找到' })).toBeVisible();
  expect(screen.getByText('/missing-breed-page')).toBeVisible();
  expect(window.location.hash).toContain('/missing-breed-page');
});
```

- [ ] **Step 2: Run the routing test and verify redirect/metadata failures**

Run: `pnpm exec vitest run src/components/routing/__tests__/routing.test.tsx`  
Expected: FAIL because route pages have no metadata and wildcard navigation returns home.

- [ ] **Step 3: Implement route-owned metadata and the branded 404**

```ts
export interface MetaText { title: string; description: string }
export interface RouteConfig {
  nameKey: string; path: string; Component: LazyExoticComponent<ComponentType>;
  meta: { zh: MetaText; en: MetaText };
}
```

Give each of the six routes unique, factual copy. `RouteView` selects `route.meta[language]`, renders `PageMeta`, then the lazy component. Update `PageMeta` to emit title, description, canonical URL, `og:type`, `og:title`, `og:description`, `og:url` and optional `og:image`. Canonical URLs retain the hash route because the deployment remains a HashRouter site. Replace `<Navigate>` with `<Route path="*" element={<NotFound />} />`. Restyle NotFound with the new museum brand, show `useLocation().pathname`, and link to both home and encyclopedia.

Set a useful default in `index.html` for crawlers and no-JavaScript contexts:

```html
<title>中国地方畜禽品种数字博物馆</title>
<meta name="description" content="通过地图、百科与数据可视化探索中国地方畜禽遗传资源。" />
<meta name="theme-color" content="#173B2C" />
```

- [ ] **Step 4: Run routing tests and inspect head tags in production preview**

Run: `pnpm exec vitest run src/components/routing/__tests__/routing.test.tsx`  
Expected: PASS.  
Open `#/map` and `#/not-a-route`; confirm title/description/canonical change and the latter remains a 404.

- [ ] **Step 5: Commit routing and SEO metadata**

```bash
git add src/routes.tsx src/App.tsx src/components/routing src/components/common/PageMeta.tsx src/pages/NotFound.tsx src/contexts/AppSettings.tsx index.html
git commit -m "feat: add route metadata and real not-found page"
```

### Task 3: Split routes and defer heavy feature libraries

**Files:**
- Create: `src/components/common/AppLoading.tsx`
- Create: `src/components/common/__tests__/AppLoading.test.tsx`
- Create: `src/components/routing/__tests__/lazyRoutes.test.ts`
- Modify: `src/routes.tsx`
- Modify: `src/components/routing/RouteView.tsx`
- Modify: `src/pages/AIAssistantPage.tsx`
- Modify: `src/main.tsx`
- Modify: `src/lib/preload.ts`

**Interfaces:**
- Produces: one `lazy(() => import(...))` boundary per route
- Produces: `AppLoading` as the shared branded Suspense fallback
- Guarantees: `html2canvas`, `jspdf`, Supabase, Sentry and Recharts are absent from the home entry graph

- [ ] **Step 1: Add lazy-route and loading tests**

```tsx
test('shows the branded route fallback while a page chunk is pending', () => {
  render(<AppLoading />);
  expect(screen.getByRole('status', { name: '正在加载页面' })).toBeVisible();
});
```

Add a source contract test that reads `routes.tsx` and asserts all six pages use `lazy(() => import(`, and reads `AIAssistantPage.tsx` to assert it contains `import('html2canvas')` and `import('jspdf')` but no static imports for those packages.

```ts
const routesSource = readFileSync(new URL('../../../routes.tsx', import.meta.url), 'utf8');
const aiSource = readFileSync(new URL('../../../pages/AIAssistantPage.tsx', import.meta.url), 'utf8');
expect(routesSource.match(/lazy\(\(\) => import\(/g)).toHaveLength(6);
expect(aiSource).toContain("import('html2canvas')");
expect(aiSource).toContain("import('jspdf')");
expect(aiSource).not.toMatch(/^import .+ from ['"](?:html2canvas|jspdf)['"]/m);
```

- [ ] **Step 2: Run loading/source tests and verify eager imports fail**

Run: `pnpm exec vitest run src/components/common/__tests__/AppLoading.test.tsx src/components/routing/__tests__/lazyRoutes.test.ts`  
Expected: FAIL because routes and PDF libraries are eager.

- [ ] **Step 3: Implement route and feature-level dynamic imports**

```ts
const HomePage = lazy(() => import('./pages/HomePage'));
const MapPage = lazy(() => import('./pages/MapPage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const EncyclopediaPage = lazy(() => import('./pages/EncyclopediaPage'));
const AIAssistantPage = lazy(() => import('./pages/AIAssistantPage'));
const ComparePage = lazy(() => import('./pages/ComparePage'));
```

Wrap only the active `RouteView` in `<Suspense fallback={<AppLoading />}>`. In PDF export, load dependencies inside the action:

```ts
const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
  import('html2canvas'),
  import('jspdf'),
]);
```

Initialize monitoring only when a DSN exists and use `void import('@sentry/react').then(({ init }) => init(...))`; the local `ErrorBoundary` remains the render safety net. Update idle preloading to prefetch only likely next routes after the home shell is interactive, never every route on startup.

- [ ] **Step 4: Run tests, build, and inspect emitted chunks**

Run: `pnpm test`  
Expected: PASS.  
Run: `pnpm build`  
Expected: separate chunks visibly named or attributable to AI, dashboard/Recharts, html2canvas and jsPDF; no oversized single entry bundle.

- [ ] **Step 5: Commit code splitting**

```bash
git add src/routes.tsx src/components/common/AppLoading.tsx src/components/common/__tests__/AppLoading.test.tsx src/components/routing src/pages/AIAssistantPage.tsx src/main.tsx src/lib/preload.ts
git commit -m "perf: lazy-load routes and heavy feature code"
```

### Task 4: Secure environment handling and modernize Vite configuration

**Files:**
- Create: `.env.example`
- Create: `tasks/check-bundle-size.mjs`
- Create: `tasks/__tests__/check-bundle-size.test.mjs`
- Modify: `.gitignore`
- Modify: `vite.config.ts`
- Modify: `package.json`
- Stop tracking: `.env.production` while retaining the local file

**Interfaces:**
- Produces: `bundle:check` script that reads `dist/.vite/manifest.json`
- Produces: production entry budgets of 650 KiB raw and 220 KiB gzip
- Produces: safe variable names in `.env.example` with no values

- [ ] **Step 1: Write bundle-budget parser tests**

```ts
test('fails an entry that exceeds either budget', () => {
  const result = evaluateEntry({ rawBytes: 700 * 1024, gzipBytes: 200 * 1024 });
  expect(result.ok).toBe(false);
  expect(result.reasons).toContain('raw entry exceeds 650 KiB');
});

test('accepts an entry below both budgets', () => {
  expect(evaluateEntry({ rawBytes: 500 * 1024, gzipBytes: 180 * 1024 })).toEqual({ ok: true, reasons: [] });
});
```

- [ ] **Step 2: Run the budget test and verify the checker is missing**

Run: `pnpm exec vitest run tasks/__tests__/check-bundle-size.test.mjs`  
Expected: FAIL because the bundle checker does not exist.

- [ ] **Step 3: Implement safe config and deterministic build budgets**

In Vite, replace `path.resolve(__dirname, './src')` with `fileURLToPath(new URL('./src', import.meta.url))`, keep `base: './'`, and set `build.manifest = true`. `check-bundle-size.mjs` reads the manifest entry, reads its JavaScript file, computes `gzipSync(content).byteLength`, prints only file names/sizes and exits nonzero above the exact budgets.

`.env.example` contains only:

```dotenv
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_SENTRY_DSN=
```

Change `.gitignore` to ignore `.env`, `.env.*` and permit only `!.env.example`. Run `git rm --cached -- .env.production` so the user’s local file remains on disk but leaves the index; never display its contents. Add `bundle:check` and run it after `build` in the aggregate `check` script.

- [ ] **Step 4: Run configuration, build and budget verification**

Run: `pnpm exec vitest run tasks/__tests__/check-bundle-size.test.mjs`  
Expected: PASS.  
Run: `pnpm build`  
Expected: no `__dirname` warning.  
Run: `pnpm bundle:check`  
Expected: PASS below 650 KiB raw and 220 KiB gzip for the entry.  
Run: `git status --short -- .env.production .env.example`  
Expected: `.env.production` appears as removed from version control and `.env.example` as added, while `Test-Path .env.production` remains `True`.

- [ ] **Step 5: Commit safe build configuration**

```bash
git add .gitignore .env.example vite.config.ts package.json tasks/check-bundle-size.mjs tasks/__tests__/check-bundle-size.test.mjs
git commit -m "build: secure env handling and enforce bundle budgets"
```

### Task 5: Harden error, offline and failure recovery states

**Files:**
- Create: `src/components/common/__tests__/ErrorBoundary.test.tsx`
- Create: `src/components/common/__tests__/OfflineBanner.test.tsx`
- Modify: `src/components/common/ErrorBoundary.tsx`
- Modify: `src/App.tsx`
- Modify: `src/hooks/useNetworkStatus.ts`
- Modify: `src/contexts/AppSettings.tsx`

**Interfaces:**
- Guarantees: render failures show retry/home actions without a stack; offline notice is non-blocking and announced once; development diagnostics do not leak into production UI

- [ ] **Step 1: Write visible recovery behavior tests**

```tsx
function Throw({ message }: { message: string }): never {
  throw new Error(message);
}

test('error boundary shows safe recovery actions without exception text', () => {
  renderWithProviders(<ErrorBoundary><Throw message="private stack marker" /></ErrorBoundary>);
  expect(screen.getByRole('heading', { name: '页面暂时无法显示' })).toBeVisible();
  expect(screen.getByRole('button', { name: '重新加载' })).toBeVisible();
  expect(screen.getByRole('link', { name: '返回首页' })).toBeVisible();
  expect(screen.queryByText(/private stack marker/)).not.toBeInTheDocument();
});

test('offline state is a status and does not replace page content', () => {
  Object.defineProperty(window.navigator, 'onLine', { configurable: true, value: false });
  renderAppAt('/encyclopedia');
  expect(screen.getByRole('status', { name: '当前处于离线状态' })).toBeVisible();
  expect(screen.getByRole('heading', { name: '品种百科' })).toBeVisible();
});
```

- [ ] **Step 2: Run recovery tests and verify missing semantics/actions**

Run: `pnpm exec vitest run src/components/common/__tests__/ErrorBoundary.test.tsx src/components/common/__tests__/OfflineBanner.test.tsx`  
Expected: FAIL until recovery links and named status behavior are added.

- [ ] **Step 3: Implement branded recoverable states**

Use the SVG mark, concise user-facing copy, reload and home actions. Log full render errors only in development; in production rely on optional monitoring without including environment secrets or request authorization data. Give OfflineBanner `role="status"`, `aria-live="polite"`, safe-area-aware positioning and enough top spacing that it does not cover header controls. Ensure repeated online/offline events clean up listeners.

- [ ] **Step 4: Run all checks for this plan**

Run: `pnpm typecheck`  
Expected: PASS.  
Run: `pnpm lint`  
Expected: PASS.  
Run: `pnpm test`  
Expected: PASS.  
Run: `pnpm build`  
Expected: PASS with separate async chunks.  
Run: `pnpm bundle:check`  
Expected: PASS with an in-budget entry.

- [ ] **Step 5: Commit resilient global states**

```bash
git add src/components/common src/App.tsx src/hooks/useNetworkStatus.ts src/contexts/AppSettings.tsx
git commit -m "fix: harden global recovery and offline states"
```
