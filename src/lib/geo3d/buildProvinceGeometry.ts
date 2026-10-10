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
  /** 平面包围盒：`mainland` 排除南海诸岛远端环（取景用），`all` 含全部保留环 */
  bounds: { mainland: PlaneBounds | null; all: PlaneBounds | null };
}

/** 平面坐标下的轴对齐包围盒（局部 x/y，未挤出）。 */
export interface PlaneBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

/**
 * 南海诸岛在平面坐标里位于主体以南很远（纬度约 4°N），若把它计入取景，
 * 整幅中国会被压成一条细带。因此按纬度阈值把远端环排除出「主体」包围盒，
 * 只用于**取景**；几何本身照旧完整渲染（不裁数据）。
 */
export const MAINLAND_MIN_LAT = 18;

/** 平面局部 y（世界单位）→ 纬度，用于判定环属于主体还是南海远端。 */
export function planeYToLat(y: number): number {
  const svgY = mapViewBox.height / 2 - y * PLANE_SCALE;
  return 54 - (svgY / mapViewBox.height) * 36;
}

const EMPTY_BOUNDS = (): PlaneBounds => ({ minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity });

const grow = (target: PlaneBounds, points: readonly [number, number][]) => {
  for (const [x, y] of points) {
    const wx = x / PLANE_SCALE;
    const wy = -y / PLANE_SCALE;
    if (wx < target.minX) target.minX = wx;
    if (wx > target.maxX) target.maxX = wx;
    if (wy < target.minY) target.minY = wy;
    if (wy > target.maxY) target.maxY = wy;
  }
};

const isFiniteBounds = (bounds: PlaneBounds) => Number.isFinite(bounds.minX) && Number.isFinite(bounds.minY);

/** 取景框：把省份包围盒并起来，输出观察中心与半径（不含挤出高度）。 */
export interface SceneFraming {
  center: [number, number];
  radius: number;
  /** true = 主体包围盒可用（有落到主体的省份） */
  usable: boolean;
}

export function measureSceneFraming(items: readonly ProvinceGeometry[]): SceneFraming {
  const union = EMPTY_BOUNDS();
  for (const item of items) {
    const box = item.bounds.mainland ?? item.bounds.all;
    if (!box) continue;
    union.minX = Math.min(union.minX, box.minX);
    union.maxX = Math.max(union.maxX, box.maxX);
    union.minY = Math.min(union.minY, box.minY);
    union.maxY = Math.max(union.maxY, box.maxY);
  }
  if (!isFiniteBounds(union)) return { center: [0, 0], radius: 5, usable: false };
  return {
    center: [(union.minX + union.maxX) / 2, (union.minY + union.maxY) / 2],
    radius: Math.max(union.maxX - union.minX, union.maxY - union.minY) / 2,
    usable: true,
  };
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
      const only = rings[0]?.points ?? [];
      const bounds = EMPTY_BOUNDS();
      if (only.length) grow(bounds, only);
      return {
        fullName,
        simpleName,
        ringCount: 0,
        holeCount: 0,
        droppedNoise,
        degraded: true,
        geometry: null,
        center: ringCenter(only),
        bounds: { mainland: null, all: isFiniteBounds(bounds) ? bounds : null },
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

    // 包围盒：all = 全部保留环；mainland = 排除南海远端环（仅用于取景）
    const all = EMPTY_BOUNDS();
    const mainland = EMPTY_BOUNDS();
    for (const ring of outers) {
      grow(all, ring.points);
      const inMainland = ring.points.some(([x, y]) => planeYToLat(-(y / PLANE_SCALE)) >= MAINLAND_MIN_LAT);
      if (inMainland) grow(mainland, ring.points);
    }

    return {
      fullName,
      simpleName,
      ringCount: outers.length,
      holeCount: holes.length,
      droppedNoise,
      degraded: false,
      geometry,
      center: ringCenter(outers[0].points),
      bounds: { mainland: isFiniteBounds(mainland) ? mainland : null, all },
    };
  });
}

/** 释放全部几何（场景卸载时调用，避免显存泄漏）。 */
export function disposeProvinceGeometries(items: readonly ProvinceGeometry[]): void {
  for (const item of items) item.geometry?.dispose();
}
