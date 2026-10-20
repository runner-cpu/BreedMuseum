import { expect, it } from 'vitest';
import { HOME_CATEGORY_COUNTS, HOME_FEATURED } from '@/data/homeHighlights';
import { visibleBreeds, visibleCategories } from '@/data/visibleBreeds';

/**
 * 首页首屏用的是 `homeHighlights.ts` 里的轻量常量（类别计数 + 8 条精选记录），
 * 而不是完整品种库。这份契约保证常量与运行时数据逐项一致：数据批次一更新，
 * 这里先红，首页不会悄悄显示去年的数字。
 */
it('category counts describe the browsable collection', () => {
  const counts = new Map<string, number>();
  for (const breed of visibleBreeds) counts.set(breed.category, (counts.get(breed.category) ?? 0) + 1);

  // 每个可浏览类别都必须在首页出现，且不能出现空类别
  expect(HOME_CATEGORY_COUNTS.map((item) => item.category).sort()).toEqual([...visibleCategories].sort());

  for (const item of HOME_CATEGORY_COUNTS) {
    expect(counts.get(item.category), item.category).toBe(item.count);
  }
});

it('featured records exist, carry real images and cover several categories', () => {
  const ids = new Set<string>();
  const categories = new Set<string>();
  const provinces = new Set<string>();

  for (const item of HOME_FEATURED) {
    const breed = visibleBreeds.find((entry) => entry.id === item.id);
    expect(breed, item.name).toBeDefined();
    expect(breed!.name).toBe(item.name);
    expect(breed!.englishName).toBe(item.englishName);
    expect(breed!.category).toBe(item.category);
    expect(breed!.province).toBe(item.province);
    expect(breed!.image).toBe(item.image);
    expect(item.image).toMatch(/^https?:\/\//);

    ids.add(item.id);
    categories.add(item.category);
    provinces.add(item.province);
  }

  expect(ids.size).toBe(HOME_FEATURED.length);
  expect(categories.size).toBeGreaterThanOrEqual(5);
  expect(provinces.size).toBeGreaterThanOrEqual(6);
});
