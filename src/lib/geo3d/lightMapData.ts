import { breeds as allBreeds, type Breed } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { categories } from '@/data/catalog';
import { project3D } from './buildProvinceGeometry';

/**
 * 光图数据装配（纯函数，可在无 WebGL 环境下单测）。
 *
 * 约定：
 * - 只保留 `province !== '待核验'` 且坐标非哨兵 (0,0) 的记录（与 `hasVerifiedCoordinates` 同口径）；
 * - 同一坐标的多条记录按确定性角度均匀铺开（与 2D 地图既有的聚合偏移算法一致），
 *   排序键为 id，保证每次刷新位置不变；
 * - 光柱高度按该点记录数轻微抬升，上限 8 条（防止视觉失衡）。
 */

export interface PillarInstance {
  id: string;
  name: string;
  category: string;
  province: string;
  /** 世界坐标（地图平面） */
  position: [number, number];
  /** 高度（世界单位） */
  height: number;
  /** 该坐标点的记录数 */
  groupSize: number;
  /** 国家级保护名录匹配 */
  protectedByNationalList: boolean;
  /** 编辑口径濒危 */
  endangeredEditorial: boolean;
}

export const hasMappableLocation = (breed: Breed): boolean =>
  breed.province !== '待核验' && !(breed.longitude === 0 && breed.latitude === 0);

/** 2D 地图的分组偏移（像素半径 7 + 0.45/条，上限 18），换算到世界单位除以 100。 */
const offsetRadius = (groupSize: number): number => Math.min(18, 7 + groupSize * 0.45) / 100;

export const PILLAR_BASE_HEIGHT = 0.1;
export const PILLAR_HEIGHT_STEP = 0.03;
export const PILLAR_MAX_GROUP = 8;

export function buildPillars(source: readonly Breed[] = allBreeds): PillarInstance[] {
  const mappable = source.filter(hasMappableLocation);
  const groups = new Map<string, Breed[]>();
  for (const breed of mappable) {
    const key = `${breed.longitude.toFixed(3)},${breed.latitude.toFixed(3)}`;
    const list = groups.get(key);
    if (list) list.push(breed);
    else groups.set(key, [breed]);
  }

  const instances: PillarInstance[] = [];
  for (const list of groups.values()) {
    const sorted = [...list].sort((a, b) => a.id.localeCompare(b.id));
    const [lon, lat] = [sorted[0].longitude, sorted[0].latitude];
    const [baseX, baseY] = project3D(lon, lat);
    const radius = offsetRadius(sorted.length);

    sorted.forEach((breed, index) => {
      const angle = (index / sorted.length) * Math.PI * 2 - Math.PI / 2;
      const spread = sorted.length === 1 ? 0 : radius;
      const metadata = getBreedMetadata(breed);
      instances.push({
        id: breed.id,
        name: breed.name,
        category: breed.category,
        province: breed.province,
        position: [baseX + Math.cos(angle) * spread, baseY + Math.sin(angle) * spread],
        height: PILLAR_BASE_HEIGHT + PILLAR_HEIGHT_STEP * Math.min(sorted.length, PILLAR_MAX_GROUP),
        groupSize: sorted.length,
        protectedByNationalList: metadata.protectionStatus === 'national-list',
        endangeredEditorial: breed.endangered === '濒危' || breed.endangered === '极危',
      });
    });
  }

  return instances.sort((a, b) => a.id.localeCompare(b.id));
}

/* ------------------------------------------------------------------ */
/* 省份与类别聚合（HUD、侧栏与无障碍摘要表共用）                        */
/* ------------------------------------------------------------------ */

export interface ProvinceDigest {
  province: string;
  total: number;
  mappable: number;
  nationalProtected: number;
  endangered: number;
  byCategory: Map<string, number>;
}

export interface CollectionDigest {
  provinces: ProvinceDigest[];
  byCategory: Map<string, number>;
  total: number;
  mappable: number;
  unverifiedLocation: number;
  nationalProtected: number;
  endangered: number;
}

export function buildDigest(source: readonly Breed[] = allBreeds): CollectionDigest {
  const provinceMap = new Map<string, ProvinceDigest>();
  const byCategory = new Map<string, number>();
  let nationalProtected = 0;
  let endangered = 0;
  let mappable = 0;
  let unverifiedLocation = 0;

  for (const breed of source) {
    byCategory.set(breed.category, (byCategory.get(breed.category) ?? 0) + 1);
    const metadata = getBreedMetadata(breed);
    const isProtected = metadata.protectionStatus === 'national-list';
    const isEndangered = breed.endangered === '濒危' || breed.endangered === '极危';
    if (isProtected) nationalProtected += 1;
    if (isEndangered) endangered += 1;
    if (hasMappableLocation(breed)) mappable += 1;
    else unverifiedLocation += 1;

    const province = breed.province === '待核验' ? '待核验' : breed.province;
    const entry = provinceMap.get(province) ?? {
      province,
      total: 0,
      mappable: 0,
      nationalProtected: 0,
      endangered: 0,
      byCategory: new Map<string, number>(),
    };
    entry.total += 1;
    if (hasMappableLocation(breed)) entry.mappable += 1;
    if (isProtected) entry.nationalProtected += 1;
    if (isEndangered) entry.endangered += 1;
    entry.byCategory.set(breed.category, (entry.byCategory.get(breed.category) ?? 0) + 1);
    provinceMap.set(province, entry);
  }

  const provinces = [...provinceMap.values()].sort((a, b) =>
    a.province === '待核验' ? 1 : b.province === '待核验' ? -1 : b.total - a.total,
  );

  return {
    provinces,
    byCategory,
    total: source.length,
    mappable,
    unverifiedLocation,
    nationalProtected,
    endangered,
  };
}

/** 区域色相：沿用 2D 地图既有类别色板，保证跨视图一致。 */
export { categoryColors } from '@/lib/categoryIcons';

/** 类别计数（按目录顺序稳定输出）。 */
export function categoryTally(digest: CollectionDigest): Array<{ category: string; count: number }> {
  return categories.map((category) => ({ category, count: digest.byCategory.get(category) ?? 0 }));
}
