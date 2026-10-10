import { describe, expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildDigest, buildPillars, hasMappableLocation, categoryTally, PILLAR_BASE_HEIGHT } from '../lightMapData';

/**
 * 光图数据装配契约：
 * - 落点数量必须等于 COLLECTION_SUMMARY.mappable；
 * - 待核验省份与哨兵坐标一律不落点；
 * - 同一坐标的记录确定性铺开（刷新后位置一致）；
 * - 摘要表与运行时聚合一致（无障碍等价物）。
 */

test('pillars only include records with a verified location', () => {
  const pillars = buildPillars();
  expect(pillars).toHaveLength(COLLECTION_SUMMARY.mappable);
  expect(breeds.filter(hasMappableLocation)).toHaveLength(COLLECTION_SUMMARY.mappable);

  const ids = new Set(pillars.map((pillar) => pillar.id));
  for (const breed of breeds) {
    if (hasMappableLocation(breed)) {
      expect(ids.has(breed.id), breed.name).toBe(true);
    } else {
      expect(ids.has(breed.id), breed.name + ' 不应落点').toBe(false);
    }
  }
});

test('pillar layout is deterministic and grouped offsets stay inside the audited radius', () => {
  const first = buildPillars();
  const second = buildPillars();
  expect(first).toEqual(second);

  // 同一坐标的分组：世界坐标偏移半径上限 = 18 / 100
  const byGroup = new Map<string, typeof first>();
  for (const pillar of first) {
    const key = pillar.province;
    const list = byGroup.get(key) ?? [];
    list.push(pillar);
    byGroup.set(key, list);
  }
  const maxGroup = Math.max(...first.map((pillar) => pillar.groupSize));
  expect(maxGroup).toBeGreaterThan(1);

  for (const pillar of first) {
    expect(pillar.position[0]).toBeGreaterThan(-5);
    expect(pillar.position[0]).toBeLessThan(5);
    expect(pillar.position[1]).toBeGreaterThan(-4);
    expect(pillar.position[1]).toBeLessThan(4);
    expect(pillar.height).toBeGreaterThanOrEqual(PILLAR_BASE_HEIGHT);
  }
});

test('digest matches the audited collection summary', () => {
  const digest = buildDigest();
  expect(digest.total).toBe(COLLECTION_SUMMARY.total);
  expect(digest.mappable).toBe(COLLECTION_SUMMARY.mappable);
  expect(digest.unverifiedLocation).toBe(COLLECTION_SUMMARY.unverifiedProvince);
  expect(digest.nationalProtected).toBe(COLLECTION_SUMMARY.nationalProtectedMatches);
  expect(digest.endangered).toBe(COLLECTION_SUMMARY.editorialEndangered);

  const provincesExcludingPending = digest.provinces.filter((item) => item.province !== '待核验');
  expect(provincesExcludingPending).toHaveLength(COLLECTION_SUMMARY.provinces);
  // 待核验永远排在最后，供侧栏单独列出
  expect(digest.provinces[digest.provinces.length - 1].province).toBe('待核验');
});

test('category tally follows the published order and covers all 15 categories', () => {
  const tally = categoryTally(buildDigest());
  expect(tally).toHaveLength(COLLECTION_SUMMARY.categories);
  expect(tally.reduce((sum, item) => sum + item.count, 0)).toBe(COLLECTION_SUMMARY.total);
  // 分类修复后“其他”不再是空类，且鸡 / 羊 / 牛 为前三
  const ranked = [...tally].sort((a, b) => b.count - a.count).slice(0, 3).map((item) => item.category);
  expect(ranked).toEqual(['鸡', '羊', '牛']);
  expect(tally.find((item) => item.category === '其他')?.count).toBe(11);
});
