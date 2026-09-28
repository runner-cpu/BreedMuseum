# Data Foundation and Breed Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an auditable, source-aware breed dataset, remove identity collisions, normalize official names and add the 23 verified livestock records missing from the current collection.

**Architecture:** Keep the existing `Breed[]` modules as the display dataset, add a source catalog and metadata resolver beside them, and make all lookup/search code consume one canonical search API. A pure audit function validates fixtures and the complete runtime array; Vitest turns every future data regression into a failing build.

**Tech Stack:** TypeScript 5.9, React 18, Vitest 4, Testing Library, existing Vite aliasing

## Global Constraints

- Use the Ministry of Agriculture and Rural Affairs 2025 Announcement No. 940 as the national protection-list baseline: <https://www.moa.gov.cn/govpublic/nybzzj1/202510/t20251029_6478525.htm>.
- The announcement contains 271 livestock and poultry breeds, 12 bee breeds and 15 silkworm breeds; bees and silkworms are out of scope for this implementation.
- Do not add a record merely to increase the total; every new record needs a traceable source and a 2026-09-27 verification date.
- Distinguish “collected by this site” from “listed in the national protection list”; never label every site record as nationally protected.
- Preserve verified legacy five-axis values as editorial normalized scores, not official measurements; new name-only records use five null values until a traceable metric source exists.
- New records without a verified reusable photograph use `/brand/breed-placeholder.svg`; do not invent a photo source or rights claim.
- Follow TDD for every behavior change and commit each task only after its focused tests pass.

---

## File Map

- `vitest.config.ts`: Vitest environment, alias and setup configuration.
- `src/test/setup.ts`: DOM matchers and automatic Testing Library cleanup.
- `src/test/render.tsx`: shared router/settings/museum test renderers.
- `src/data/breedAudit.ts`: pure data validation and issue formatting.
- `src/data/breedSources.ts`: normalized source catalog.
- `src/data/nationalProtectionList.ts`: the 271 official livestock/poultry names only.
- `src/data/breedMetadata.ts`: aliases, canonical official names, protection status, legacy IDs and source resolution.
- `src/data/breedSearch.ts`: canonical ID lookup and multilingual/alias search.
- `src/data/extraBreeds15.ts`: this release’s verified additions.
- `src/data/__tests__/*.test.ts`: audit, metadata, identity, coverage and search contracts.
- `src/data/breeds.ts`: `Breed` type additions, normalized records and aggregation of `extraBreeds15`.
- `src/data/extraBreeds*.ts`: removal or renaming of the 11 current ID collisions.
- `src/contexts/MuseumContext.tsx`, `src/pages/MapPage.tsx`, `src/pages/EncyclopediaPage.tsx`, `src/components/BreedDetail.tsx`: consumers of the canonical lookup/search/metadata API.

### Task 1: Install the reusable Vitest and data-audit foundation

**Files:**
- Create: `vitest.config.ts`
- Create: `src/test/setup.ts`
- Create: `src/test/render.tsx`
- Create: `src/data/breedAudit.ts`
- Create: `src/data/__tests__/breedAudit.test.ts`
- Modify: `package.json`

**Interfaces:**
- Produces: `auditBreedDataset(items: readonly Breed[], options?: AuditOptions): AuditIssue[]`
- Produces: `AuditOptions.resolveMetadata?: (breed: Breed) => AuditableMetadata`
- Produces: `renderWithProviders(ui, { route? })`, `renderAppAt(path)` and `renderLayout(path)` test helpers
- Produces: scripts `typecheck`, `lint`, `test`, `test:watch`, `data:audit`, `check`

- [ ] **Step 1: Write fixture-level failing audit tests**

```ts
import { describe, expect, it } from 'vitest';
import type { Breed } from '@/data/breeds';
import { auditBreedDataset } from '@/data/breedAudit';

const valid: Breed = {
  id: 'test-cattle', name: '测试牛', englishName: 'Test Cattle', province: '云南',
  longitude: 102.7, latitude: 25.0, category: '牛', endangered: '普通',
  appearance: '体型匀称。', performance: '适应性良好。',
  radar: { meat: 60, milk: 40, reproduction: 55, labor: 70, adaptability: 80 },
  story: '用于数据校验测试。', image: '/brand/breed-placeholder.svg',
};

describe('auditBreedDataset', () => {
  it('reports duplicate ids and names', () => {
    const issues = auditBreedDataset([valid, { ...valid }]);
    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-id', 'duplicate-name']),
    );
  });

  it('reports invalid coordinates, enums, radar values and missing text', () => {
    const issues = auditBreedDataset([{
      ...valid, id: '', province: '', longitude: 181, latitude: -91,
      category: '未知', endangered: '未知', radar: { ...valid.radar, meat: 101 },
    } as Breed]);
    expect(new Set(issues.map((issue) => issue.code))).toEqual(new Set([
      'missing-field', 'invalid-coordinate', 'invalid-category',
      'invalid-endangered-level', 'invalid-radar',
    ]));
  });
});
```

- [ ] **Step 2: Run the focused test and verify the missing-module failure**

Run: `pnpm exec vitest run src/data/__tests__/breedAudit.test.ts`  
Expected: FAIL because `@/data/breedAudit` does not exist.

- [ ] **Step 3: Add the Vitest configuration and audit implementation**

```ts
// vitest.config.ts
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  test: { environment: 'jsdom', setupFiles: ['./src/test/setup.ts'], restoreMocks: true },
});
```

```ts
// src/data/breedAudit.ts
import { categories, endangeredLevels, type Breed } from './breeds';

export type AuditCode =
  | 'duplicate-id' | 'duplicate-name' | 'missing-field' | 'invalid-coordinate'
  | 'invalid-category' | 'invalid-endangered-level' | 'invalid-radar'
  | 'missing-source' | 'ambiguous-alias';
export interface AuditIssue { code: AuditCode; breedId?: string; message: string }
export interface AuditableMetadata { aliases: readonly string[]; sourceIds: readonly string[] }
export interface AuditOptions { resolveMetadata?: (breed: Breed) => AuditableMetadata }

export function auditBreedDataset(items: readonly Breed[], options: AuditOptions = {}): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const ids = new Map<string, string>();
  const names = new Map<string, string>();
  const aliases = new Map<string, string>();
  const dimensions = ['meat', 'milk', 'reproduction', 'labor', 'adaptability'] as const;
  for (const breed of items) {
    for (const key of ['id', 'name', 'englishName', 'province', 'appearance', 'performance', 'story', 'image'] as const) {
      if (!String(breed[key] ?? '').trim()) issues.push({ code: 'missing-field', breedId: breed.id, message: `${key} is empty` });
    }
    if (ids.has(breed.id)) issues.push({ code: 'duplicate-id', breedId: breed.id, message: `${breed.id}: ${ids.get(breed.id)} / ${breed.name}` });
    else ids.set(breed.id, breed.name);
    if (names.has(breed.name)) issues.push({ code: 'duplicate-name', breedId: breed.id, message: `${breed.name}: ${names.get(breed.name)} / ${breed.id}` });
    else names.set(breed.name, breed.id);
    if (!Number.isFinite(breed.longitude) || breed.longitude < -180 || breed.longitude > 180 || !Number.isFinite(breed.latitude) || breed.latitude < -90 || breed.latitude > 90) {
      issues.push({ code: 'invalid-coordinate', breedId: breed.id, message: `${breed.longitude},${breed.latitude}` });
    }
    if (!(categories as readonly string[]).includes(breed.category)) issues.push({ code: 'invalid-category', breedId: breed.id, message: breed.category });
    if (!(endangeredLevels as readonly string[]).includes(breed.endangered)) issues.push({ code: 'invalid-endangered-level', breedId: breed.id, message: breed.endangered });
    if (dimensions.some((key) => !Number.isFinite(breed.radar[key]) || breed.radar[key] < 0 || breed.radar[key] > 100)) {
      issues.push({ code: 'invalid-radar', breedId: breed.id, message: JSON.stringify(breed.radar) });
    }
    const metadata = options.resolveMetadata?.(breed);
    if (options.resolveMetadata && (!metadata || metadata.sourceIds.length === 0)) issues.push({ code: 'missing-source', breedId: breed.id, message: breed.name });
    for (const alias of metadata?.aliases ?? []) {
      const owner = aliases.get(alias) ?? names.get(alias);
      if (owner && owner !== breed.id) issues.push({ code: 'ambiguous-alias', breedId: breed.id, message: `${alias}: ${owner}` });
      else aliases.set(alias, breed.id);
    }
  }
  return issues;
}
```

`src/test/setup.ts` imports `@testing-library/jest-dom/vitest` and calls `cleanup` in `afterEach`. Replace the current compound `lint` script with explicit cross-platform scripts; set `data:audit` to run the complete-dataset test added in Task 3.

Create the shared render helpers with concrete providers so later plans use the same test harness:

```tsx
import type { ReactElement } from 'react';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import App from '@/App';
import { AppWrapper } from '@/components/common/PageMeta';
import Layout from '@/components/layouts/Layout';
import { MuseumProvider } from '@/contexts/MuseumContext';
import { SettingsProvider } from '@/contexts/AppSettings';

export function renderWithProviders(ui: ReactElement, { route = '/' } = {}) {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <SettingsProvider><MuseumProvider>{ui}</MuseumProvider></SettingsProvider>
    </MemoryRouter>,
  );
}
export function renderAppAt(path: string) {
  window.location.hash = `#${path}`;
  return render(<AppWrapper><App /></AppWrapper>);
}
export function renderLayout(path = '/') {
  return renderWithProviders(
    <Layout selectedCategory={null} onSelectCategory={() => undefined} searchValue="" onSearchChange={() => undefined}>
      <h1>测试页面</h1>
    </Layout>,
    { route: path },
  );
}
```

- [ ] **Step 4: Run the fixture tests and static checks**

Run: `pnpm exec vitest run src/data/__tests__/breedAudit.test.ts`  
Expected: 2 tests PASS.  
Run: `pnpm typecheck`  
Expected: exit code 0.

- [ ] **Step 5: Commit the test foundation**

```bash
git add package.json vitest.config.ts src/test/setup.ts src/test/render.tsx src/data/breedAudit.ts src/data/__tests__/breedAudit.test.ts
git commit -m "test: add breed data audit foundation"
```

### Task 2: Add official-list and provenance metadata

**Files:**
- Create: `src/data/breedSources.ts`
- Create: `src/data/nationalProtectionList.ts`
- Create: `src/data/breedMetadata.ts`
- Create: `src/data/__tests__/breedMetadata.test.ts`
- Modify: `src/data/breeds.ts`

**Interfaces:**
- Produces: `BreedMetadata`, `BreedSource`, `ProtectionStatus`
- Produces: `getBreedMetadata(breed: Breed): BreedMetadata`
- Produces: `getBreedSource(sourceId: string): BreedSource | undefined`
- Produces: `NATIONAL_PROTECTED_BREED_NAMES: readonly string[]` with exactly 271 names

- [ ] **Step 1: Write source and official-list contract tests**

```ts
import { describe, expect, it } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata, getBreedSource } from '@/data/breedMetadata';
import { NATIONAL_PROTECTED_BREED_NAMES } from '@/data/nationalProtectionList';

describe('official protection metadata', () => {
  it('contains exactly the 271 livestock and poultry names from Announcement 940', () => {
    expect(new Set(NATIONAL_PROTECTED_BREED_NAMES).size).toBe(271);
    expect(NATIONAL_PROTECTED_BREED_NAMES).toEqual(expect.arrayContaining([
      '独龙牛', '青海毛驴', '新疆准噶尔双峰驼', '敖鲁古雅驯鹿', '吉林梅花鹿',
      '河田鸡', '麻旺鸭', '向海飞鹅',
    ]));
  });

  it('resolves at least one source for every runtime record', () => {
    for (const breed of breeds) {
      const metadata = getBreedMetadata(breed);
      expect(metadata.sourceIds.length, breed.name).toBeGreaterThan(0);
      expect(metadata.sourceIds.every((id) => getBreedSource(id)), breed.name).toBe(true);
    }
  });

  it('does not claim unmatched legacy records are nationally protected', () => {
    const breed = breeds.find((item) => item.name === '东北民猪')!;
    expect(getBreedMetadata(breed).protectionStatus).toBe('unverified');
  });
});
```

- [ ] **Step 2: Run the test and verify it fails on missing metadata modules**

Run: `pnpm exec vitest run src/data/__tests__/breedMetadata.test.ts`  
Expected: FAIL because the source catalog and official-name array do not exist.

- [ ] **Step 3: Implement the source catalog and metadata resolver**

```ts
// src/data/breedSources.ts
export interface BreedSource {
  id: string; title: string; publisher: string; url?: string;
  publishedAt?: string; verifiedAt: string; scope: string;
}
export const breedSources = {
  'moa-notice-940': {
    id: 'moa-notice-940',
    title: '中华人民共和国农业农村部公告 第940号',
    publisher: '中华人民共和国农业农村部',
    url: 'https://www.moa.gov.cn/govpublic/nybzzj1/202510/t20251029_6478525.htm',
    publishedAt: '2025-10-27', verifiedAt: '2026-09-27',
    scope: '国家级畜禽遗传资源保护名录名称与分类',
  },
  'breed-museum-legacy': {
    id: 'breed-museum-legacy', title: '项目既有整理数据集', publisher: '中国地方畜禽品种数字博物馆',
    verifiedAt: '2026-09-27', scope: '本轮升级前已有记录；具体性状与图片来源仍需分批复核',
  },
} as const satisfies Record<string, BreedSource>;
export function getBreedSource(sourceId: string): BreedSource | undefined {
  return breedSources[sourceId as keyof typeof breedSources];
}
```

```ts
// core of src/data/breedMetadata.ts
export type ProtectionStatus = 'national-list' | 'not-on-national-list' | 'unverified';
export interface BreedMetadata {
  officialName: string; aliases: string[]; protectionStatus: ProtectionStatus;
  sourceIds: string[]; verifiedAt: string; legacyIds?: string[];
  imageSource?: string; imageRights: 'verified' | 'unverified' | 'project-svg';
  metricBasis: 'editorial-normalized';
}
type BreedMetadataOverride = Partial<Omit<BreedMetadata, 'metricBasis'>>;
export const metadataOverrides: Partial<Record<string, BreedMetadataOverride>> = {};
const protectedNames = new Set(NATIONAL_PROTECTED_BREED_NAMES);
export function getBreedMetadata(breed: Breed): BreedMetadata {
  const override = metadataOverrides[breed.name];
  const officialName = override?.officialName ?? breed.name;
  const listed = protectedNames.has(officialName);
  return {
    officialName, aliases: override?.aliases ?? [],
    protectionStatus: listed ? 'national-list' : (override?.protectionStatus ?? 'unverified'),
    sourceIds: override?.sourceIds ?? ['breed-museum-legacy'],
    verifiedAt: override?.verifiedAt ?? '2026-09-27',
    legacyIds: override?.legacyIds, imageSource: override?.imageSource,
    imageRights: override?.imageRights ?? 'unverified', metricBasis: 'editorial-normalized',
  };
}
```

Transcribe the 271 livestock/poultry names from Announcement No. 940 into `NATIONAL_PROTECTED_BREED_NAMES` in source order. Keep the 12 bee and 15 silkworm names out of this array and export their published counts as `EXCLUDED_BEE_COUNT = 12` and `EXCLUDED_SILKWORM_COUNT = 15`. Extend `Breed` only with optional display-level metadata fields that genuinely belong to an individual row; keep shared provenance in the resolver.

- [ ] **Step 4: Run metadata, audit and type tests**

Run: `pnpm exec vitest run src/data/__tests__/breedMetadata.test.ts src/data/__tests__/breedAudit.test.ts`  
Expected: all tests PASS and the official-name set size is 271.

- [ ] **Step 5: Commit provenance support**

```bash
git add src/data/breedSources.ts src/data/nationalProtectionList.ts src/data/breedMetadata.ts src/data/breeds.ts src/data/__tests__/breedMetadata.test.ts
git commit -m "feat: add breed provenance and protection metadata"
```

### Task 3: Resolve the 11 ID collisions without inflating the collection

**Files:**
- Create: `src/data/__tests__/datasetIntegrity.test.ts`
- Modify: `src/data/breeds.ts`
- Modify: `src/data/extraBreeds.ts`
- Modify: `src/data/extraBreeds2.ts`
- Modify: `src/data/extraBreeds4.ts`
- Modify: `src/data/extraBreeds7.ts`
- Modify: `src/data/extraBreeds8.ts`
- Modify: `src/data/extraBreeds14.ts`
- Modify: `src/data/breedMetadata.ts`

**Interfaces:**
- Consumes: `auditBreedDataset`, `getBreedMetadata`
- Produces: a collision-free historical intermediate of 679 records before additions

- [ ] **Step 1: Write the complete-dataset failure test**

```ts
import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { auditBreedDataset } from '@/data/breedAudit';
import { getBreedMetadata } from '@/data/breedMetadata';

test('runtime breed data has no integrity issues', () => {
  expect(auditBreedDataset(breeds, { resolveMetadata: getBreedMetadata })).toEqual([]);
});

test('identity normalization removes duplicate variants but keeps homophones', () => {
  expect(breeds).toHaveLength(679);
  expect(breeds.filter((breed) => breed.id === 'xining-horse')).toHaveLength(1);
  expect(breeds.some((breed) => breed.id === 'xinihe-horse' && breed.name === '锡尼河马')).toBe(true);
  expect(breeds.some((breed) => breed.id === 'huaihe-pig' && breed.name === '淮猪')).toBe(true);
  expect(breeds.some((breed) => breed.id === 'fuzhou-yellow-cattle' && breed.name === '福州黄牛')).toBe(true);
});
```

- [ ] **Step 2: Run the dataset test and capture the 11 duplicate-ID groups**

Run: `pnpm exec vitest run src/data/__tests__/datasetIntegrity.test.ts`  
Expected: FAIL with duplicate IDs for `bamei-pig`, `xining-horse`, `huai-pig`, `fuzhou-cattle`, `pingwu-cattle`, `xuwen-cattle`, `leizhou-cattle`, `fuan-cattle`, `ganxi-cattle`, `jinjiang-cattle`, and `guangfeng-cattle`.

- [ ] **Step 3: Apply the reviewed identity-resolution table**

Use these exact outcomes:

| Collision | Resolution | Canonical alias metadata |
|---|---|---|
| 互助八眉猪 / 八眉猪 | keep one `bamei-pig` row under official name 八眉猪 | aliases include 互助八眉猪 |
| 西宁马 / 锡尼河马 | keep `xining-horse`; rename the latter ID to `xinihe-horse` | no merge |
| 槐猪 / 淮猪 | keep `huai-pig`; rename 淮猪 ID to `huaihe-pig` | no merge |
| 复州牛 / 福州黄牛 | keep `fuzhou-cattle`; rename 福州黄牛 ID to `fuzhou-yellow-cattle` | no merge |
| 平武黄牛 duplicates | keep the better-sourced single row | aliases include 平武牛 when present |
| 徐闻牛 / 徐闻黄牛 | keep one row under the official form selected from Announcement 940 | other form is an alias |
| 雷州牛 / 雷州黄牛 | keep one row under the official form selected from Announcement 940 | other form is an alias |
| 福安牛 / 福安黄牛 | keep one row under the official form selected from Announcement 940 | other form is an alias |
| 赣西牛 / 赣西黄牛 | keep one row under the official form selected from Announcement 940 | other form is an alias |
| 锦江牛 / 锦江黄牛 | keep one row under the official form selected from Announcement 940 | other form is an alias |
| 广丰黄牛 duplicates | keep the better-sourced single row | deduplicate without an invented variant |

For the three true homophone collisions, the earlier runtime record retains the old ID, preserving prior lookup behavior. Put the renamed IDs’ old ambiguous values in an audit note rather than mapping one legacy ID to two breeds. Remove eight duplicate rows, resulting in 679 records before additions.

- [ ] **Step 4: Run the complete audit and confirm no collision remains**

Run: `pnpm data:audit`  
Expected: PASS, 679 records, zero audit issues.

- [ ] **Step 5: Commit the identity repair**

```bash
git add src/data src/data/__tests__/datasetIntegrity.test.ts package.json
git commit -m "fix: normalize duplicate breed identities"
```

### Task 4: Normalize official aliases and add 23 verified breeds

**Files:**
- Create: `src/data/extraBreeds15.ts`
- Create: `src/data/__tests__/announcement940Coverage.test.ts`
- Modify: `src/data/breeds.ts`
- Modify: `src/data/breedMetadata.ts`
- Modify: the existing modules containing `准噶尔双峰驼`, `山麻鸭`, and `驯鹿`

**Interfaces:**
- Produces: a final `breeds` array of 701 unique records (679 normalized records plus 22 net additions)
- Produces: canonical names 新疆准噶尔双峰驼, 龙岩山麻鸭, 敖鲁古雅驯鹿 with their old names searchable as aliases

- [ ] **Step 1: Write exact coverage and final-count tests**

```ts
const expectedNewNames = [
  '独龙牛', '青海毛驴',
  '河田鸡', '金阳丝毛鸡', '林甸鸡', '怀乡鸡', '闽清毛脚鸡', '皖南三黄鸡',
  '金湖乌凤鸡', '烟台䅟糠鸡', '淅川乌骨鸡', '河南斗鸡', '景阳鸡', '来凤酉水鸡',
  '雪峰乌骨鸡', '广西麻鸡', '瑶鸡', '腾冲雪鸡', '太平鸡', '海东鸡',
  '麻旺鸭', '向海飞鹅', '吉林梅花鹿',
] as const;

test('adds every reviewed missing livestock breed exactly once', () => {
  expect(breeds).toHaveLength(701);
  for (const name of expectedNewNames) {
    expect(breeds.filter((breed) => breed.name === name), name).toHaveLength(1);
  }
});

test.each([
  ['新疆准噶尔双峰驼', '准噶尔双峰驼'],
  ['龙岩山麻鸭', '山麻鸭'],
  ['敖鲁古雅驯鹿', '驯鹿'],
])('%s is canonical and %s is an alias', (officialName, alias) => {
  const breed = breeds.find((item) => item.name === officialName)!;
  expect(getBreedMetadata(breed).aliases).toContain(alias);
});
```

- [ ] **Step 2: Run coverage tests and verify missing-name failures**

Run: `pnpm exec vitest run src/data/__tests__/announcement940Coverage.test.ts`  
Expected: FAIL because the 23 records and three canonical renames are absent.

- [ ] **Step 3: Add the reviewed records and metadata**

Create `extraBreeds15` with one complete `Breed` object for each name in `expectedNewNames`. For every object:

- use a unique descriptive kebab-case ID;
- use the official province/region and a representative locality coordinate, not a fabricated precision claim;
- cite `moa-notice-940` for protected-list identity plus a specific government or national germplasm source for descriptive claims;
- use `/brand/breed-placeholder.svg` until the photograph and reuse rights are independently verified;
- set all radar numbers within 0–100 and flag their common `metricBasis` as `editorial-normalized`;
- state only sourced appearance, production and cultural information; concise text is preferable to unsupported detail.

Rename the three existing canonical records in place and add aliases in `metadataOverrides`. Append `...extraBreeds15` once at the end of `breeds`.

- [ ] **Step 4: Run coverage, metadata and full audit tests**

Run: `pnpm exec vitest run src/data/__tests__/announcement940Coverage.test.ts src/data/__tests__/breedMetadata.test.ts src/data/__tests__/datasetIntegrity.test.ts`  
Expected: PASS, 701 records, all 23 reviewed announcement names resolved once, 22 placeholder additions, all three aliases resolved and no audit issue.

- [ ] **Step 5: Commit the verified expansion**

```bash
git add src/data
git commit -m "feat: expand verified livestock breed coverage"
```

### Task 5: Route all lookup, search and detail provenance through canonical APIs

**Files:**
- Create: `src/data/breedSearch.ts`
- Create: `src/data/__tests__/breedSearch.test.ts`
- Create: `src/components/__tests__/BreedDetail.test.tsx`
- Modify: `src/contexts/MuseumContext.tsx`
- Modify: `src/pages/MapPage.tsx`
- Modify: `src/pages/EncyclopediaPage.tsx`
- Modify: `src/components/BreedDetail.tsx`
- Modify: `src/contexts/AppSettings.tsx`

**Interfaces:**
- Produces: `findBreedById(id: string | null): Breed | null`
- Produces: `matchesBreedQuery(breed: Breed, query: string): boolean`
- Consumes: `getBreedMetadata`, `getBreedSource`

- [ ] **Step 1: Write alias-search and provenance-rendering tests**

```ts
test.each([
  ['准噶尔双峰驼', '新疆准噶尔双峰驼'],
  ['山麻鸭', '龙岩山麻鸭'],
  ['驯鹿', '敖鲁古雅驯鹿'],
  ['Xinihe Horse', '锡尼河马'],
])('query %s finds %s', (query, expected) => {
  expect(breeds.filter((breed) => matchesBreedQuery(breed, query)).map((breed) => breed.name)).toContain(expected);
});

test('detail shows source and verification status', () => {
  renderWithProviders(<BreedDetail breed={breeds.find((breed) => breed.name === '独龙牛')!} />);
  expect(screen.getByRole('heading', { name: '数据来源与核验' })).toBeInTheDocument();
  expect(screen.getByText('中华人民共和国农业农村部公告 第940号')).toBeInTheDocument();
  expect(screen.getByText(/2026-09-27/)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run the focused tests and verify missing canonical helpers**

Run: `pnpm exec vitest run src/data/__tests__/breedSearch.test.ts src/components/__tests__/BreedDetail.test.tsx`  
Expected: FAIL because alias search and provenance UI are not implemented.

- [ ] **Step 3: Implement normalized lookup and search**

```ts
const fold = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');
const byId = new Map(breeds.map((breed) => [breed.id, breed]));

export function findBreedById(id: string | null): Breed | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

export function matchesBreedQuery(breed: Breed, query: string): boolean {
  const needle = fold(query);
  if (!needle) return true;
  const metadata = getBreedMetadata(breed);
  return [breed.name, breed.englishName, metadata.officialName, ...metadata.aliases]
    .some((value) => fold(value).includes(needle));
}
```

Use `matchesBreedQuery` in map and encyclopedia filters. Replace the linear context lookup with `findBreedById`. Add a “数据来源与核验” section to `BreedDetail` that renders source titles as safe links, protection status, verification date, image-rights status and the editorial-score disclaimer. Add matching Chinese and English interface strings.

- [ ] **Step 4: Run all unit tests and type checks**

Run: `pnpm test`  
Expected: all data and component tests PASS.  
Run: `pnpm typecheck`  
Expected: exit code 0.

- [ ] **Step 5: Commit canonical data consumption**

```bash
git add src/data/breedSearch.ts src/data/__tests__/breedSearch.test.ts src/contexts/MuseumContext.tsx src/pages/MapPage.tsx src/pages/EncyclopediaPage.tsx src/components/BreedDetail.tsx src/components/__tests__/BreedDetail.test.tsx src/contexts/AppSettings.tsx
git commit -m "feat: expose canonical breed search and provenance"
```
