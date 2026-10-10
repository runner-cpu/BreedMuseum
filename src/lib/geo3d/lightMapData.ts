import { breeds as allBreeds, type Breed } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { categories, hasVerifiedCoordinates } from '@/data/catalog';

/**
 * 光图数据口径（纯函数，可在无 WebGL 环境下单测）。
 *
 * 落点几何本身在 `clusterSites.ts`（空间聚合），这里只保留两件事：
 * 1. `hasMappableLocation` —— 「这条记录能不能落点」的唯一判定；
 * 2. `buildDigest` / `categoryTally` —— HUD、侧栏与无障碍摘要表共用的聚合口径。
 */

/** 是否可落点：省份已核验且坐标不是 (0,0) 哨兵。与审计口径同一函数。 */
export const hasMappableLocation = (breed: Breed): boolean => hasVerifiedCoordinates(breed);

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

    const entry = provinceMap.get(breed.province) ?? {
      province: breed.province,
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
    provinceMap.set(breed.province, entry);
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

/**
 * 光图数据摘要（HUD 与无障碍摘要表共用）。
 * 只统计**已核验落点**的簇与记录，未核验产区的记录单独计数，不参与簇的聚合。
 */
export interface LightMapSummary {
  /** 产区簇数量（一个簇 = 一个产区） */
  clusters: number;
  /** 可落点记录数 */
  mappable: number;
  /** 有落点的省级行政区数 */
  provinces: number;
  /** 单条记录独占的产区数 */
  singleRecordClusters: number;
}

export function lightMapSummary(clusterList: readonly { total: number; province: string }[]): LightMapSummary {
  const provinces = new Set(clusterList.map((cluster) => cluster.province));
  return {
    clusters: clusterList.length,
    mappable: clusterList.reduce((sum, cluster) => sum + cluster.total, 0),
    provinces: provinces.size,
    singleRecordClusters: clusterList.filter((cluster) => cluster.total === 1).length,
  };
}
