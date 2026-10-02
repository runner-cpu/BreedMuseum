import { describe, expect, it } from 'vitest';
import { breeds, categories } from '@/data/breeds';
import { COLLECTION_SUMMARY } from '../collectionSummary';

describe('collection summary contract', () => {
  it('matches the audited runtime collection', () => {
    expect(COLLECTION_SUMMARY.total).toBe(breeds.length);
    expect(COLLECTION_SUMMARY.provinces).toBe(new Set(breeds.map((breed) => breed.province)).size);
    expect(COLLECTION_SUMMARY.categories).toBe(categories.length);
    expect(COLLECTION_SUMMARY.editorialEndangered).toBe(
      breeds.filter((breed) => breed.endangered === '濒危' || breed.endangered === '极危').length,
    );
  });
});
