import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { findBreedById, matchesBreedNameQuery, matchesBreedQuery, normalizeBreedQuery, sortBreedsByRelevance } from '@/data/breedSearch';

test.each([
  ['准噶尔双峰驼', '新疆准噶尔双峰驼'],
  ['山麻鸭', '龙岩山麻鸭'],
  ['驯鹿', '敖鲁古雅驯鹿'],
  ['Xinihe Horse', '锡尼河马'],
] as const)('query %s finds %s', (query, expected) => {
  expect(
    breeds.filter((breed) => matchesBreedQuery(breed, query)).map((breed) => breed.name),
  ).toContain(expected);
});

test('findBreedById returns one canonical record and null for an unknown id', () => {
  expect(findBreedById('xinihe-horse')?.name).toBe('锡尼河马');
  expect(findBreedById('does-not-exist')).toBeNull();
});

test('normalizes compatibility spaces and full-width punctuation before matching', () => {
  expect(normalizeBreedQuery('  XINIHE　Horse  ')).toBe('xinihehorse');
  expect(normalizeBreedQuery('')).toBe('');
  expect(breeds.some((breed) => matchesBreedQuery(breed, 'XINIHE　Horse'))).toBe(true);
});

test('matches story and appearance content for multi-character queries', () => {
  // “国之瑰宝”出自秦川牛的文化故事，而非名称
  const byStory = breeds.filter((breed) => matchesBreedQuery(breed, '国之瑰宝')).map((breed) => breed.name);
  expect(byStory).toContain('秦川牛');
});

test('single-character queries fall back to name-only matching', () => {
  expect(breeds.some((breed) => matchesBreedQuery(breed, '瑰'))).toBe(false);
});

test('sortBreedsByRelevance puts name matches before content matches', () => {
  // “黄牛”既命中大量品种名称，也出现在其他品种的故事文本中
  const matches = breeds.filter((breed) => matchesBreedQuery(breed, '黄牛'));
  expect(matches.length).toBeGreaterThan(5);
  const sorted = sortBreedsByRelevance(matches, '黄牛');
  const nameTier = sorted.map((breed) => matchesBreedNameQuery(breed, '黄牛'));
  // 排序后名称命中应全部位于全文命中之前
  expect(nameTier).toEqual([...nameTier.filter(Boolean), ...nameTier.filter((v) => !v)]);
});
