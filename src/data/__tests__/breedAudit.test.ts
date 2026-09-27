import { describe, expect, it } from 'vitest';
import type { Breed } from '@/data/breeds';
import { categories, endangeredLevels } from '@/data/breeds';
import { auditBreedDataset } from '@/data/breedAudit';

const valid: Breed = {
  id: 'test-cattle',
  name: 'Test Cattle',
  englishName: 'Test Cattle',
  province: 'Test Province',
  longitude: 102.7,
  latitude: 25,
  category: categories[0],
  endangered: endangeredLevels[0],
  appearance: 'A complete appearance description.',
  performance: 'A complete performance description.',
  radar: { meat: 60, milk: 40, reproduction: 55, labor: 70, adaptability: 80 },
  story: 'A complete story.',
  image: '/brand/breed-placeholder.svg',
};

describe('auditBreedDataset', () => {
  it('reports duplicate ids and names', () => {
    const issues = auditBreedDataset([valid, { ...valid }]);

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(['duplicate-id', 'duplicate-name']),
    );
  });

  it('reports invalid coordinates, enums, radar values and missing text', () => {
    const issues = auditBreedDataset([
      {
        ...valid,
        id: '',
        province: '',
        longitude: 181,
        latitude: -91,
        category: 'unknown' as Breed['category'],
        endangered: 'unknown' as Breed['endangered'],
        radar: { ...valid.radar, meat: 101 },
      },
    ]);

    expect(new Set(issues.map((issue) => issue.code))).toEqual(
      new Set([
        'missing-field',
        'invalid-coordinate',
        'invalid-category',
        'invalid-endangered-level',
        'invalid-radar',
      ]),
    );
  });
});
