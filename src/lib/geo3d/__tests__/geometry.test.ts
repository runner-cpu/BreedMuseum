import { describe, expect, test } from 'vitest';
import { provincePaths, mapViewBox, projectCoordinate } from '@/data/chinaMap';
import { parseSvgPathToRings } from '../parseSvgPath';
import { partitionRings, ringArea } from '../ringFilter';
import {
  buildProvinceGeometries,
  disposeProvinceGeometries,
  extrudeHeightFor,
  measureSceneFraming,
  project3D,
  simplifyProvinceName,
} from '../buildProvinceGeometry';

/**
 * 几何管线契约（对真实 chinaMap 数据，2026-10 实测）：
 * - 34 条路径、命令集仅 M/L/Z，共 329 个子路径 / 3283 点；
 * - 282 个子路径面积为 0（退化为点或线），面积过滤后保留 47 环 / 2875 点；
 * - 仅 1 个真孔洞（福建省）；
 * - 澳门为退化区，需由场景降级为圆点。
 */

test('parser handles every province path without throwing', () => {
  for (const [name, d] of Object.entries(provincePaths)) {
    const rings = parseSvgPathToRings(d);
    expect(rings.length, name).toBeGreaterThan(0);
    for (const ring of rings) {
      expect(ring.points.length, name).toBeGreaterThanOrEqual(1);
    }
  }
});

test('parser rejects unsupported SVG commands loudly', () => {
  expect(() => parseSvgPathToRings('M 0,0 C 1,1 2,2 3,3')).toThrow(/不支持的 SVG 命令/);
});

test('noise filtering drops zero-area rings and yields the audited totals', () => {
  let kept = 0;
  let dropped = 0;
  let points = 0;

  for (const d of Object.values(provincePaths)) {
    const rings = parseSvgPathToRings(d);
    const { outers, holes, droppedNoise } = partitionRings(rings);
    kept += outers.length + holes.length;
    dropped += droppedNoise;
    points += [...outers, ...holes].reduce((sum, ring) => sum + ring.points.length, 0);
  }

  // 实测：329 个子路径 / 3283 点原始 → 过滤后 282 个零面积子路径被丢弃，保留 47 环 / 2875 点
  expect(dropped).toBe(282);
  expect(kept).toBe(47);
  expect(points).toBe(2875);
});

test('only Fujian carries a real hole (centroid inside another ring)', () => {
  const holesByProvince = Object.entries(provincePaths)
    .map(([name, d]) => {
      const { holes } = partitionRings(parseSvgPathToRings(d));
      return { name, holes: holes.length };
    })
    .filter((entry) => entry.holes > 0);

  expect(holesByProvince).toHaveLength(1);
  expect(holesByProvince[0]).toEqual({ name: '福建省', holes: 1 });
});

test('Macau is a fully degenerate path and stays out of extrusion', () => {
  const rings = parseSvgPathToRings(provincePaths['澳门特别行政区']);
  expect(rings.every((ring) => ringArea(ring.points) <= 0.5)).toBe(true);

  const built = buildProvinceGeometries(new Map());
  const macau = built.find((item) => item.fullName === '澳门特别行政区');
  expect(macau?.degraded).toBe(true);
  expect(macau?.geometry).toBeNull();
  // 其余 33 个行政区全部可挤出
  expect(built.filter((item) => !item.degraded)).toHaveLength(33);
  disposeProvinceGeometries(built);
});

test('extruded geometries carry vertices and follow the ranked heights', () => {
  const counts = new Map([
    ['云南', 60],
    ['青海', 25],
    ['上海', 6],
    ['北京', 0],
  ]);
  const built = buildProvinceGeometries(counts);
  const pick = (name: string) => built.find((item) => item.simpleName === name)!;

  for (const item of built) {
    if (item.degraded) continue;
    expect(item.geometry!.attributes.position.count, item.fullName).toBeGreaterThan(0);
  }

  const heights = [pick('北京'), pick('上海'), pick('青海'), pick('云南')].map((item) => {
    const position = item.geometry!.attributes.position;
    let max = -Infinity;
    for (let i = 0; i < position.count; i += 1) max = Math.max(max, position.getZ(i));
    return max;
  });
  expect(heights[0]).toBeCloseTo(extrudeHeightFor(0), 5);
  expect(heights).toEqual([...heights].sort((a, b) => a - b));
  disposeProvinceGeometries(built);
});

test('projection stays consistent with the 2D map and centres on the origin', () => {
  const { x, y } = projectCoordinate(104, 35);
  const [wx, wy] = project3D(104, 35);
  expect(wx).toBeCloseTo((x - mapViewBox.width / 2) / 100, 9);
  expect(wy).toBeCloseTo(-(y - mapViewBox.height / 2) / 100, 9);
  // 北京在世界坐标里位于东偏北（x > 0 且 y > 0）
  const [bx, by] = project3D(116.4, 39.9);
  expect(bx).toBeGreaterThan(0);
  expect(by).toBeGreaterThan(0);
});

test('province geometry and pillar projection share one plane origin', () => {
  // 回归防护：省块几何曾用 SVG 画布像素空间（左上为原点），光柱用视图中心为原点，
  // 两者相差半张图（实测 5.05, −5.23）——症状是「版图缩成一个小点、外面一大片空白」。
  // 这里把投影四角与省块主体包围盒放进同一个参照系比对，漏掉 toPlane() 立刻失败。
  const built = buildProvinceGeometries(new Map());
  const framing = measureSceneFraming(built);
  expect(framing.usable).toBe(true);
  const box = framing.box!;

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [lon, lat] of [
    [73, 54],
    [135, 54],
    [73, 18],
    [135, 18],
  ]) {
    const [x, y] = project3D(lon, lat);
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }

  // 投影四角与省块主体包围盒必须落在同一片区域（容差 0.2 世界单位）
  expect(Math.abs(minX - box.minX)).toBeLessThan(0.2);
  expect(Math.abs(maxX - box.maxX)).toBeLessThan(0.2);
  expect(Math.abs(minY - box.minY)).toBeLessThan(0.2);
  expect(Math.abs(maxY - box.maxY)).toBeLessThan(0.2);
  // 版图中心贴近原点（= 视图中心），而不是偏在画布一角
  expect(Math.abs(framing.center[0])).toBeLessThan(0.3);
  expect(Math.abs(framing.center[1])).toBeLessThan(0.3);
  expect(framing.radius).toBeGreaterThan(4.5);
  disposeProvinceGeometries(built);
});

test('province name simplification matches the dataset vocabulary', () => {
  expect(simplifyProvinceName('内蒙古自治区')).toBe('内蒙古');
  expect(simplifyProvinceName('广西壮族自治区')).toBe('广西');
  expect(simplifyProvinceName('新疆维吾尔自治区')).toBe('新疆');
  expect(simplifyProvinceName('香港特别行政区')).toBe('香港');
  expect(simplifyProvinceName('青海省')).toBe('青海');
});

describe('geometry memory hygiene', () => {
  test('disposal runs without throwing on degraded entries', () => {
    const built = buildProvinceGeometries(new Map());
    expect(() => disposeProvinceGeometries(built)).not.toThrow();
  });
});
