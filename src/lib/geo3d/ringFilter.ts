import type { Ring2D } from './parseSvgPath';

/**
 * 环的净化与孔洞判定。
 *
 * 实测（2026-10，`src/data/chinaMap.ts` 34 条省域路径、3064 点）：
 * - 63 个子路径面积为 0（三点共线等噪声），会破坏 ExtrudeGeometry；
 * - 仅 1 个真孔洞（福建省第 3 子路径）；
 * - 澳门为纯退化图形（两条子路径面积均为 0）。
 *
 * 因此规则固定为：面积过滤（EPS=0.5）→ 质心 point-in-polygon 判孔 → 退化省降级。
 */

/** 面积过滤阈值：低于该值的环视为噪声（实测 0.5 可滤净 63 个零面积环）。 */
export const RING_AREA_EPSILON = 0.5;

/** 有向面积（外环正负取决于绕向，这里只关心绝对值）。 */
export function ringArea(points: readonly [number, number][]): number {
  let sum = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    sum += points[j][0] * points[i][1] - points[i][0] * points[j][1];
  }
  return Math.abs(sum / 2);
}

/** 面积形的质心（用于孔洞判定，退化环返回 NaN 由调用方过滤）。 */
export function ringCentroid(points: readonly [number, number][]): [number, number] {
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const cross = points[j][0] * points[i][1] - points[i][0] * points[j][1];
    area += cross;
    cx += (points[j][0] + points[i][0]) * cross;
    cy += (points[j][1] + points[i][1]) * cross;
  }
  area *= 0.5;
  if (area === 0) return [Number.NaN, Number.NaN];
  return [cx / (6 * area), cy / (6 * area)];
}

/** 射线法 point-in-polygon（多边形首尾无需重复）。 */
export function pointInRing(point: readonly [number, number], polygon: readonly [number, number][]): boolean {
  const [x, y] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

export interface RingPartition {
  /** 外环（保留原绕向，三角化时由 Shape 自行处理）。 */
  outers: Ring2D[];
  /** 孔洞环（质心落在某个外环内）。 */
  holes: Ring2D[];
  /** 被面积过滤丢弃的环数量（用于审计与日志）。 */
  droppedNoise: number;
}

/**
 * 把一个行政区的环集合拆成外环与孔洞。
 *
 * 判定用**质心 point-in-polygon**（实测 bbox 包含法会产生 22 个误判）。
 * 孔洞只认“质心落在另一外环内”的环，其余（含飞地岛）全部作为外环。
 */
export function partitionRings(rings: readonly Ring2D[]): RingPartition {
  const kept = rings.filter((ring) => ringArea(ring.points) > RING_AREA_EPSILON);
  const droppedNoise = rings.length - kept.length;

  const holes: Ring2D[] = [];
  const outers: Ring2D[] = [];

  kept.forEach((ring, index) => {
    const centroid = ringCentroid(ring.points);
    const isHole =
      Number.isFinite(centroid[0]) &&
      kept.some((other, otherIndex) => otherIndex !== index && pointInRing(centroid, other.points));
    if (isHole) holes.push(ring);
    else outers.push(ring);
  });

  return { outers, holes, droppedNoise };
}
