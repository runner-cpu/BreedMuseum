/**
 * 生成「品种 → 收录批次」映射表（breedBatch.generated.json）。
 *
 * 归属规则：批次 = 该记录首次出现的来源模块（基础库 breeds.ts 内联数组 →
 * extraBreeds1..15 → 2024 名录增量）。归属以**名称**为准匹配运行时记录，
 * 因为运行时会做同物异名合并与同音 id 改名（见 breeds.ts 的
 * normalizeBreedIdentities），按 id 匹配会出现漏项。
 *
 * 用法：
 *   node tasks/generate-breed-batch.mjs           # 写入 src/data/breedBatch.generated.json
 *   node tasks/generate-breed-batch.mjs --check   # 校验文件与当前源码/运行时一致（CI 用）
 */
import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { withBreedData } from './data-runtime.mjs';

const OUT = 'src/data/breedBatch.generated.json';
const DATA_DIR = 'src/data';

const BASE_LABEL = '基础库';
const CATALOG_LABEL = '2024 名录';

/** 兼容 TS 单引号与 JSON 双引号两种字面量写法（extraBreeds14.ts 是 JSON 模块）。 */
const ID_RE = /(?:"id"|id)\s*:\s*['"]([^'"]+)['"]/g;
const NAME_RE = /(?:"name"|name)\s*:\s*['"]([^'"]+)['"]/g;

const allMatches = (source, re) => {
  const out = [];
  let match;
  re.lastIndex = 0;
  while ((match = re.exec(source)) !== null) out.push(match[1]);
  return out;
};

/** 从模块源码提取 name 序列（仅取对象字面量中的 name，跳过 title 等）。 */
const namesOfSource = (source) => allMatches(source, NAME_RE);

function collectModuleNames() {
  /** @type {{ label: string; file: string; names: string[] }[]} */
  const modules = [];

  // 基础库：breeds.ts 内联数组（extraBreeds 各模块由 import 引入，单独统计）
  const breedsSource = readFileSync(path.join(DATA_DIR, 'breeds.ts'), 'utf8');
  const inlineStart = breedsSource.indexOf('const rawBreeds');
  const inlineEnd = breedsSource.indexOf('...extraBreeds', inlineStart);
  modules.push({ label: BASE_LABEL, file: 'breeds.ts', names: namesOfSource(breedsSource.slice(inlineStart, inlineEnd)) });

  // 扩充批次：extraBreeds8 起文件序号与批次号相差一（历史无第八批）
  const files = readdirSync(DATA_DIR)
    .filter((name) => /^extraBreeds\d*\.ts$/.test(name))
    .sort((a, b) => Number(a.match(/\d+/)?.[0] ?? 1) - Number(b.match(/\d+/)?.[0] ?? 1));
  for (const file of files) {
    const source = readFileSync(path.join(DATA_DIR, file), 'utf8');
    const digits = file.match(/^extraBreeds(\d*)\.ts$/)?.[1] ?? '';
    const raw = digits === '' ? 1 : Number(digits); // extraBreeds.ts（无数字）= 第 1 批
    modules.push({ label: `第${raw >= 8 ? raw + 1 : raw}批`, file, names: namesOfSource(source) });
  }

  // 2024 名录增量：name 为 ml2024Entries.json 每条元组的第 0 位
  const entries = JSON.parse(readFileSync(path.join(DATA_DIR, 'ml2024Entries.json'), 'utf8'));
  modules.push({ label: CATALOG_LABEL, file: 'ml2024Entries.json', names: entries.map((entry) => String(entry[0])) });

  return modules;
}

const modules = collectModuleNames();

/**
 * 运行时会把名录正名替换进 name 字段（breeds.ts 的 canonicalNameRenames）。
 * 生成批次时需要按同一规则换算，否则这些记录匹配不上。新增正名时两处同改。
 */
const CANONICAL_NAME_RENAMES = new Map([
  ['青海驴', '青海毛驴'],
  ['准噶尔双峰驼', '新疆准噶尔双峰驼'],
  ['山麻鸭', '龙岩山麻鸭'],
  ['驯鹿', '敖鲁古雅驯鹿'],
]);

/** name → 批次（首次出现者优先，与运行时组装顺序一致）。 */
const batchByName = new Map();
for (const module of modules) {
  for (const rawName of module.names) {
    const name = CANONICAL_NAME_RENAMES.get(rawName) ?? rawName;
    if (!batchByName.has(name)) batchByName.set(name, module.label);
  }
}

const { byId, unmatched } = await withBreedData(async ({ breeds }) =>
  breeds.reduce(
    (acc, breed) => {
      const label = batchByName.get(breed.name);
      if (label) acc.byId[breed.id] = label;
      else acc.unmatched.push(`${breed.id}(${breed.name})`);
      return acc;
    },
    { byId: {}, unmatched: [] },
  ),
);

if (unmatched.length) {
  console.error('[breed-batch] 以下运行时记录未匹配到批次：');
  console.error(unmatched.join('\n'));
  process.exit(1);
}

const countByLabel = {};
for (const label of Object.values(byId)) countByLabel[label] = (countByLabel[label] ?? 0) + 1;

const payload = {
  generatedBy: 'tasks/generate-breed-batch.mjs',
  note: '批次归属按来源模块确定（同物异名合并与同音改名以运行时名称为准）。',
  batches: modules
    .map(({ label, file }) => ({ label, file, count: countByLabel[label] ?? 0 }))
    .filter((batch) => batch.count > 0),
  byId,
};

const serialized = JSON.stringify(payload, null, 2) + '\n';
const total = Object.keys(byId).length;

if (process.argv.includes('--check')) {
  const current = existsSync(OUT) ? readFileSync(OUT, 'utf8') : '';
  if (current !== serialized) {
    console.error('[breed-batch] 生成文件与运行时不一致，请运行 node tasks/generate-breed-batch.mjs');
    process.exit(1);
  }
  console.log('[breed-batch] ok · ' + total + ' records · ' + payload.batches.length + ' batches');
} else {
  writeFileSync(OUT, serialized);
  console.log('[breed-batch] wrote ' + OUT + ' · ' + total + ' records · ' + payload.batches.length + ' batches');
  console.log(payload.batches.map((batch) => batch.label + '=' + batch.count).join(' '));
}
