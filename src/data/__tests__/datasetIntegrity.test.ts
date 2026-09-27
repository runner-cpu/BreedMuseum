import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { auditBreedDataset } from '@/data/breedAudit';
import { getBreedMetadata } from '@/data/breedMetadata';

test('runtime breed data has no integrity issues', () => {
  expect(auditBreedDataset(breeds, { resolveMetadata: getBreedMetadata })).toEqual([]);
});

test('identity normalization removes duplicate variants but keeps homophones', () => {
  expect(breeds).toHaveLength(701);
  expect(breeds.filter((breed) => breed.id === 'xining-horse')).toHaveLength(1);
  expect(breeds.some((breed) => breed.id === 'xinihe-horse' && breed.name === '锡尼河马')).toBe(true);
  expect(breeds.some((breed) => breed.id === 'huaihe-pig' && breed.name === '淮猪')).toBe(true);
  expect(breeds.some((breed) => breed.id === 'fuzhou-yellow-cattle' && breed.name === '福州黄牛')).toBe(true);
});
