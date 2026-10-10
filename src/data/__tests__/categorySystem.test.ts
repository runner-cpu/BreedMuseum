import { readFileSync } from 'node:fs';
import { expect, test } from 'vitest';
import { breeds, categories } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import {
  breedCategoryFixes,
  breedSpeciesLevelFixes,
  BREED_CATEGORY_FIX_COUNT,
} from '@/data/breedCategoryFixes';
import { SPECIES_CATEGORY } from '@/data/speciesCategory';

/**
 * 类别体系契约：15 类与官方名录分组对齐；“其他”只保留两类可复述理由——
 * 名录查无此条目，或物种属于名录“传统畜禽/鹌鹑”而不设独立类别。
 */
type Catalog = { sections: Array<{ species: string; names: string[] }> };
const catalog = JSON.parse(readFileSync('src/data/ml2024Catalog.json', 'utf8')) as Catalog;
const speciesByName = new Map<string, string>();
for (const section of catalog.sections) {
  for (const name of section.names) speciesByName.set(name, section.species);
}
/** 名录中确有独立章节的物种集合（校验物种级修复用）。 */
const catalogSpecies = new Set(catalog.sections.map((section) => section.species));

test('category vocabulary matches the published 15-value system', () => {
  expect(categories).toEqual([
    '猪', '牛', '羊', '鸡', '鸭', '鹅', '马', '驴', '骆驼',
    '兔', '鸽', '鹿', '蜂', '特种畜禽', '其他',
  ]);
});

test('every runtime record uses a known category', () => {
  const known = new Set<string>(categories);
  for (const breed of breeds) {
    expect(known.has(breed.category), breed.name + ' 的类别 ' + breed.category).toBe(true);
  }
});

test('legacy category fixes are applied and stay exactly as reviewed', () => {
  expect(BREED_CATEGORY_FIX_COUNT).toBe(31);
  const byId = new Map(breeds.map((breed) => [breed.id, breed]));
  for (const [id, category] of Object.entries(breedCategoryFixes)) {
    expect(byId.get(id)?.category, id).toBe(category);
  }
  // 名称级修复：记录名（或其名录正名/别名）能在官方名录中逐字定位，且物种映射与修复一致
  for (const [id, category] of Object.entries(breedCategoryFixes)) {
    const breed = byId.get(id);
    if (!breed) continue;
    const metadata = getBreedMetadata(breed);
    const species = [metadata.officialName, breed.name, ...metadata.aliases]
      .map((name) => speciesByName.get(name))
      .find(Boolean);
    if (species === undefined && breedSpeciesLevelFixes[id]) continue; // 物种级修复在下一个断言里校验
    expect(species, breed.name + ' 未在名录中定位到物种').toBeDefined();
    expect(SPECIES_CATEGORY[species!], breed.name + ' 的物种映射').toBe(category);
  }
  // 物种级修复：记录名未逐字见于名录，但其物种在名录中成章
  for (const [id, fix] of Object.entries(breedSpeciesLevelFixes)) {
    const breed = byId.get(id);
    expect(breed, id + ' 在运行时缺失').toBeDefined();
    expect(catalogSpecies.has(fix.species), fix.species + ' 不在名录章节中').toBe(true);
    expect(SPECIES_CATEGORY[fix.species], id + ' 的物种映射').toBe(fix.category);
    expect(breed!.category).toBe(fix.category);
  }
});

test('“其他” only keeps records with a documented reason', () => {
  const others = breeds.filter((breed) => breed.category === '其他');
  for (const breed of others) {
    const metadata = getBreedMetadata(breed);
    const species = [metadata.officialName, breed.name, ...metadata.aliases]
      .map((name) => speciesByName.get(name))
      .find(Boolean);
    // 理由一：名录可定位，且当前类别与物种映射一致（鹌鹑是唯一按设计留在“其他”的已登记物种）
    // 理由二：名录查无此条目，历史记录不做名称推断
    const mapped = species ? SPECIES_CATEGORY[species] : undefined;
    const documented = species === undefined || (mapped !== undefined && mapped === breed.category);
    expect(documented, breed.name + ' 的“其他”缺少依据（名录物种=' + String(species) + '）').toBe(true);
  }
  // 名录已登记的其它物种不得停留在“其他”之外的其他类别
  for (const breed of others) {
    const metadata = getBreedMetadata(breed);
    const species = [metadata.officialName, breed.name, ...metadata.aliases]
      .map((name) => speciesByName.get(name))
      .find(Boolean);
    if (species) expect(species === '鹌鹑', breed.name).toBe(true);
  }
});

test('the review-round count is visible in the distribution', () => {
  const tally = new Map<string, number>();
  for (const breed of breeds) tally.set(breed.category, (tally.get(breed.category) ?? 0) + 1);
  // 2026-10 分类复核：物种级修复后 鹿 17 / 特种畜禽 19，“其他”降至 11 条
  expect(tally.get('驴')).toBe(24);
  expect(tally.get('鹿')).toBe(17);
  expect(tally.get('蜂')).toBe(30);
  expect(tally.get('特种畜禽')).toBe(19);
  expect(tally.get('其他')).toBe(11);
});
