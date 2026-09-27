import { describe, expect, it } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata, getBreedSource } from '@/data/breedMetadata';
import { NATIONAL_PROTECTED_BREED_NAMES } from '@/data/nationalProtectionList';

describe('official protection metadata', () => {
  it('contains exactly the 271 livestock and poultry names from Announcement 940', () => {
    expect(new Set(NATIONAL_PROTECTED_BREED_NAMES).size).toBe(271);
    expect(NATIONAL_PROTECTED_BREED_NAMES).toEqual(
      expect.arrayContaining([
        '独龙牛',
        '青海毛驴',
        '新疆准噶尔双峰驼',
        '敖鲁古雅驯鹿',
        '吉林梅花鹿',
        '河田鸡',
        '麻旺鸭',
        '向海飞鹅',
      ]),
    );
  });

  it('resolves at least one source for every runtime record', () => {
    for (const breed of breeds) {
      const metadata = getBreedMetadata(breed);
      expect(metadata.sourceIds.length, breed.name).toBeGreaterThan(0);
      expect(metadata.sourceIds.every((id) => getBreedSource(id)), breed.name).toBe(true);
    }
  });

  it('does not claim unmatched legacy records are nationally protected', () => {
    const breed = breeds.find((item) => item.name === '东北民猪');
    expect(breed).toBeDefined();
    expect(getBreedMetadata(breed!).protectionStatus).toBe('unverified');
  });
});
