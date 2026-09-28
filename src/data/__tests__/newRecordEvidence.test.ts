import { expect, test } from 'vitest';
import { breeds } from '../breeds';
import { getBreedMetadata } from '../breedMetadata';
test('name-only new records do not invent threat assessments or performance scores', () => {
  const additions = breeds.filter(b => b.image === '/brand/breed-placeholder.svg');
  expect(additions).toHaveLength(22);
  for (const breed of additions) {
    expect(breed.endangered).toBe('待核验');
    expect(Object.values(breed.radar)).toEqual([null, null, null, null, null]);
    expect(getBreedMetadata(breed).metricBasis).toBe('not-available');
  }
});
