import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { findBreedById, matchesBreedQuery, normalizeBreedQuery } from '@/data/breedSearch';

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
