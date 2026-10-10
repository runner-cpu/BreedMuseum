import { breeds as allBreeds, type Breed } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { hasVerifiedCoordinates } from '@/data/catalog';
import { project3D } from './buildProvinceGeometry';

/**
 * 产区落点聚合（纯函数，2D 与 3D 两个视图共用）。
 *
 * 为什么必须聚合：1,062 条可落点记录只落在 **509 个不同坐标**上，
 * 其中 102 个坐标挤了 655 条（占 62%），最大的几个坐标各有 45 / 44 / 38 / 34 / 29 条
 * ——因为这些品种共用同一个城市级产区坐标（例如「四川麻鸭」「成华猪」都记在成都）。
 *
 * 上一版把同坐标记录按固定角度均匀铺在半径 0.07–0.18 的圆上，于是 45 条记录
 * 被画成 45 个点精确排成一个圆环：既不好看，也不表达任何数据含义
 * （环的大小、点数、角度都不对应字段）。
 *
 * 这一版改成**空间聚合**：只有真实相近（同省内、世界距离 ≤ radius）的坐标才并成一个
 * 「产区簇」，簇中心是成员的记录数加权重心。因此：
 * - 一个簇里的记录条数有明确含义（同产区有多少个品种）；
 * - 簇内按分类分段上色，读得出「这个产区养什么为主」；
 * - 落点不再被人工偏移到不存在的位置上——簇中心的偏移量有硬上限（radius）。
 *
 * 恒定不变式（由 `clusterSites.test.ts` 断言）：
 * - 每条可落点记录恰好属于一个簇（合起来 = `COLLECTION_SUMMARY.mappable`）；
 * - 每个成员到簇中心的距离 ≤ radius（不会把两个真实相距很远的坐标硬并到一起）；
 * - 输入顺序无关：先按省份分组、组内按记录数降序，输出再按 id 排序；
 * - 簇中心与实际坐标的最大偏移有上限，可被审计。
 */

/** 空间聚合半径（世界单位）。地图整体约 10 × 8，0.22 ≈ 240 km，是「同一产区」的量级。 */
export const SITE_CLUSTER_RADIUS = 0.22;

export interface ClusterMember {
  id: string;
  name: string;
  category: string;
  /** 该记录的国家级保护名录匹配 */
  protectedByNationalList: boolean;
  /** 该记录的编辑口径濒危 */
  endangeredEditorial: boolean;
}

export interface CategorySlice {
  category: string;
  count: number;
}

export interface SiteCluster {
  /** 稳定 id（省份 + 中心平面坐标），跨刷新不变 */
  id: string;
  province: string;
  /** 簇中心（地图平面世界坐标） */
  position: [number, number];
  /** 当前镜头下计入的记录数 */
  total: number;
  /**
   * 全量口径下的记录数（与镜头无关）。
   *
   * 光束的半径与高度必须读它，不能读 `total`：镜头切换会改 `total`，
   * 若几何跟着变，同一根光束在「濒危之窗」下会突然变细变矮，
   * 观众会以为换了一张图。位置与形状只有一份，变的只是「谁亮着」。
   */
  baseTotal: number;
  /** 簇内不同的原始坐标点数（1 = 单一坐标） */
  seedCount: number;
  /** 分类切片，count 降序、同 count 按类别名升序 */
  slices: CategorySlice[];
  /** 是否含国家级保护名录匹配 */
  hasNationalProtected: boolean;
  /** 是否含编辑口径濒危记录 */
  hasEndangered: boolean;
  /** 成员（按 id 升序），供展开与无障碍标签使用 */
  members: ClusterMember[];
  /** 含全部成员的平面半径（单坐标簇为 0） */
  radius: number;
}

const memberOf = (breed: Breed): ClusterMember => ({
  id: breed.id,
  name: breed.name,
  category: breed.category,
  protectedByNationalList: getBreedMetadata(breed).protectionStatus === 'national-list',
  endangeredEditorial: breed.endangered === '濒危' || breed.endangered === '极危',
});

interface Seed {
  key: string;
  x: number;
  y: number;
  breeds: Breed[];
}

/** 同一坐标的记录先归堆；坐标按 3 位小数归一（与审计口径一致）。 */
function seedsFor(source: readonly Breed[]): Map<string, Map<string, Seed>> {
  const byProvince = new Map<string, Map<string, Seed>>();
  for (const breed of source) {
    if (!hasVerifiedCoordinates(breed)) continue;
    const key = `${breed.longitude.toFixed(3)},${breed.latitude.toFixed(3)}`;
    let byKey = byProvince.get(breed.province);
    if (!byKey) {
      byKey = new Map();
      byProvince.set(breed.province, byKey);
    }
    const found = byKey.get(key);
    if (found) {
      found.breeds.push(breed);
      continue;
    }
    const [x, y] = project3D(breed.longitude, breed.latitude);
    byKey.set(key, { key, x, y, breeds: [breed] });
  }
  return byProvince;
}

/**
 * 贪心合并，带**双向约束**：新成员到新中心要够近，且中心一动，
 * 原有成员到新中心也必须仍然够近。这样成组与否只取决于几何，
 * 不取决于遍历顺序，簇内最大偏移也不会超过 radius。
 */
function clusterProvince(seeds: readonly Seed[], radius: number): Array<{ x: number; y: number; seeds: Seed[] }> {
  const ordered = [...seeds].sort(
    (a, b) => b.breeds.length - a.breeds.length || a.key.localeCompare(b.key),
  );
  const groups: Array<{ x: number; y: number; seeds: Seed[] }> = [];
  for (const seed of ordered) {
    let placed = false;
    for (const group of groups) {
      const weight = group.seeds.reduce((sum, item) => sum + item.breeds.length, 0);
      const total = weight + seed.breeds.length;
      const cx = (group.x * weight + seed.x * seed.breeds.length) / total;
      const cy = (group.y * weight + seed.y * seed.breeds.length) / total;
      if (Math.hypot(cx - seed.x, cy - seed.y) > radius) continue;
      const keepsMembers = group.seeds.every(
        (item) => Math.hypot(cx - item.x, cy - item.y) <= radius,
      );
      if (!keepsMembers) continue;
      group.x = cx;
      group.y = cy;
      group.seeds.push(seed);
      placed = true;
      break;
    }
    if (!placed) groups.push({ x: seed.x, y: seed.y, seeds: [seed] });
  }
  return groups;
}

const slicesOf = (members: readonly ClusterMember[]): CategorySlice[] => {
  const tally = new Map<string, number>();
  for (const member of members) tally.set(member.category, (tally.get(member.category) ?? 0) + 1);
  return [...tally.entries()]
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count || a.category.localeCompare(b.category));
};

const round6 = (value: number): number => Math.round(value * 1e6) / 1e6;

export function buildSiteClusters(
  source: readonly Breed[] = allBreeds,
  radius: number = SITE_CLUSTER_RADIUS,
): SiteCluster[] {
  const clusters: SiteCluster[] = [];
  for (const [province, byKey] of seedsFor(source)) {
    for (const group of clusterProvince([...byKey.values()], radius)) {
      const members = group.seeds
        .flatMap((seed) => seed.breeds)
        .map(memberOf)
        .sort((a, b) => a.id.localeCompare(b.id));
      const membersRadius = group.seeds.reduce(
        (max, seed) => Math.max(max, Math.hypot(group.x - seed.x, group.y - seed.y)),
        0,
      );
      const position: [number, number] = [round6(group.x), round6(group.y)];
      clusters.push({
        id: `${province}@${position[0]},${position[1]}`,
        province,
        position,
        total: members.length,
        baseTotal: members.length,
        seedCount: group.seeds.length,
        slices: slicesOf(members),
        hasNationalProtected: members.some((member) => member.protectedByNationalList),
        hasEndangered: members.some((member) => member.endangeredEditorial),
        members,
        radius: round6(membersRadius),
      });
    }
  }
  return clusters.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * 拾取半径：盖住光束本体再放宽一大截，密集区里点得中。
 * 光束本身只有 0.012–0.047 世界单位粗，不加这个下限就只剩几个像素可点。
 */
export function hitRadiusFor(total: number): number {
  return Math.max(beamRadiusFor(total) * 2.6, 0.085);
}

/**
 * 记录数 → 2D 平面半径（`ChinaMap` 的 SVG 标记用）。
 *
 * 注意它**不再**兼作 3D 光束半径：2D 的圆点要够大才好点、好看，
 * 3D 的光束要「细而高」才读成光。共用一套半径会把其中一边做坏——
 * 上一版让 3D 也吃这套（最大 0.295），结果柱子粗成软木塞。
 */
export function markerRadiusFor(total: number): number {
  return 0.055 + 0.006 * Math.min(total, 40);
}

/** 记录数 → 光束半径（世界单位）。细是刻意的：光靠细长读出来，柱靠粗壮读出来。 */
export function beamRadiusFor(total: number): number {
  return 0.011 + 0.00055 * Math.min(total, 64);
}

/**
 * 记录数 → 光束高度（世界单位）；对数压缩，53 条与 45 条不会差出一个量级。
 *
 * 下限 0.65 是硬要求：省块最高挤出 0.39（`EXTRUDE_STEPS` 上限），
 * 光束必须明显高出版图，否则整片光场会缩回「地图上插了几个土墩」。
 * 上限约 1.4（64 条封顶）——再高就要为取景让出大片空白，版图会缩成一小块。
 */
export function beamHeightFor(total: number): number {
  return 0.5 + 0.15 * Math.log2(1 + Math.min(total, 64));
}

/** 光束最高值（64 条及以上封顶），取景时用它当包围盒的竖向范围。 */
export const MAX_BEAM_HEIGHT = beamHeightFor(64);

/** 一段束身（类别分段），不含颜色——配色由渲染层按主题决定。 */
export interface BeamSegment {
  category: string;
  count: number;
  /** 段底相对束底的高度（世界单位） */
  from: number;
  height: number;
}

/**
 * 把产区的类别构成摊成一段段束身。类别多于 `tailLimit` 时，尾部的都并成
 * 「其他类别」——否则 11 个类别会切成 11 段，每段几像素高，既看不出颜色也点不中。
 *
 * 高度按 **`baseTotal`**（筛选前的整簇记录数）算，不按当前 `total`：
 * 镜头切换会让 `total` 变小，若高度跟着变，同一根光束在「濒危之窗」下会突然变矮，
 * 观众会以为是另一张图。位置与形状只有一份，变的只是「谁亮着」。
 */
export function beamSegmentsFor(
  cluster: Pick<SiteCluster, 'slices' | 'total' | 'baseTotal'>,
  tailLimit = 6,
): BeamSegment[] {
  const head = cluster.slices.slice(0, tailLimit);
  const tail = cluster.slices.slice(tailLimit);
  const merged: CategorySlice[] = tail.length
    ? [...head, { category: '其他类别', count: tail.reduce((sum, item) => sum + item.count, 0) }]
    : [...head];
  const total = merged.reduce((sum, item) => sum + item.count, 0) || 1;
  const height = beamHeightFor(cluster.baseTotal);
  let cursor = 0;
  return merged.map((slice) => {
    const segmentHeight = (slice.count / total) * height;
    const segment: BeamSegment = {
      category: slice.category,
      count: slice.count,
      from: cursor,
      height: segmentHeight,
    };
    cursor += segmentHeight;
    return segment;
  });
}

/* ------------------------------------------------------------------ */
/* 镜头：只切换「哪一条记录算数」，不改变簇的位置                        */
/* ------------------------------------------------------------------ */

export type LensId = 'all' | 'category' | 'protect' | 'risk';

export const matchesLens = (
  member: Pick<ClusterMember, 'category' | 'protectedByNationalList' | 'endangeredEditorial'>,
  lens: LensId,
  category: string | null,
): boolean => {
  if (lens === 'all') return true;
  if (lens === 'category') return category ? member.category === category : true;
  if (lens === 'protect') return member.protectedByNationalList;
  return member.endangeredEditorial;
};

/** 镜头下的可见簇：位置与 id 不变，只重算分段构成；没有匹配记录的簇整簇隐去。 */
export function clustersForLens(
  clusters: readonly SiteCluster[],
  lens: LensId,
  category: string | null,
): SiteCluster[] {
  const visible: SiteCluster[] = [];
  for (const cluster of clusters) {
    const members = cluster.members.filter((member) => matchesLens(member, lens, category));
    if (members.length === 0) continue;
    visible.push({
      ...cluster,
      members,
      slices: slicesOf(members),
      total: members.length,
      hasNationalProtected: members.some((member) => member.protectedByNationalList),
      hasEndangered: members.some((member) => member.endangeredEditorial),
    });
  }
  return visible;
}
