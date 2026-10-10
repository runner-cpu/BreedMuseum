import { describe, expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { hasVerifiedCoordinates } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import {
  SITE_CLUSTER_RADIUS,
  buildSiteClusters,
  hitRadiusFor,
  markerRadiusFor,
  stackHeightFor,
} from '../clusterSites';

/**
 * 产区聚合契约。
 *
 * 触发这一组断言的真实故障：1,062 条记录只落在 509 个坐标上，102 个坐标挤了 655 条，
 * 最大的一个坐标有 45 条。上一版把同坐标记录按固定角度铺在半径 0.07–0.18 的圆上，
 * 结果 45 条记录被画成精确的圆环——页面上满是「围成圈的点」。
 *
 * 现在锁死三件事：覆盖率、偏移上限、确定性。
 */

const mappable = breeds.filter(hasVerifiedCoordinates);

describe('产区聚合', () => {
  test('每条可落点记录恰好出现一次，且总数等于审计口径', () => {
    const clusters = buildSiteClusters();
    const ids = clusters.flatMap((cluster) => cluster.members.map((member) => member.id));
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toHaveLength(mappable.length);
    expect(ids).toHaveLength(COLLECTION_SUMMARY.mappable);

    const expected = new Set(mappable.map((breed) => breed.id));
    for (const id of ids) expect(expected.has(id), id).toBe(true);
  });

  test('每个成员到簇中心的距离不超过聚合半径（不会把远处的坐标硬并）', () => {
    const clusters = buildSiteClusters();
    let worst = 0;
    for (const cluster of clusters) {
      expect(cluster.radius, cluster.id).toBeLessThanOrEqual(SITE_CLUSTER_RADIUS + 1e-6);
      worst = Math.max(worst, cluster.radius);
    }
    // 实测：确实有簇接近上限（密集省份），所以上限不是摆设
    expect(worst).toBeGreaterThan(SITE_CLUSTER_RADIUS * 0.8);
  });

  test('簇数量显著少于原始坐标数（聚合真的发生了，不是换个名字画点）', () => {
    const seeds = new Set(
      mappable.map((breed) => `${breed.longitude.toFixed(3)},${breed.latitude.toFixed(3)}`),
    );
    const clusters = buildSiteClusters();
    expect(seeds.size).toBe(509);
    // 509 个坐标 → 一百多个簇；成都那一片（45 条 / 5 个坐标）并成一个
    expect(clusters.length).toBeLessThan(seeds.size * 0.4);
    expect(clusters.filter((cluster) => cluster.seedCount > 1).length).toBeGreaterThan(50);
    expect(Math.max(...clusters.map((cluster) => cluster.seedCount))).toBeGreaterThanOrEqual(4);
    // 单个坐标就占满的簇也存在（新疆 87.6,43.8 那类）
    expect(clusters.filter((cluster) => cluster.seedCount === 1).length).toBeGreaterThan(20);
  });

  test('分类切片与实际成员一致，且含保护 / 濒危标记取并集', () => {
    for (const cluster of buildSiteClusters()) {
      const sliceTotal = cluster.slices.reduce((sum, slice) => sum + slice.count, 0);
      expect(sliceTotal, cluster.id).toBe(cluster.total);
      expect(cluster.slices.length).toBeGreaterThan(0);
      // count 降序、同 count 按类别名升序
      const sorted = [...cluster.slices].sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
      expect(cluster.slices).toEqual(sorted);

      expect(cluster.hasNationalProtected).toBe(
        cluster.members.some((member) => member.protectedByNationalList),
      );
      expect(cluster.hasEndangered).toBe(cluster.members.some((member) => member.endangeredEditorial));
    }
  });

  test('输出与输入顺序无关，且可重复', () => {
    const first = buildSiteClusters();
    const second = buildSiteClusters();
    const reversed = buildSiteClusters([...breeds].reverse());
    expect(first).toEqual(second);
    expect(reversed.map((cluster) => cluster.id)).toEqual(first.map((cluster) => cluster.id));
    expect(reversed.map((cluster) => cluster.total)).toEqual(first.map((cluster) => cluster.total));
  });

  test('标记尺寸随记录数单调增长，且都在可读区间内', () => {
    const radius = [1, 5, 20, 53].map(markerRadiusFor);
    expect(radius).toEqual([...radius].sort((a, b) => a - b));
    expect(radius[0]).toBeGreaterThan(0.05);
    expect(radius[3]).toBeLessThan(0.4);

    const heights = [1, 5, 20, 53].map(stackHeightFor);
    expect(heights).toEqual([...heights].sort((a, b) => a - b));
    expect(heights[0]).toBeGreaterThan(0.2);
    expect(heights[3]).toBeLessThan(3);

    // 拾取半径必须盖住标记本体，否则点不中自己画出来的圆；上限防止吞掉邻簇
    for (const cluster of buildSiteClusters()) {
      const marker = markerRadiusFor(cluster.total);
      const hit = hitRadiusFor(cluster);
      expect(hit, cluster.id).toBeGreaterThan(marker);
      expect(hit, cluster.id).toBeLessThan(0.35);
    }
  });
});
