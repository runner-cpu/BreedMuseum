import { describe, expect, it } from 'vitest';
import { BREED_RULES, recommendBreeds } from '@/data/breedRecommend';
import { breeds } from '@/data/breeds';

/**
 * 推荐引擎契约：规则引用的品种必须真实存在；高海拔放牧肉用场景
 * 必须给出牦牛系候选且评分可复现。
 */
describe('breedRecommend', () => {
  it('every rule references a real collection breed', () => {
    const ids = new Set(breeds.map((breed) => breed.id));
    for (const rule of BREED_RULES) {
      expect(ids.has(rule.id), `规则引用了不存在的品种: ${rule.id}`).toBe(true);
    }
  });

  it('recommends plateau grazing candidates for high-altitude meat production', () => {
    const results = recommendBreeds({ altitude: 'veryHigh', purpose: 'meat', mode: 'grazing' });
    expect(results.length).toBeGreaterThan(0);
    expect(results.length).toBeLessThanOrEqual(5);
    expect(results[0].score).toBeGreaterThanOrEqual(70);
    expect(results.some((r) => r.breed.category === '牛' || r.breed.category === '羊')).toBe(true);
    for (const rec of results) {
      expect(rec.reasons.length).toBeGreaterThan(0);
      expect(rec.score).toBeLessThanOrEqual(100);
    }
  });

  it('is deterministic for identical input', () => {
    const input = { altitude: 'high', purpose: 'wool', mode: 'grazing' } as const;
    const first = recommendBreeds(input).map((r) => r.breed.id + ':' + r.score);
    const second = recommendBreeds(input).map((r) => r.breed.id + ':' + r.score);
    expect(first).toEqual(second);
  });

  it('ranks a matching purpose above a non-matching one', () => {
    const wool = recommendBreeds({ altitude: 'high', purpose: 'wool', mode: 'grazing' });
    const woolBreedId = wool[0]?.breed.id;
    const meat = recommendBreeds({ altitude: 'high', purpose: 'meat', mode: 'grazing' });
    if (woolBreedId) {
      const woolAsMeat = meat.find((r) => r.breed.id === woolBreedId);
      // 毛用首选的品种在肉用查询中要么不进榜，要么评分低于毛用榜首位
      if (woolAsMeat) expect(woolAsMeat.score).toBeLessThan(wool[0].score);
    }
  });
});
