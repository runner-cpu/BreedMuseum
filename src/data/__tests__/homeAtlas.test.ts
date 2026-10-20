import { describe, expect, it } from 'vitest';
import {
  HOME_ATLAS_CHIPS,
  HOME_ATLAS_PROVINCES,
  HOME_ATLAS_SITES,
  HOME_ATLAS_TOTALS,
} from '@/data/homeAtlas';
import { visibleBreeds } from '@/data/visibleBreeds';
import { buildSiteClusters } from '@/lib/geo/clusterSites';
import { buildDigest } from '@/lib/geo/lightMapData';
import { mapViewBox } from '@/data/chinaMap';
import { compareText } from '@/lib/compareText';

/**
 * 首页首屏画的是预计算常量，不是运行时聚合。这份契约把两边钉在一起：
 * 数据批次一更新、聚合半径一改，首页就会先在测试里红，而不是悄悄
 * 显示上一批数字——赛道评审最忌讳的正是「页面数字与档案对不上」。
 */
describe('home atlas matches the runtime collection', () => {
  const digest = buildDigest(visibleBreeds);
  const clusters = buildSiteClusters(visibleBreeds);
  const provinces = digest.provinces
    .filter((entry) => entry.province !== '待核验' && entry.mappable > 0)
    .sort((a, b) => b.mappable - a.mappable || compareText(a.province, b.province));

  it('lists every province with mapped records, in the same order', () => {
    expect(HOME_ATLAS_PROVINCES.map((entry) => entry.name)).toEqual(provinces.map((entry) => entry.province));
  });

  it('carries the exact per-province totals, protection and risk counts', () => {
    for (const [index, entry] of HOME_ATLAS_PROVINCES.entries()) {
      const source = provinces[index];
      expect(entry.total, entry.name).toBe(source.mappable);
      expect(entry.protected, entry.name).toBe(source.nationalProtected);
      expect(entry.endangered, entry.name).toBe(source.endangered);
      expect(entry.categories, entry.name).toHaveLength(3);
    }
  });

  it('draws every verified site at the projected coordinate', () => {
    const order = new Map(HOME_ATLAS_PROVINCES.map((entry, index) => [entry.name, index]));
    const expected = clusters
      .filter((cluster) => order.has(cluster.province))
      .map((cluster) => [
        order.get(cluster.province) as number,
        Math.round(mapViewBox.width / 2 + cluster.position[0] * 100),
        Math.round(mapViewBox.height / 2 - cluster.position[1] * 100),
        cluster.total,
        cluster.members.filter((member) => member.protectedByNationalList).length,
        cluster.members.filter((member) => member.endangeredEditorial).length,
      ]);

    expect(HOME_ATLAS_SITES.map((site) => [...site])).toEqual(expected);
  });

  it('summarises the same totals the map and the dashboard quote', () => {
    expect(HOME_ATLAS_TOTALS.records).toBe(clusters.reduce((sum, cluster) => sum + cluster.total, 0));
    expect(HOME_ATLAS_TOTALS.sites).toBe(clusters.length);
    expect(HOME_ATLAS_TOTALS.provinces).toBe(provinces.length);
    expect(HOME_ATLAS_TOTALS.protected).toBe(
      clusters.reduce(
        (sum, cluster) => sum + cluster.members.filter((member) => member.protectedByNationalList).length,
        0,
      ),
    );
    expect(HOME_ATLAS_TOTALS.endangered).toBe(
      clusters.reduce(
        (sum, cluster) => sum + cluster.members.filter((member) => member.endangeredEditorial).length,
        0,
      ),
    );
  });

  it('offers three real, illustrated breeds per province', () => {
    expect(HOME_ATLAS_CHIPS).toHaveLength(HOME_ATLAS_PROVINCES.length);

    for (const [index, entry] of HOME_ATLAS_PROVINCES.entries()) {
      const chips = HOME_ATLAS_CHIPS[index];
      expect(chips.length, entry.name).toBeGreaterThan(0);
      expect(chips.length, entry.name).toBeLessThanOrEqual(3);

      for (const [id, name, englishName] of chips) {
        const breed = visibleBreeds.find((item) => item.id === id);
        expect(breed, `${entry.name} / ${id}`).toBeDefined();
        expect(breed!.province).toBe(entry.name);
        expect(breed!.name).toBe(name);
        expect(breed!.englishName).toBe(englishName);
      }
    }
  });
});
