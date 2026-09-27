# Brand, Mobile and Accessibility Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace temporary and legacy branding with a coherent SVG identity, make failed imagery graceful, and deliver a polished keyboard- and mobile-friendly museum experience without discarding the existing Chinese visual character.

**Architecture:** Treat the SVG set and responsive shell as reusable primitives: `BrandLogo` owns identity rendering, `BreedImage` owns all remote-image failure behavior, and `MobileNavigation` owns narrow-screen navigation. Page-specific changes then focus on semantic headings, touch sizing, chart alternatives and responsive composition.

**Tech Stack:** React 18, TypeScript, Tailwind CSS 3, Radix UI, Lucide, Testing Library, handcrafted SVG

## Global Constraints

- Preserve the “墨绿＋宣纸＋金色” visual system and refine it rather than replacing it.
- The SVG concept is “馆藏印章＋屋檐＋双角/叶脉”.
- Deliver four original assets: square mark, horizontal wordmark, favicon and missing-image illustration.
- SVG files must not embed scripts, remote fonts, remote raster images or untrusted markup.
- Gold is an accent, not small body text on light backgrounds; text and controls must meet WCAG AA contrast.
- Primary touch targets are at least 44×44 CSS pixels.
- The 390px viewport must have no page-level horizontal overflow.
- Decorative SVGs use empty alt text; standalone brand assets receive an accessible name or `<title>`.
- No raster image generation is part of this plan; the requested assets are authored as SVG and inspected in the running product.
- Follow TDD and commit each task only after focused tests pass.

---

## File Map

- `public/brand/*.svg`: original museum mark, wordmark, favicon and breed-image fallback.
- `src/components/brand/BrandLogo.tsx`: accessible responsive brand renderer.
- `src/components/common/BreedImage.tsx`: stable image frame with one-way SVG fallback.
- `src/components/layouts/MobileNavigation.tsx`: narrow-screen menu, search and utility actions.
- `src/components/layouts/Layout.tsx`: desktop shell, skip link, landmarks, footer and mobile integration.
- `src/components/common/AccessibleChartSummary.tsx`: semantic data-table alternative for charts.
- `src/index.css`: design tokens, focus treatment and reduced-motion override.
- Page/component tests: visible behavior, keyboard access, fallback and semantic heading contracts.

### Task 1: Create and integrate the complete SVG brand set

**Files:**
- Create: `public/brand/museum-mark.svg`
- Create: `public/brand/museum-wordmark.svg`
- Create: `public/brand/favicon.svg`
- Create: `public/brand/breed-placeholder.svg`
- Create: `src/components/brand/BrandLogo.tsx`
- Create: `src/components/brand/__tests__/BrandLogo.test.tsx`
- Create: `src/components/brand/__tests__/brandAssets.test.ts`
- Modify: `src/components/layouts/Layout.tsx`
- Modify: `index.html`

**Interfaces:**
- Produces: `BrandLogo({ compact?: boolean; className?: string }): JSX.Element`
- Produces: public URLs `/brand/museum-mark.svg`, `/brand/museum-wordmark.svg`, `/brand/favicon.svg`, `/brand/breed-placeholder.svg`

- [ ] **Step 1: Write asset-safety and accessible-logo tests**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const files = ['museum-mark.svg', 'museum-wordmark.svg', 'favicon.svg', 'breed-placeholder.svg'];
describe.each(files)('%s', (name) => {
  const svg = readFileSync(new URL(`../../../../public/brand/${name}`, import.meta.url), 'utf8');
  it('is a self-contained titled SVG', () => {
    expect(svg).toMatch(/^<svg[^>]+viewBox=/);
    expect(svg).toMatch(/<title>/);
    expect(svg).not.toMatch(/<script|javascript:|<foreignObject|https?:\/\//i);
  });
});
```

```tsx
test('renders the compact mark with an accessible museum name', () => {
  render(<BrandLogo compact />);
  expect(screen.getByRole('img', { name: '中国地方畜禽品种数字博物馆' })).toHaveAttribute(
    'src', '/brand/museum-mark.svg',
  );
});
```

- [ ] **Step 2: Run tests and verify all four assets and the component are missing**

Run: `pnpm exec vitest run src/components/brand`  
Expected: FAIL on missing SVG files and `BrandLogo`.

- [ ] **Step 3: Draw the four production SVGs and implement `BrandLogo`**

Use one shared geometry language:

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" role="img">
  <title>中国地方畜禽品种数字博物馆馆藏印章标志</title>
  <rect x="4" y="4" width="56" height="56" rx="13" fill="#173B2C"/>
  <path d="M14 25 32 13l18 12-4 5-14-9-14 9-4-5Z" fill="#F4EFE3"/>
  <path d="M18 31c7 0 10 4 14 10 4-6 7-10 14-10-2 9-7 15-14 20-7-5-12-11-14-20Z" fill="none" stroke="#C79A45" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M32 40v12" stroke="#F4EFE3" stroke-width="3" stroke-linecap="round"/>
</svg>
```

Refine this base geometry for optical balance at 16px, use fewer details in `favicon.svg`, add a restrained seal border and live Chinese museum name in `museum-wordmark.svg`, and use a wider paper-colored scene plus “图像待补” in `breed-placeholder.svg`. Implement the renderer as:

```tsx
interface BrandLogoProps { compact?: boolean; className?: string }
export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <img
      src={compact ? '/brand/museum-mark.svg' : '/brand/museum-wordmark.svg'}
      alt="中国地方畜禽品种数字博物馆"
      className={cn(compact ? 'h-9 w-9' : 'h-9 w-auto', className)}
      width={compact ? 36 : 252}
      height={36}
    />
  );
}
```

Replace the temporary single-character circle in `Layout` and point `index.html` to `/brand/favicon.svg` with `type="image/svg+xml"`. Ensure old `public/images/logo` assets have no runtime references.

- [ ] **Step 4: Run brand tests, production build and browser inspection**

Run: `pnpm exec vitest run src/components/brand`  
Expected: all brand tests PASS.  
Run: `pnpm build`  
Expected: exit code 0 and favicon/brand URLs emitted.  
Inspect at 1440px, 390px and browser-tab size: roof, horn/leaf and seal remain distinguishable; wordmark is not clipped.

- [ ] **Step 5: Commit the SVG identity**

```bash
git add public/brand src/components/brand src/components/layouts/Layout.tsx index.html
git commit -m "feat: introduce museum svg brand system"
```

### Task 2: Replace image hiding with a reusable, stable SVG fallback

**Files:**
- Create: `src/components/common/BreedImage.tsx`
- Create: `src/components/common/__tests__/BreedImage.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/EncyclopediaPage.tsx`
- Modify: `src/pages/ComparePage.tsx`
- Modify: `src/components/BreedDetail.tsx`

**Interfaces:**
- Produces: `BreedImage({ src, alt, className, imgClassName, eager?, sizes? }): JSX.Element`
- Guarantees: one transition from the requested source to `/brand/breed-placeholder.svg`; stable aspect ratio; no error loop

- [ ] **Step 1: Write failure, sizing and loop-prevention tests**

```tsx
test('keeps its frame and swaps a failed remote image to the SVG fallback', () => {
  render(<BreedImage src="https://example.invalid/breed.jpg" alt="独龙牛" className="aspect-[4/3]" />);
  const image = screen.getByRole('img', { name: '独龙牛' });
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/brand/breed-placeholder.svg');
  expect(image.parentElement).toHaveClass('aspect-[4/3]');
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/brand/breed-placeholder.svg');
});

test('only eager-loads explicitly prioritised imagery', () => {
  const { rerender } = render(<BreedImage src="/one.jpg" alt="one" />);
  expect(screen.getByRole('img')).toHaveAttribute('loading', 'lazy');
  rerender(<BreedImage src="/two.jpg" alt="two" eager />);
  expect(screen.getByRole('img')).toHaveAttribute('loading', 'eager');
});
```

- [ ] **Step 2: Verify the component test fails before implementation**

Run: `pnpm exec vitest run src/components/common/__tests__/BreedImage.test.tsx`  
Expected: FAIL because `BreedImage` is missing.

- [ ] **Step 3: Implement a one-way fallback and replace all breed `<img>` usages**

```tsx
const FALLBACK = '/brand/breed-placeholder.svg';
interface BreedImageProps {
  src?: string; alt: string; className?: string; imgClassName?: string;
  eager?: boolean; sizes?: string;
}
export function BreedImage({ src, alt, className, imgClassName, eager = false, sizes }: BreedImageProps) {
  const [currentSrc, setCurrentSrc] = useState(src || FALLBACK);
  useEffect(() => setCurrentSrc(src || FALLBACK), [src]);
  return (
    <div className={cn('overflow-hidden bg-muted', className)} data-fallback={currentSrc === FALLBACK || undefined}>
      <img
        src={currentSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes}
        className={cn('h-full w-full object-cover', imgClassName)}
        onError={() => setCurrentSrc(FALLBACK)}
      />
    </div>
  );
}
```

Use it in homepage cards, encyclopedia cards, comparison headers and breed details. Preserve each existing aspect ratio and remove every handler that sets `display: none`.

- [ ] **Step 4: Run focused tests and search for obsolete failure handlers**

Run: `pnpm exec vitest run src/components/common/__tests__/BreedImage.test.tsx`  
Expected: PASS.  
Run: `rg -n "style\.display = 'none'|onError=" src/pages src/components`  
Expected: no breed-image hiding handlers; unrelated upload previews may remain.

- [ ] **Step 5: Commit image resilience**

```bash
git add src/components/common/BreedImage.tsx src/components/common/__tests__/BreedImage.test.tsx src/pages/HomePage.tsx src/pages/EncyclopediaPage.tsx src/pages/ComparePage.tsx src/components/BreedDetail.tsx
git commit -m "fix: preserve breed imagery with svg fallback"
```

### Task 3: Rebuild the mobile shell and keyboard navigation

**Files:**
- Create: `src/components/layouts/MobileNavigation.tsx`
- Create: `src/components/layouts/__tests__/Layout.test.tsx`
- Modify: `src/components/layouts/Layout.tsx`
- Modify: `src/contexts/AppSettings.tsx`
- Modify: `src/index.css`

**Interfaces:**
- Produces: `MobileNavigation({ items, searchValue, onSearchChange, onSearchSubmit }): JSX.Element`
- Guarantees: all six destinations are reachable at 390px, mobile search is explicit, utilities have accessible names, skip link targets `#main-content`

- [ ] **Step 1: Write keyboard and narrow-shell behavior tests**

```tsx
test('offers a skip link and named utility controls', async () => {
  renderLayout('/map');
  expect(screen.getByRole('link', { name: '跳到主要内容' })).toHaveAttribute('href', '#main-content');
  expect(screen.getByRole('main')).toHaveAttribute('id', 'main-content');
  expect(screen.getByRole('button', { name: '打开导航菜单' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /切换主题/ })).toHaveClass('min-h-11', 'min-w-11');
});

test('mobile menu exposes every destination and search', async () => {
  renderLayout('/');
  await userEvent.click(screen.getByRole('button', { name: '打开导航菜单' }));
  for (const name of ['首页', '品种地图', '数据看板', '品种百科', 'AI助手', '品种对比']) {
    expect(screen.getByRole('link', { name })).toBeVisible();
  }
  expect(screen.getByRole('searchbox', { name: '搜索品种' })).toBeVisible();
});
```

- [ ] **Step 2: Run the layout test and verify current mobile navigation fails the contract**

Run: `pnpm exec vitest run src/components/layouts/__tests__/Layout.test.tsx`  
Expected: FAIL because the skip link, named menu and unified mobile menu are absent.

- [ ] **Step 3: Implement the responsive shell**

- Desktop (`md` and wider): wordmark, six primary links, compact search and two named utility menus.
- Mobile: compact mark, page label, one 44px search button and one 44px menu button. The menu sheet contains all six links, full-width search, category entry, language and theme sections. Remove the horizontally scrolling second nav row.
- Category filtering remains a desktop aside and a mobile sheet reached from map/encyclopedia with a button that includes the current result count.
- Put a visually hidden-until-focused skip link before the header and add `id="main-content" tabIndex={-1}` to `<main>`.
- Add `aria-current="page"`, explicit labels for icon buttons and focus-visible rings that contrast on both green and paper backgrounds.

```tsx
<a className="skip-link" href="#main-content">{t('a11y.skipToContent')}</a>
<header>...</header>
<main id="main-content" tabIndex={-1} className="min-h-0 min-w-0 flex-1 overflow-y-auto outline-none">
  {children}
</main>
```

- [ ] **Step 4: Run layout tests and inspect 320px, 390px and 768px widths**

Run: `pnpm exec vitest run src/components/layouts/__tests__/Layout.test.tsx`  
Expected: PASS.  
At each width, tab through the shell; focus never disappears, every destination is reachable, and `document.documentElement.scrollWidth === document.documentElement.clientWidth`.

- [ ] **Step 5: Commit the responsive navigation shell**

```bash
git add src/components/layouts src/contexts/AppSettings.tsx src/index.css
git commit -m "feat: rebuild accessible mobile navigation"
```

### Task 4: Correct page semantics, touch sizes and chart alternatives

**Files:**
- Create: `src/components/common/AccessibleChartSummary.tsx`
- Create: `src/components/common/__tests__/AccessibleChartSummary.test.tsx`
- Create: `src/pages/__tests__/pageSemantics.test.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/EncyclopediaPage.tsx`
- Modify: `src/pages/ComparePage.tsx`
- Modify: `src/components/BreedDetail.tsx`
- Modify: `src/components/ChinaMap.tsx`
- Modify: `src/contexts/AppSettings.tsx`

**Interfaces:**
- Produces: `AccessibleChartSummary({ caption, columns, rows }): JSX.Element`
- Guarantees: exactly one H1 per main route, chart data has a semantic table representation, control hit areas meet 44px

- [ ] **Step 1: Write semantic-summary tests**

```tsx
test('renders chart data as a captioned table available to assistive technology', () => {
  render(<AccessibleChartSummary caption="各类别品种数量" columns={['类别', '数量']} rows={[["猪", 120], ["牛", 98]]} />);
  expect(screen.getByRole('table', { name: '各类别品种数量' })).toBeInTheDocument();
  expect(screen.getByRole('cell', { name: '120' })).toBeInTheDocument();
});
```

Add route-level tests asserting one H1 for map, dashboard, encyclopedia and both empty/non-empty comparison states.

- [ ] **Step 2: Run semantic tests and verify map/comparison failures**

Run: `pnpm exec vitest run src/components/common/__tests__/AccessibleChartSummary.test.tsx src/pages/__tests__/pageSemantics.test.tsx`  
Expected: FAIL because the summary component is absent, Map uses H2, and empty Compare uses H2.

- [ ] **Step 3: Implement semantic and responsive page corrections**

- Promote each route title to the sole H1; keep card and section titles in order.
- Add `AccessibleChartSummary` below each dashboard visualization using the same memoized rows already passed to Recharts; use an expandable “查看表格数据” control visually and keep the table available in the accessibility tree.
- Add visible labels or `aria-label` to export, remove, close, random and map controls; change 28px icon buttons to at least 44px.
- Give status and endangered badges text in addition to color.
- On the comparison table, use `scope` on headers, keep breed-name headers sticky on narrow screens, and provide a text table for radar values.
- On mobile map, present details in a bottom drawer with its own scroll area and visible close control; preserve the map canvas behind it.
- Expose result counts and empty-state reset actions for map and encyclopedia filters.

- [ ] **Step 4: Run semantic, data and component tests**

Run: `pnpm test`  
Expected: all tests PASS with no duplicate-key console errors.  
Run: `pnpm typecheck`  
Expected: exit code 0.

- [ ] **Step 5: Commit page accessibility**

```bash
git add src/components/common src/components/ChinaMap.tsx src/components/BreedDetail.tsx src/pages src/contexts/AppSettings.tsx
git commit -m "feat: improve page semantics and chart accessibility"
```

### Task 5: Finish visual tokens and reduced-motion behavior

**Files:**
- Create: `src/components/effects/__tests__/motionPreference.test.tsx`
- Modify: `src/index.css`
- Modify: `tailwind.config.js`
- Modify: `src/components/effects/*.tsx`
- Modify: `src/pages/HomePage.tsx`
- Modify: `src/pages/DashboardPage.tsx`
- Modify: `src/pages/ComparePage.tsx`

**Interfaces:**
- Produces: shared paper/ink/gold semantic tokens and a global reduced-motion guarantee

- [ ] **Step 1: Add a failing reduced-motion test and CSS contract**

```ts
test('global CSS disables nonessential motion when requested', () => {
  const css = readFileSync(new URL('../../../index.css', import.meta.url), 'utf8');
  expect(css).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)/);
  expect(css).toMatch(/animation-duration:\s*0\.01ms/);
  expect(css).toMatch(/scroll-behavior:\s*auto/);
});
```

- [ ] **Step 2: Run the preference test and verify it fails**

Run: `pnpm exec vitest run src/components/effects/__tests__/motionPreference.test.tsx`  
Expected: FAIL until the media query exists.

- [ ] **Step 3: Consolidate the visual language and honor user motion preference**

Define semantic CSS variables for museum ink, paper, muted paper, gold, cinnabar, borders and focus. Replace page-local near-duplicate hex values where they represent the same token. Use one restrained shadow scale, consistent 8/12/16px radii and an editorial spacing rhythm. Add:

```css
@media (prefers-reduced-motion: reduce) {
  html { scroll-behavior: auto; }
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

Disable or simplify motion-library entrance effects when `useReducedMotion()` is true. Preserve state feedback without parallax, continuous particle movement or large positional transitions.

- [ ] **Step 4: Run tests and perform light/dark visual review**

Run: `pnpm test`  
Expected: PASS.  
Review home, map detail, dashboard, encyclopedia card and comparison at 1440px and 390px in light and dark modes. Confirm text contrast, focus visibility, stable image frames and no clipped controls.

- [ ] **Step 5: Commit visual refinement**

```bash
git add src/index.css tailwind.config.js src/components/effects src/pages
git commit -m "style: refine museum theme and reduced motion"
```
