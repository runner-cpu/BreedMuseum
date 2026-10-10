import { describe, expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { hasVerifiedCoordinates } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import {
  MAX_BEAM_HEIGHT,
  SITE_CLUSTER_RADIUS,
  beamHeightFor,
  beamRadiusFor,
  beamSegmentsFor,
  buildSiteClusters,
  clustersForLens,
  hitRadiusFor,
  markerRadiusFor,
} from '../clusterSites';

/**
 * 产区聚合与光束尺寸契约。
 *
 * 触发这一组断言的两轮真实故障：
 * 1. 1,062 条记录只落在 509 个坐标上，102 个坐标挤了 655 条，最大的一个坐标有 45 条。
 *    上一版把同坐标记录按固定角度铺在半径 0.07–0.18 的圆上，45 条被画成精确的圆环
 *    ——页面上满是「围成圈的点」。所以现在锁死覆盖率、偏移上限、确定性。
 * 2. 修完圆环之后又走过头：为了让类别分段看得清，尺寸函数被放大到半径 0.055–0.295、
 *    高度 0.22–1.6，比例成了矮胖圆柱，整片光图从「光」变成了「插了一地木栓」。
 *    所以这里额外锁死**细长比**：光束必须细而高，且高过省块挤出上限。
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
});

describe('标记与光束尺寸', () => {
  test('2D 标记半径随记录数单调增长，且都在可读区间内', () => {
    const radius = [1, 5, 20, 53].map(markerRadiusFor);
    expect(radius).toEqual([...radius].sort((a, b) => a - b));
    expect(radius[0]).toBeGreaterThan(0.05);
    expect(radius[3]).toBeLessThan(0.4);
  });

  test('3D 光束必须细而高：细长比撑得起「光」，高度高过省块挤出上限', () => {
    const totals = [1, 5, 20, 45, 64];

    const widths = totals.map(beamRadiusFor);
    const heights = totals.map(beamHeightFor);
    expect(widths).toEqual([...widths].sort((a, b) => a - b));
    expect(heights).toEqual([...heights].sort((a, b) => a - b));

    // 细：屏幕上仍是细线，最粗也不过 0.05 世界单位（≈ 屏幕上 6–10 像素）
    expect(widths[0]).toBeLessThan(0.015);
    expect(widths[widths.length - 1]).toBeLessThan(0.05);

    // 高：最高的省块挤出是 0.39（EXTRUDE_STEPS 上限），光束必须明显高过它，
    // 否则整片光场又会缩回「地图上插了几个土墩」
    expect(Math.min(...heights)).toBeGreaterThan(0.6);
    expect(Math.max(...heights)).toBeLessThan(1.5);
    expect(MAX_BEAM_HEIGHT).toBeCloseTo(heights[heights.length - 1], 6);

    // 细长比：整片光场最胖的那束也不能低于 1 : 14，最细的那束要 ≥ 1 : 25。
    // 上一版这里只有 1 : 1.5（半径 0.295 / 高 0.9），所以才像木栓而不像光。
    for (let index = 0; index < totals.length; index += 1) {
      expect(heights[index] / (widths[index] * 2), `total=${totals[index]}`).toBeGreaterThanOrEqual(14);
    }
    expect(heights[0] / (widths[0] * 2), '最细那束').toBeGreaterThanOrEqual(25);
  });

  test('拾取半径盖得住光束本体，且不会吞掉邻簇', () => {
    for (const cluster of buildSiteClusters()) {
      const beam = beamRadiusFor(cluster.total);
      const hit = hitRadiusFor(cluster.total);
      expect(hit, cluster.id).toBeGreaterThan(beam);
      expect(hit, cluster.id).toBeLessThan(0.35);
    }
    // 2 像素宽的光束：命中半径必须靠绝对下限兜住，不能跟束身等比
    expect(hitRadiusFor(1)).toBeGreaterThanOrEqual(0.085);
  });

  test('束身分段只切分高度，不改变整束高度', () => {
    for (const cluster of buildSiteClusters()) {
      const segments = beamSegmentsFor(cluster);
      expect(segments.length).toBeGreaterThan(0);
      expect(segments.length).toBeLessThanOrEqual(7);

      const tops = segments[segments.length - 1];
      expect(tops.from + tops.height, cluster.id).toBeCloseTo(beamHeightFor(cluster.total), 6);

      const counted = segments.reduce((sum, segment) => sum + segment.count, 0);
      expect(counted, cluster.id).toBe(cluster.total);

      // 段段相接，不留缝也不重叠（留缝会在光束上出现一条黑线）
      let cursor = 0;
      for (const segment of segments) {
        expect(segment.from, cluster.id).toBeCloseTo(cursor, 6);
        cursor += segment.height;
      }
    }
  });

  test('镜头筛选只减少分段数量，不改变可见簇的高度与位置', () => {
    // 「濒危之窗」下每个簇只剩少数记录。高度必须由**筛选前的整簇**（`baseTotal`）决定，
    // 否则同一根光束在换镜头时会突然变矮，观众会以为是另一张图。
    const clusters = buildSiteClusters();
    const risky = clustersForLens(clusters, 'risk', null);
    const allById = new Map(clusters.map((cluster) => [cluster.id, cluster]));
    expect(risky.length).toBeGreaterThan(0);
    expect(risky.length).toBeLessThan(clusters.length);

    for (const cluster of risky) {
      const before = allById.get(cluster.id);
      expect(before, cluster.id).toBeDefined();
      // 筛选后的记录数不可能变多
      expect(cluster.total, cluster.id).toBeLessThanOrEqual(before!.total);
      // 位置不变
      expect(cluster.position).toEqual(before!.position);
      // baseTotal 穿透筛选 → 束身总高仍等于全量口径的高度
      expect(cluster.baseTotal, cluster.id).toBe(before!.total);
      const segments = beamSegmentsFor(cluster);
      const top = segments[segments.length - 1];
      expect(top.from + top.height, cluster.id).toBeCloseTo(beamHeightFor(before!.total), 6);
      // 半径同样不随镜头变
      expect(beamRadiusFor(cluster.baseTotal), cluster.id).toBeCloseTo(beamRadiusFor(before!.total), 9);
    }

    // 而且确实发生了收缩：多数可见簇的记录数比全量时少
    const shrunk = risky.filter((cluster) => cluster.total < allById.get(cluster.id)!.total).length;
    expect(shrunk).toBeGreaterThan(risky.length / 2);
  });
});
