/**
 * 按品种名精确检索 Wikimedia Commons 上可核验授权的图片。
 *
 * 只接受文件标题中明确含有品种名的图片（物种级泛图一律不收），
 * 授权范围限定 CC0 / PD / CC BY / CC BY-SA（排除 ND 与 NC）。
 *
 * 用法：
 *   node tasks/source-commons-images.mjs                 # 查询并输出候选清单
 *   node tasks/source-commons-images.mjs --download      # 依据 breed-image-plan.json 下载并生成覆盖模块
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const DOWNLOAD = process.argv.includes('--download');
const PLAN_FILE = 'tasks/breed-image-plan.json';
const OUTPUT_DIR = 'public/images/breeds';
const WIDTH = 1280;

/** 候选品种：只挑国际知名、Commons 上可能存在实拍记录的中国地方品种 */
const candidates = [
  { name: '梅山猪', terms: ['Meishan pig'] },
  { name: '金华猪', terms: ['Jinhua pig'] },
  { name: '太湖猪', terms: ['Taihu pig'] },
  { name: '二花脸猪', terms: ['Erhualian'] },
  { name: '八眉猪', terms: ['Bamei pig'] },
  { name: '民猪', terms: ['Min pig'] },
  { name: '东北民猪', terms: ['Min pig'] },
  { name: '内江猪', terms: ['Neijiang pig'] },
  { name: '藏猪', terms: ['Tibetan pig'] },
  { name: '五指山猪', terms: ['Wuzhishan pig'] },
  { name: '湖羊', terms: ['Hu sheep'] },
  { name: '滩羊', terms: ['Tan sheep'] },
  { name: '小尾寒羊', terms: ['Small-tail Han sheep', 'Small tailed Han sheep'] },
  { name: '狼山鸡', terms: ['Croad Langshan'] },
  { name: '丝羽乌骨鸡', terms: ['Silkie chicken', 'Silkie'] },
  { name: '北京鸭', terms: ['American Pekin duck', 'Pekin duck'] },
  { name: '狮头鹅', terms: ['Shitou goose', 'Lion-head goose'] },
  { name: '伊犁马', terms: ['Yili horse'] },
  { name: '蒙古马', terms: ['Mongolian horse'] },
];

const LICENSE_OK = /^(CC0|Public domain|Public Domain|CC BY(?:-SA)? [1-4]\.0)$/i;

const api = async (params) => {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('format', 'json');
  url.searchParams.set('origin', '*');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url, { headers: { 'User-Agent': 'BreedMuseum/1.0 (student competition entry; contact via GitHub Issues)' } });
  if (!res.ok) throw new Error(`Commons API ${res.status}`);
  return res.json();
};

const plain = (html) => html.replace(/<[^>]*>/g, '').trim();

async function searchTerm(term) {
  const data = await api({
    action: 'query',
    generator: 'search',
    gsrsearch: `${term} filetype:bitmap`,
    gsrnamespace: 6,
    gsrlimit: 8,
    prop: 'imageinfo',
    iiprop: 'url|extmetadata|user',
    iiurlwidth: WIDTH,
  });
  const pages = Object.values(data?.query?.pages ?? {});
  const out = [];
  for (const page of pages) {
    const info = page.imageinfo?.[0];
    if (!info) continue;
    const meta = info.extmetadata ?? {};
    const license = plain(meta.LicenseShortName?.value ?? '');
    if (!LICENSE_OK.test(license)) continue;
    if (/NC|ND/i.test(license)) continue;
    out.push({
      title: page.title,
      term,
      thumb: info.thumburl,
      author: plain(meta.Artist?.value ?? info.user ?? '未知作者'),
      license,
      sourceUrl: info.descriptionurl ?? `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    });
  }
  return out;
}

// 品种名（拉丁转写）必须出现在文件标题里，避免物种级泛图误配
const BREED_TOKENS = {
  '梅山猪': /meishan/i, '金华猪': /jinhua/i, '太湖猪': /taihu/i, '二花脸猪': /erhualian/i,
  '八眉猪': /bamei/i, '民猪': /\bmin pig|min swine/i, '东北民猪': /\bmin pig|min swine/i,
  '内江猪': /neijiang/i, '藏猪': /tibetan pig|himalayan pig/i, '五指山猪': /wuzhishan/i,
  '湖羊': /hu sheep/i, '滩羊': /\btan sheep|tanyang/i,
  '小尾寒羊': /small[- ]?tail(ed)? han/i,
  '狼山鸡': /croad langshan|langshan/i, '丝羽乌骨鸡': /silkie/i,
  '北京鸭': /pekin duck|american pekin/i,
  '狮头鹅': /shitou|lion[- ]head goose/i,
  '伊犁马': /yili horse|ili horse/i, '蒙古马': /mongolian horse/i,
};

if (!DOWNLOAD) {
  const report = [];
  for (const candidate of candidates) {
    const token = BREED_TOKENS[candidate.name];
    const seen = new Set();
    const matches = [];
    for (const term of candidate.terms) {
      let results = [];
      try {
        results = await searchTerm(term);
      } catch (error) {
        console.error(`查询失败 ${term}: ${error.message}`);
        continue;
      }
      for (const item of results) {
        if (seen.has(item.title) || !token.test(item.title)) continue;
        seen.add(item.title);
        matches.push(item);
      }
      await new Promise((r) => setTimeout(r, 300));
    }
    if (matches.length > 0) {
      report.push({ name: candidate.name, matches });
      console.log(`✓ ${candidate.name}: ${matches.length} 张候选`);
      for (const m of matches) console.log(`    ${m.title} | ${m.license} | ${m.author}`);
    } else {
      console.log(`✗ ${candidate.name}: 无符合条件的授权图`);
    }
  }
  await writeFile('tasks/tmp-commons-candidates.json', JSON.stringify(report, null, 2), 'utf8');
  console.log('\n候选清单已写入 tasks/tmp-commons-candidates.json，请人工复核后整理为 tasks/breed-image-plan.json');
  process.exit(0);
}

// —— 下载阶段：依据人工复核过的 plan 下载并生成覆盖模块 ——
if (!existsSync(PLAN_FILE)) {
  console.error(`缺少 ${PLAN_FILE}`);
  process.exit(1);
}
// 只允许 Wikimedia 域名的 https 下载；拒绝其余主机与本地/内网地址
const ALLOWED_HOSTS = /^(upload\.wikimedia\.org|commons\.wikimedia\.org)$/;
const assertSafeUrl = (raw) => {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !ALLOWED_HOSTS.test(url.hostname)) {
    throw new Error(`不允许的下载地址: ${raw}`);
  }
  return url;
};
const plan = JSON.parse(await readFile(PLAN_FILE, 'utf8'));
await mkdir(OUTPUT_DIR, { recursive: true });
const overrides = {};
for (const entry of plan) {
  const url = assertSafeUrl(entry.file);
  const ext = path.extname(url.pathname) || '.jpg';
  const fileName = `${entry.id}${ext}`;
  const target = path.join(OUTPUT_DIR, fileName);
  const res = await fetch(entry.file, { headers: { 'User-Agent': 'BreedMuseum/1.0 (student competition entry)' } });
  if (!res.ok) { console.error(`下载失败 ${entry.id}: ${res.status}`); continue; }
  const buffer = Buffer.from(await res.arrayBuffer());
  await writeFile(target, buffer);
  overrides[entry.id] = {
    src: `/images/breeds/${fileName}`,
    author: entry.author,
    license: entry.license,
    sourceUrl: entry.sourceUrl,
    title: entry.title,
  };
  console.log(`✓ ${entry.id} <- ${entry.title} (${buffer.length} bytes)`);
}
await writeFile('tasks/tmp-breed-image-overrides.json', JSON.stringify(overrides, null, 2), 'utf8');
console.log('\n覆盖数据已写入 tasks/tmp-breed-image-overrides.json');

// 生成 src/data/breedImageOverrides.ts（应用在运行时读取该登记表）
if (Object.keys(overrides).length > 0) {
  const moduleSource = `/**
 * 本地托管的可核验授权图片登记表 —— 由 tasks/source-commons-images.mjs --download 生成。
 * 唯一事实来源是 tasks/breed-image-plan.json（人工复核品种匹配与授权后提交）。
 * 键为品种 id；未登记的品种继续使用外链或项目 SVG 占位图。
 */
export interface BreedOverrideImage {
  /** 站内路径，如 /images/breeds/<id>.jpg */
  src: string;
  /** 摄影者（Commons Artist 字段，纯文本） */
  author: string;
  /** 许可协议简称，如 CC BY-SA 4.0 */
  license: string;
  /** Commons 文件页，用于署名回链 */
  sourceUrl: string;
  /** Commons 文件名，如 File:Meishan pig.jpg */
  title: string;
}

export const breedImageOverrides: Record<string, BreedOverrideImage> = ${JSON.stringify(overrides, null, 2)};
`;
  await writeFile('src/data/breedImageOverrides.ts', moduleSource, 'utf8');
  console.log('已生成 src/data/breedImageOverrides.ts');
}
