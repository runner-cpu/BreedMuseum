import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';

const expectedNewNames = [
  '独龙牛',
  '青海毛驴',
  '河田鸡',
  '金阳丝毛鸡',
  '林甸鸡',
  '怀乡鸡',
  '闽清毛脚鸡',
  '皖南三黄鸡',
  '金湖乌凤鸡',
  '烟台䅟糠鸡',
  '淅川乌骨鸡',
  '河南斗鸡',
  '景阳鸡',
  '来凤酉水鸡',
  '雪峰乌骨鸡',
  '广西麻鸡',
  '瑶鸡',
  '腾冲雪鸡',
  '太平鸡',
  '海东鸡',
  '麻旺鸭',
  '向海飞鹅',
  '吉林梅花鹿',
] as const;

test('adds every reviewed missing livestock breed exactly once', () => {
  expect(breeds).toHaveLength(687);
  for (const name of expectedNewNames) {
    // 同物异名合并后，名录名既可由同名记录代表，也可由 officialName 覆盖的记录代表，
    // 但每个名录名必须恰好对应一条运行时记录
    const byName = breeds.filter((breed) => breed.name === name);
    const byOfficialName = breeds.filter((breed) => getBreedMetadata(breed).officialName === name);
    const representatives = new Set([...byName, ...byOfficialName].map((breed) => breed.id));
    expect(representatives.size, name).toBe(1);
  }
});

test.each([
  ['新疆准噶尔双峰驼', '准噶尔双峰驼'],
  ['龙岩山麻鸭', '山麻鸭'],
  ['敖鲁古雅驯鹿', '驯鹿'],
] as const)('%s is canonical and %s is an alias', (officialName, alias) => {
  const breed = breeds.find((item) => item.name === officialName);
  expect(breed).toBeDefined();
  expect(getBreedMetadata(breed!).aliases).toContain(alias);
});
