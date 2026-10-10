import { describe, expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildSiteClusters } from '../clusterSites';
import { buildDigest, hasMappableLocation, categoryTally, lightMapSummary } from '../lightMapData';

/**
 * 光图数据口径契约：
 * - 落点数量必须等于 COLLECTION_SUMMARY.mappable；
 * - 待核验省份与哨兵坐标一律不落点；
 * - 摘要表与运行时聚合一致（无障碍等价物）；
 * - 产区簇的合计与摘要表逐省对得上（同一份事实，两个视图）。
 */

test('only records with a verified location are mappable', () => {
  const mappable = breeds.filter(hasMappableLocation);
  expect(mappable).toHaveLength(COLLECTION_SUMMARY.mappable);

  for (const breed of breeds) {
    if (breed.province === '待核验' || (breed.longitude === 0 && breed.latitude === 0)) {
      expect(hasMappableLocation(breed), breed.name + ' 不应落点').toBe(false);
    }
  }
});

test('clusters and the digest describe the same collection', () => {
  const clusters = buildSiteClusters();
  const digest = buildDigest();
  const summary = lightMapSummary(clusters);

  expect(summary.mappable).toBe(digest.mappable);
  expect(summary.clusters).toBe(clusters.length);
  expect(summary.provinces).toBe(new Set(clusters.map((cluster) => cluster.province)).size);

  // 每个省的簇合计必须等于摘要表里该省的可落点数
  const byProvince = new Map<string, number>();
  for (const cluster of clusters) {
    byProvince.set(cluster.province, (byProvince.get(cluster.province) ?? 0) + cluster.total);
  }
  for (const entry of digest.provinces) {
    if (entry.province === '待核验') continue;
    expect(byProvince.get(entry.province) ?? 0, entry.province).toBe(entry.mappable);
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

test('the largest cluster is the Chengdu-area one, still well inside a province', () => {
  const clusters = buildSiteClusters();
  const biggest = clusters.reduce((max, cluster) => Math.max(max, cluster.total), 0);
  expect(biggest).toBeGreaterThanOrEqual(45);
  expect(biggest).toBeLessThanOrEqual(60);
});
