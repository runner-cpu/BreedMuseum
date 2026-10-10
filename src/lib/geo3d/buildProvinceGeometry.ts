import * as THREE from 'three';
import { provincePaths, mapViewBox, projectCoordinate } from '@/data/chinaMap';
import { parseSvgPathToRings } from './parseSvgPath';
import { partitionRings, pointInRing, ringCentroid } from './ringFilter';

/**
 * 省域几何装配：SVG 路径 → 环 → ExtrudeGeometry。
 *
 * 坐标约定（与参考实现一致）：XY 为地图平面（+Y 朝北），+Z 为挤出高度；
 * 调用方负责把 group 旋转到水平面。
 *
 * 界标（实测 2026-10）：
 * - 过滤后保留 47 个环、2875 点；福建省有 1 个孔洞；
 * - 澳门为纯退化图形 → `degraded: true`，由场景改为发光圆点 + 文本标签。
 */

/** 地图平面 → 世界单位（除以 100，使全国约 8.6 × 7.2 单位，与相机参数配套）。 */
const PLANE_SCALE = 100;

/** 挤出高度分档：按该行政区馆藏量。 */
export const EXTRUDE_STEPS = [0.05, 0.12, 0.2, 0.3] as const;

export interface ProvinceGeometry {
  /** 行政区全名（“内蒙古自治区”等，与 chinaMap 键一致） */
  fullName: string;
  /** 简化名（去“省/市/自治区”等后缀，与品种数据的 province 字段一致） */
  simpleName: string;
  /** 过滤后保留的外环数（含飞地岛） */
  ringCount: number;
  /** 孔洞数 */
  holeCount: number;
  /** 被面积过滤丢弃的噪声环数 */
  droppedNoise: number;
  /** true = 无有效环（如澳门），需场景降级为圆点 */
  degraded: boolean;
  geometry: THREE.ExtrudeGeometry | null;
  /** 地图平面坐标下的质心（世界单位，供摄像机与标签定位） */
  center: [number, number];
}

export const simplifyProvinceName = (fullName: string): string =>
  fullName.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '');

/** 与 chinaMap.projectCoordinate 同域，再缩放到世界单位。 */
export function project3D(lon: number, lat: number): [number, number] {
  const { x, y } = projectCoordinate(lon, lat);
  return [(x - mapViewBox.width / 2) / PLANE_SCALE, -(y - mapViewBox.height / 2) / PLANE_SCALE];
}

/** 该行政区路径的质心（无有效环时回退到视图中心附近）。 */
function ringCenter(points: readonly [number, number][]): [number, number] {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
  }
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return [(cx - mapViewBox.width / 2) / PLANE_SCALE, -(cy - mapViewBox.height / 2) / PLANE_SCALE];
}

/** 按馆藏量为单个行政区选择挤出高度。 */
export function extrudeHeightFor(count: number): number {
  if (count <= 0) return EXTRUDE_STEPS[0];
  if (count <= 20) return EXTRUDE_STEPS[1];
  if (count <= 40) return EXTRUDE_STEPS[2];
  return EXTRUDE_STEPS[3];
}

/**
 * 构建全部行政区的几何。
 *
 * @param countByProvince 简化省名 → 馆藏量（用于挤出分档；缺省按 0）
 */
export function buildProvinceGeometries(
  countByProvince: ReadonlyMap<string, number>,
): ProvinceGeometry[] {
  return Object.entries(provincePaths).map(([fullName, d]) => {
    const simpleName = simplifyProvinceName(fullName);
    const rings = parseSvgPathToRings(d);
    const { outers, holes, droppedNoise } = partitionRings(rings);

    if (outers.length === 0) {
      return {
        fullName,
        simpleName,
        ringCount: 0,
        holeCount: 0,
        droppedNoise,
        degraded: true,
        geometry: null,
        center: ringCenter(rings[0]?.points ?? []),
      };
    }

    const shapes = outers.map((outer) => {
      const shape = new THREE.Shape(outer.points.map(([x, y]) => new THREE.Vector2(x / PLANE_SCALE, -y / PLANE_SCALE)));
      for (const hole of holes) {
        // 孔洞只挂到“包含其质心”的那个外环，否则会把内地洞挖进沿海飞地
        const centroid = ringCentroid(hole.points);
        if (!Number.isFinite(centroid[0]) || !pointInRing(centroid, outer.points)) continue;
        shape.holes.push(new THREE.Path(hole.points.map(([x, y]) => new THREE.Vector2(x / PLANE_SCALE, -y / PLANE_SCALE))));
      }
      return shape;
    });

    const depth = extrudeHeightFor(countByProvince.get(simpleName) ?? 0);
    const geometry = new THREE.ExtrudeGeometry(shapes, {
      depth,
      bevelEnabled: false,
      curveSegments: 1,
    });
    geometry.computeVertexNormals();

    return {
      fullName,
      simpleName,
      ringCount: outers.length,
      holeCount: holes.length,
      droppedNoise,
      degraded: false,
      geometry,
      center: ringCenter(outers[0].points),
    };
  });
}

/** 释放全部几何（场景卸载时调用，避免显存泄漏）。 */
export function disposeProvinceGeometries(items: readonly ProvinceGeometry[]): void {
  for (const item of items) item.geometry?.dispose();
}
