import { describe, expect, it } from 'vitest';
import type { Breed } from '@/data/breeds';
import { categories, endangeredLevels } from '@/data/breeds';
import { auditBreedDataset } from '@/data/breedAudit';

const valid: Breed = {
  id: 'test-cattle',
  name: 'Test Cattle',
  englishName: 'Test Cattle',
  province: '云南',
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

  it('accepts an entirely unavailable radar profile', () => {
    const issues = auditBreedDataset([
      {
        ...valid,
        endangered: '待核验',
        radar: { meat: null, milk: null, reproduction: null, labor: null, adaptability: null },
      },
    ]);

    expect(issues).toEqual([]);
  });

  it('rejects a radar profile that mixes unavailable and numeric values', () => {
    const issues = auditBreedDataset([
      {
        ...valid,
        radar: { ...valid.radar, meat: null },
      },
    ]);

    expect(issues.map((issue) => issue.code)).toContain('invalid-radar');
  });

  it('rejects provinces outside the administrative vocabulary but accepts the unverified sentinel', () => {
    const issues = auditBreedDataset([
      { ...valid, id: 'a', name: 'A', province: '东区' },
      { ...valid, id: 'b', name: 'B', province: '待核验', longitude: 0, latitude: 0 },
      { ...valid, id: 'c', name: 'C', province: '云南' },
    ]);

    const byId = new Map(issues.map((issue) => [issue.breedId, issue.code]));
    expect(byId.get('a')).toBe('invalid-province');
    expect(byId.get('b')).toBeUndefined();
    expect(byId.get('c')).toBeUndefined();
  });

  it('flags verified-province records parked at the (0,0) sentinel coordinate', () => {
    const issues = auditBreedDataset([
      { ...valid, id: 'parked', name: 'Parked', province: '云南', longitude: 0, latitude: 0 },
      { ...valid, id: 'placed', name: 'Placed', province: '云南', longitude: 102.7, latitude: 25 },
    ]);

    const byId = new Map(issues.map((issue) => [issue.breedId, issue.code]));
    expect(byId.get('parked')).toBe('sentinel-coordinate');
    expect(byId.get('placed')).toBeUndefined();
  });
});
