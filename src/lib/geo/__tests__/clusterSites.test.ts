import { describe, expect, it } from 'vitest';
import type { Breed } from '@/data/breeds';
import { visibleBreeds, visibleCategories } from '@/data/visibleBreeds';
import {
  buildSiteClusters,
  clustersForLens,
  SITE_CLUSTER_RADIUS,
  type SiteCluster,
} from '@/lib/geo/clusterSites';

const membersOf = (clusters: readonly SiteCluster[]) =>
  clusters.flatMap((cluster) => cluster.members);

const idsOf = (clusters: readonly SiteCluster[]) =>
  new Set(membersOf(clusters).map((member) => member.id));

/**
 * 类别与镜头是两条正交轴。这里锁定的是组合语义而不是某个具体数字：
 * 类别筛选必须与镜头取交集，任何镜头下都不能被静默忽略。
 */
describe('clustersForLens combines category with the active lens', () => {
  const clusters = buildSiteClusters(visibleBreeds);

  it('category narrows every lens, not only the legacy "category" lens', () => {
    for (const category of visibleCategories) {
      const scoped = idsOf(clustersForLens(clusters, 'all', category));
      expect(scoped.size, category).toBeGreaterThan(0);

      for (const member of membersOf(clustersForLens(clusters, 'all', category))) {
        expect(member.category, category).toBe(category);
      }
      // 镜头叠加后只能是该类别集合的子集，不能凭空多出其他畜种
      for (const lens of ['protect', 'risk'] as const) {
        for (const member of membersOf(clustersForLens(clusters, lens, category))) {
          expect(member.category, `${category} + ${lens}`).toBe(category);
        }
      }
    }
  });

  it('keeps protect and risk results as subsets of the unfiltered lens', () => {
    const protectAll = idsOf(clustersForLens(clusters, 'protect', null));
    const riskAll = idsOf(clustersForLens(clusters, 'risk', null));
    for (const category of visibleCategories) {
      for (const id of idsOf(clustersForLens(clusters, 'protect', category))) {
        expect(protectAll.has(id), `${category} + protect`).toBe(true);
      }
      for (const id of idsOf(clustersForLens(clusters, 'risk', category))) {
        expect(riskAll.has(id), `${category} + risk`).toBe(true);
      }
    }
  });

  it('drops clusters that have no member left after the intersection', () => {
    for (const category of visibleCategories) {
      for (const lens of ['protect', 'risk'] as const) {
        const visible = clustersForLens(clusters, lens, category);
        for (const cluster of visible) {
          expect(cluster.members.length, `${category} + ${lens}`).toBeGreaterThan(0);
          expect(cluster.total).toBe(cluster.members.length);
        }
      }
    }
  });

  it('returns nothing for a combination that has no records', () => {
    // 鸭 + 濒危之窗：当前馆藏里没有任何一条鸭记录带濒危/极危标注。
    // 这条断言把“空组合要有空态”的行为固定在数据层，页面只需要照实渲染。
    expect(clustersForLens(clusters, 'risk', '鸭')).toEqual([]);
  });

  it('never lets the legacy "category" lens change the displayed set', () => {
    for (const category of visibleCategories) {
      expect(clustersForLens(clusters, 'category', category).map((cluster) => cluster.id))
        .toEqual(clustersForLens(clusters, 'all', category).map((cluster) => cluster.id));
    }
  });
});

describe('buildSiteClusters invariants', () => {
  it('places every verified record exactly once', () => {
    const placed = membersOf(buildSiteClusters(visibleBreeds));
    const ids = placed.map((member) => member.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.length).toBe(visibleBreeds.length);
  });

  it('keeps every member within the clustering radius of its centre', () => {
    for (const cluster of buildSiteClusters(visibleBreeds)) {
      expect(cluster.radius).toBeLessThanOrEqual(SITE_CLUSTER_RADIUS + 1e-9);
    }
  });

  it('is independent of input order', () => {
    const reversed = [...visibleBreeds].reverse();
    expect(buildSiteClusters(reversed).map((cluster) => cluster.id))
      .toEqual(buildSiteClusters(visibleBreeds).map((cluster) => cluster.id));
  });

  it('skips records without verified coordinates', () => {
    const pending: Breed = {
      id: 'pending-site',
      name: '待核验产区样本',
      englishName: 'Pending site sample',
      province: '待核验',
      longitude: 0,
      latitude: 0,
      category: '其他',
      endangered: '待核验',
      appearance: '',
      performance: '',
      radar: { meat: null, milk: null, reproduction: null, labor: null, adaptability: null },
      story: '',
      image: '',
    };
    expect(buildSiteClusters([pending])).toEqual([]);
  });
});
