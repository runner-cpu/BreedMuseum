/**
 * 生成首页首屏图集常量（src/data/homeAtlas.ts）。
 *
 * 首页不能 import `visibleBreeds`（约 660 kB），所以把「省 → 计数」与
 * 「154 个产区点位」预计算成常量。这个脚本是唯一生成入口，`--check`
 * 会把生成结果与磁盘文件比对，CI 用它防止图集与运行时馆藏漂移。
 *
 * 用法：
 *   node tasks/generate-home-atlas.mjs           # 写入 src/data/homeAtlas.ts
 *   node tasks/generate-home-atlas.mjs --check   # 只比对，不写盘
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { createServer } from 'vite';
import { resolve } from 'node:path';

const OUT = 'src/data/homeAtlas.ts';

/** `--out=<path>` 只用于本地比对（写盘仍建议走生成脚本）；CI 只跑 `--check`。 */
const outArg = process.argv.find((arg) => arg.startsWith('--out='));
const target = outArg ? outArg.slice('--out='.length) : OUT;

const quote = (value) => `'${String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
const num = (value) => String(Math.round(value));

async function build() {
  const server = await createServer({
    configFile: false,
    envDir: false,
    server: { middlewareMode: true },
    appType: 'custom',
    resolve: { alias: { '@': resolve('src') } },
  });

  try {
    const { visibleBreeds } = await server.ssrLoadModule('/src/data/visibleBreeds.ts');
    const { buildSiteClusters } = await server.ssrLoadModule('/src/lib/geo/clusterSites.ts');
    const { buildDigest } = await server.ssrLoadModule('/src/lib/geo/lightMapData.ts');
    const { mapViewBox } = await server.ssrLoadModule('/src/data/chinaMap.ts');
    const { compareText } = await server.ssrLoadModule('/src/lib/compareText.ts');

    const digest = buildDigest(visibleBreeds);
    const clusters = buildSiteClusters(visibleBreeds);

    const provinces = digest.provinces
      .filter((entry) => entry.province !== '待核验' && entry.mappable > 0)
      .sort((a, b) => b.mappable - a.mappable || compareText(a.province, b.province));

    const provinceIndex = new Map(provinces.map((entry, index) => [entry.province, index]));
    const sites = clusters
      .filter((cluster) => provinceIndex.has(cluster.province))
      .map((cluster) => [
        provinceIndex.get(cluster.province),
        Math.round(mapViewBox.width / 2 + cluster.position[0] * 100),
        Math.round(mapViewBox.height / 2 - cluster.position[1] * 100),
        cluster.total,
        cluster.members.filter((member) => member.protectedByNationalList).length,
        cluster.members.filter((member) => member.endangeredEditorial).length,
      ]);

    const chips = provinces.map((entry) =>
      visibleBreeds
        .filter((breed) => breed.province === entry.province)
        .slice(0, 3)
        .map((breed) => [breed.id, breed.name, breed.englishName]),
    );

    const totals = {
      records: clusters.reduce((sum, cluster) => sum + cluster.total, 0),
      sites: clusters.length,
      protected: clusters.reduce(
        (sum, cluster) => sum + cluster.members.filter((member) => member.protectedByNationalList).length,
        0,
      ),
      endangered: clusters.reduce(
        (sum, cluster) => sum + cluster.members.filter((member) => member.endangeredEditorial).length,
        0,
      ),
      provinces: provinces.length,
    };

    const lines = [];
    lines.push('/**');
    lines.push(' * 首页首屏的预计算图集（省块色阶 + 产区点位 + 省份品种索引）。');
    lines.push(' *');
    lines.push(' * 首页不能 import `visibleBreeds`（约 660 kB）：为了一张 154 点的地图');
    lines.push(' * 让首屏付整库下载代价，是包体预算里最不划算的一笔。这份常量由');
    lines.push(' * `tasks/generate-home-atlas.mjs` 生成，`homeAtlas.test.ts` 会重新聚合');
    lines.push(' * 一遍并逐项比对；数据批次变化时先红，而不是悄悄显示上一批数字。');
    lines.push(' *');
    lines.push(' * 口径与地图探索页一致：只计入带图可浏览、且省份与坐标都已核验的记录。');
    lines.push(' */');
    lines.push('');
    lines.push('export interface HomeAtlasProvince {');
    lines.push('  name: string;');
    lines.push('  total: number;');
    lines.push('  protected: number;');
    lines.push('  endangered: number;');
    lines.push('  /** 条目数前三的类别与条数 */');
    lines.push('  categories: ReadonlyArray<readonly [string, number]>;');
    lines.push('}');
    lines.push('');
    lines.push('/** 有落点的省级行政区，按记录数降序。 */');
    lines.push('export const HOME_ATLAS_PROVINCES: readonly HomeAtlasProvince[] = [');
    for (const entry of provinces) {
      const categories = [...entry.byCategory.entries()]
        .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
        .slice(0, 3)
        .map(([name, count]) => `[${quote(name)}, ${count}]`)
        .join(', ');
      lines.push(
        `  { name: ${quote(entry.province)}, total: ${entry.mappable}, protected: ${entry.nationalProtected}, endangered: ${entry.endangered}, categories: [${categories}] },`,
      );
    }
    lines.push('];');
    lines.push('');
    lines.push('/**');
    lines.push(' * 产区点位，坐标为 SVG viewBox 像素：');
    lines.push(' * `[省份索引, x, y, 记录数, 国家级保护匹配数, 编辑口径濒危数]`。');
    lines.push(' */');
    lines.push('export const HOME_ATLAS_SITES: ReadonlyArray<');
    lines.push('  readonly [number, number, number, number, number, number]');
    lines.push('> = [');
    for (const site of sites) lines.push(`  [${site.map(num).join(', ')}],`);
    lines.push('];');
    lines.push('');
    lines.push('/** 省份 → 三个代表品种（id / 中文名 / 英文名），供速览条直接进百科。 */');
    lines.push('export const HOME_ATLAS_CHIPS: ReadonlyArray<');
    lines.push('  ReadonlyArray<readonly [string, string, string]>');
    lines.push('> = [');
    for (const row of chips) {
      lines.push(`  [${row.map(([id, name, en]) => `[${quote(id)}, ${quote(name)}, ${quote(en)}]`).join(', ')}],`);
    }
    lines.push('];');
    lines.push('');
    lines.push('/** 首屏图注用的汇总，避免组件里再 reduce 一遍。 */');
    lines.push('export const HOME_ATLAS_TOTALS = {');
    lines.push(`  records: ${totals.records},`);
    lines.push(`  sites: ${totals.sites},`);
    lines.push(`  protected: ${totals.protected},`);
    lines.push(`  endangered: ${totals.endangered},`);
    lines.push(`  provinces: ${totals.provinces},`);
    lines.push('} as const;');
    lines.push('');

    return lines.join('\n');
  } finally {
    await server.close();
  }
}

const generated = await build();
const check = process.argv.includes('--check');

if (!check) {
  writeFileSync(target, generated, 'utf8');
  console.log(`Wrote ${target}`);
  process.exit(0);
}

const current = readFileSync(OUT, 'utf8');
if (current !== generated) {
  console.error(`${OUT} is stale; run node tasks/generate-home-atlas.mjs`);
  process.exit(1);
}
console.log(`${OUT} is up to date`);
