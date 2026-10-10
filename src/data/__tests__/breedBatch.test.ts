import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import batchMap from '@/data/breedBatch.generated.json';

/**
 * 批次归属契约：「年代点亮」镜头依赖该映射覆盖全部运行时记录，
 * 且批次标签与数据手册口径一致（extraBreeds8 起序号偏移一）。
 */
test('every runtime record resolves to exactly one batch', () => {
  const byId = batchMap.byId as Record<string, string>;
  const missing = breeds.filter((breed) => !byId[breed.id]).map((breed) => breed.id);
  expect(missing, '未匹配批次的记录').toEqual([]);
  expect(Object.keys(byId)).toHaveLength(breeds.length);
});

test('batch labels are a stable, ordered set', () => {
  const labels = batchMap.batches.map((batch) => batch.label);
  expect(labels).toContain('基础库');
  expect(labels).toContain('2024 名录');
  // 月份批次按序号升序排列（基础库在最前，2024 名录在最后）
  const numeric = labels.filter((label) => /^第\d+批$/.test(label));
  const numbers = numeric.map((label) => Number(label.match(/\d+/)![0]));
  expect(numbers).toEqual([...numbers].sort((a, b) => a - b));
  expect(new Set(labels).size).toBe(labels.length);
});

test('落点口径与地图可落点记录数一致', () => {
  const mappable = breeds.filter(
    (breed) => breed.province !== '待核验' && !(breed.longitude === 0 && breed.latitude === 0),
  );
  const protectedCount = breeds.filter(
    (breed) => getBreedMetadata(breed).protectionStatus === 'national-list',
  ).length;
  expect(COLLECTION_SUMMARY.mappable).toBe(mappable.length);
  expect(COLLECTION_SUMMARY.nationalProtectedMatches).toBe(protectedCount);
  expect(COLLECTION_SUMMARY.unverifiedProvince).toBe(
    breeds.filter((breed) => breed.province === '待核验').length,
  );
});
