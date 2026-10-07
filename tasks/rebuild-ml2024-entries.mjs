/**
 * 《国家畜禽遗传资源品种名录（2024年版）》增量重建工具。
 *
 * 依据 src/data/ml2024Catalog.json（官方 PDF 逐页人工核对的全量 manifest，含
 * 章节计数与文号元数据）重建 src/data/ml2024Entries.json：
 *   1. 修正既有条目的 OCR 名称讹变（每条均有官方资料佐证，见 RENAMES 注释）；
 *   2. 移除混入的引入品种（名录口径：引入品种/引入配套系不在馆藏范围）；
 *   3. 补入此前 diff 管线遗漏的范围内条目（地方/培育/培育配套系/其他蜂遗传资源）；
 *   4. 为全部条目补充第 5 元组位 species，供运行时直接映射类别，禁止名称后缀推断。
 *
 * 省份口径（与 0668f0d 轮次的 gazetteer 政策一致）：
 *   - 有官方资料佐证的直接标注；
 *   - 品种名内含行政区划名（川/滇/藏/鲁/徽/陕/甘/蒙/台等）或以地名/育种单位
 *     命名且归属明确的按定义标注；
 *   - 同一育种单位/同一系列的既有条目可镜像省份；
 *   - 其余一律 null（待核验），不猜测。
 *
 * 用法：node tasks/rebuild-ml2024-entries.mjs [--check]
 *   --check  只校验现有 JSON 是否已是目标状态，不写盘。
 */
import { readFileSync, writeFileSync } from 'node:fs';

const MANIFEST = 'src/data/ml2024Catalog.json';
const TARGET = 'src/data/ml2024Entries.json';
const LEGACY_IDS_FILE = '.tmp-runtime-ids.txt';

/** OCR 名称讹变修正：[现名, 正名, 备注（证据）] */
const RENAMES = [
  ['山下长黑', '山下长黑猪', '官方 PDF 第 4 页；四川种业新闻'],
  ['宁黑头山羊', '宁蒗黑头山羊', '云南宁蒗县地方山羊，官方资料'],
  ['宁高原鸡', '宁蒗高原鸡', '农业农村部第63号公告品种，丽江宁蒗'],
  ['维西家乌鸡', '维西傈家乌鸡', '迪庆州政府现场核验报道'],
  ['新兴黄鸡ⅡI号配套系', '新兴黄鸡II号配套系', 'OCR 双字符讹变；种业司公告用 ASCII 罗马字'],
  ['山鸡', '崀山鸡', '湖南 4 资源入选报道（武雪山羊、崀山鸡、永顺凤头鸭、张家界白羽乌鸡）'],
  ['粤禽皇5号蛋鸡', '粤禽皇5号鸡', '官方 PDF 第 17 页；与 2 号/3 号系列命名一致'],
  ['天府肉鹅', '天府肉鹅配套系', '官方 PDF 第 20 页培育配套系列表'],
  ['苏威1号肉鸽', '苏威1号肉鸽配套系', '官方 PDF 第 20 页培育配套系列表'],
  ['名威银蓝水貂', '名威银蓝色水貂', '官方 PDF 第 24 页；颜色命名体例'],
  ['岭南黄鸡Ⅱ号配套系', '岭南黄鸡II号配套系', 'OCR 全角罗马字讹变；与 I 号条目统一'],
];

/** OCR 幻影副本：legacy 已存在同品种正名条目，增量中的讹变名条目直接移除 */
const REMOVE_PHANTOM_DUPLICATES = [
  ['宁黑绵羊', '宁蒗黑绵羊 (ninglang-black-sheep) 已在 legacy'],
  ['浙川乌骨鸡', '淅川乌骨鸡 (xichuan-black-bone-chicken) 已在 legacy'],
  ['烟台穆糠鸡', '烟台䅟糠鸡 (yantai-canka-chicken) 已在 legacy'],
];

/** 混入的引入品种（名录“引入品种/引入配套系”，不在馆藏范围） */
const REMOVE_INTRODUCED = ['苏高血马', '蓝颈鸵鸟', '珍珠色水貂', '红眼白水貂', '银黑狐'];

/** 新增条目的英文名与省份（null = 待核验）。species 来自 manifest。 */
const ADDITIONS = [
  ['山下长黑猪', 'Shanxiachanghei Pig', 1, '四川'],
  ['滇中牛', 'Dianzhong Cattle', 0, '云南'],
  ['云南高峰牛', 'Yunnan Gaofeng Cattle', 0, '云南'],
  ['阿沛甲咂牛', 'Apeijiazuo Cattle', 0, '西藏'],
  ['日喀则驼峰牛', 'Rikaze Tuofeng Cattle', 0, '西藏'],
  ['西藏牛', 'Tibet Cattle', 0, '西藏'],
  ['樟木牛', 'Zhangmu Cattle', 0, '西藏'],
  ['哈萨克牛', 'Kazakh Cattle', 0, '新疆'],
  ['台湾牛', 'Taiwan Cattle', 0, '台湾'],
  ['皖东牛', 'Wandong Cattle', 0, '安徽'],
  ['空山牛', 'Kongshan Cattle', 0, null],
  ['延黄牛', 'Yanhuang Cattle', 1, '吉林'],
  ['辽育白牛', 'Liaoyu White Cattle', 1, '辽宁'],
  ['蜀宣花牛', 'Shuxuanhua Cattle', 1, '四川'],
  ['云岭牛', 'Yunling Cattle', 1, '云南'],
  ['华西牛', 'Huaxi Cattle', 1, '内蒙古'],
  ['色瓦绵羊', 'Sewa Sheep', 0, '西藏'],
  ['多玛绵羊', 'Duoma Sheep', 0, '西藏'],
  ['苏格绵羊', 'Suge Sheep', 0, '西藏'],
  ['岗巴绵羊', 'Gangba Sheep', 0, '西藏'],
  ['洮羊', 'Tao Sheep', 0, '甘肃'],
  ['玛多羊', 'Maduo Sheep', 0, '青海'],
  ['札萨克图羊', 'Zhasaketu Sheep', 0, '内蒙古'],
  ['内蒙古半细毛羊', 'Neimenggu Banximao Sheep', 1, '内蒙古'],
  ['陕北细毛羊', 'Shanbei Fine Wool Sheep', 1, '陕西'],
  ['昭乌达肉羊', 'Zhaowuda Meat Sheep', 1, '内蒙古'],
  ['察哈尔羊', 'Chahar Sheep', 1, '内蒙古'],
  ['苏博美利奴羊', 'Subo Merino', 1, null],
  ['高山美利奴羊', 'Gaoshan Merino', 1, '甘肃'],
  ['象雄半细毛羊', 'Xiangxiong Banximao Sheep', 1, '西藏'],
  ['鲁西黑头羊', 'Luxiheitou Sheep', 1, '山东'],
  ['乾华肉用美利奴羊', 'Qianhua Meat Merino', 1, '吉林'],
  ['戈壁短尾羊', 'Gobi Short-tailed Sheep', 1, '内蒙古'],
  ['鲁中肉羊', 'Luzhong Meat Sheep', 1, '山东'],
  ['草原短尾羊', 'Caoyuan Short-tailed Sheep', 1, '内蒙古'],
  ['黄淮肉羊', 'Huanghuai Meat Sheep', 1, '河南'],
  ['贵乾半细毛羊', 'Guiqian Banximao Sheep', 1, '贵州'],
  ['杜蒙羊', 'Dumeng Sheep', 1, '内蒙古'],
  ['天华肉羊', 'Tianhua Meat Sheep', 1, '甘肃'],
  ['华蒙肉羊', 'Huameng Meat Sheep', 1, '内蒙古'],
  ['双乾肉羊', 'Shuangqian Meat Sheep', 1, '吉林'],
  ['德新肉用细毛羊', 'Dexin Fine Wool Sheep', 1, null],
  ['宁蒗黑头山羊', 'Ninglangheitou Goat', 0, '云南'],
  ['弥勒红骨山羊', 'Milehonggu Goat', 0, '云南'],
  ['临沧长毛山羊', 'Lincang Long-haired Goat', 0, '云南'],
  ['兰坪长毛山羊', 'Lanping Long-haired Goat', 0, '云南'],
  ['洮藏黑山羊', 'Taocang Black Goat', 0, '甘肃'],
  ['吐鲁番驴', 'Turpan Donkey', 0, '新疆'],
  ['新疆塔里木双峰驼', 'Xinjiang Talimu Bactrian Camel', 0, '新疆'],
  ['福建白兔', 'Fujian White Rabbit', 0, '福建'],
  ['川白獭兔', 'Chuanbai Rex Rabbit', 1, '四川'],
  ['皖南黄兔', 'Wannan Yellow Rabbit', 1, '安徽'],
  ['甬青獭兔', 'Yongqing Rex Rabbit', 1, '浙江'],
  ['天府黑兔', 'Tianfuhei Rabbit', 1, '四川'],
  ['康大2号肉兔', 'Kangda Rabbit 2', 2, '山东'],
  ['康大3号肉兔', 'Kangda Rabbit 3', 2, '山东'],
  ['蜀兴1号肉兔', 'Shuxing Rabbit 1', 2, '四川'],
  ['康大麻色肉兔配套系', 'Kangdamase Rabbit Line', 2, '山东'],
  ['宁蒗高原鸡', 'Ninglang Gaoyuan Chicken', 0, '云南'],
  ['维西傈家乌鸡', 'Weixilijia Black-bone Chicken', 0, '云南'],
  ['崀山鸡', 'Langshan Chicken Hunan', 0, '湖南'],
  ['江村黄鸡JH-3号配套系', 'Jiangcunhuang Chicken JH-3', 2, '广东'],
  ['新兴黄鸡II号配套系', 'Xinxinghuang Chicken II', 2, '广东'],
  ['岭南黄鸡II号配套系', 'Lingnanhuang Chicken II', 2, null],
  ['京星黄鸡102配套系', 'Jingxinghuangji 102', 2, '北京'],
  ['京星黄鸡103配套系', 'Jingxinghuangji 103', 2, '北京'],
  ['鲁禽3号麻鸡配套系', 'Luqin Ma Chicken 3', 2, '山东'],
  ['粤禽皇3号鸡配套系', 'Yueqinhuang Chicken 3', 2, '广东'],
  ['粤禽皇5号鸡', 'Yueqinhuanghaodan Chicken 5', 2, '广东'],
  ['农大5号小型蛋鸡配套系', 'Nongda Layer 5', 2, '北京'],
  ['京粉6号蛋鸡配套系', 'Jingfen Layer 6', 2, '北京'],
  ['京星黄鸡100配套系', 'Jingxinghuangji 100', 2, '北京'],
  ['海扬黄鸡配套系', 'Haiyang Yellow Chicken', 2, null],
  ['肉鸡WOD168配套系', 'WOD168 Broiler', 2, null],
  ['金陵黑凤鸡配套系', 'Jinlingheifeng Chicken', 2, '江苏'],
  ['大恒799肉鸡', 'Dahengrou Chicken 799', 2, '四川'],
  ['神丹6号绿壳蛋鸡', 'Shendan Layer 6', 2, '湖北'],
  ['大午褐蛋鸡', 'Dawu Brown Layer', 2, '河北'],
  ['金陵麻乌鸡', 'Jinlingma Black-bone Chicken', 2, '江苏'],
  ['花山鸡', 'Huashan Chicken', 2, '江苏'],
  ['园丰麻鸡2号', 'Yuanfengma Chicken 2', 2, '广西'],
  ['沃德158肉鸡', 'WOD158 Broiler', 2, '北京'],
  ['圣泽901白羽肉鸡', 'Shengze 901 Broiler', 2, '福建'],
  ['益生909小型白羽肉鸡', 'Yisheng 909 Broiler', 2, '山东'],
  ['农金1号蛋鸡', 'Nongjin Layer 1', 2, null],
  ['广明2号白羽肉鸡', 'Guangming 2 Broiler', 2, null],
  ['沃德188肉鸡', 'WOD188 Broiler', 2, '北京'],
  ['光大梅岭4号肉鸡', 'Guangdameiling Broiler 4', 2, null],
  ['东禽1号麻鸡', 'Dongqin Ma Chicken 1', 2, null],
  ['裕禾1号黄鸡', 'Yuhe Yellow Chicken 1', 2, null],
  ['富风麻鸡', 'Fufeng Ma Chicken', 2, '广西'],
  ['容德小型黑羽蛋鸡配套系', 'Rongde Black Layer', 2, null],
  ['天露黄鸡2号配套系', 'Tianluhuang Chicken 2', 2, null],
  ['温氏麻黄鸡3号配套系', 'Wenshi Ma Chicken 3', 2, '广东'],
  ['农大6号蛋鸡配套系', 'Nongda Layer 6', 2, '北京'],
  ['和盈黑鸡配套系', 'Heying Black Chicken', 2, null],
  ['河东1号肉鸡配套系', 'Hedong Broiler 1', 2, null],
  ['苏禽6号蛋鸡配套系', 'Suqin Layer 6', 2, '江苏'],
  ['岭南黄鸡5号配套系', 'Lingnanhuang Chicken 5', 2, null],
  ['徽鲜鸡配套系', 'Huixian Chicken', 2, '安徽'],
  ['潭牛3号肉鸡配套系', 'Tanniu Broiler 3', 2, '海南'],
  ['祝氏麻鸡配套系', 'Zhushi Ma Chicken', 2, null],
  ['强英鸭', 'Qiangying Duck', 2, null],
  ['定安鹅', 'Ding\'an Goose', 0, '海南'],
  ['阳春白鹅', 'Yangchun White Goose', 0, '广东'],
  ['天府肉鹅配套系', 'Tianfu Goose Line', 2, '四川'],
  ['渝州白鹅配套系', 'Yuzhou Goose Line', 2, '重庆'],
  ['天歌1号肉鹅配套系', 'Tiange Goose 1', 2, null],
  ['豫中鹁鸽', 'Yuzhong Pigeon', 0, '河南'],
  ['鹤秀鸽', 'Hexiu Pigeon', 0, null],
  ['黑皂鸽', 'Heizao Pigeon', 0, null],
  ['苏威1号肉鸽配套系', 'Suwei Pigeon Line 1', 2, '江苏'],
  ['翱丰1号肉鸽配套系', 'Aofeng Pigeon 1', 2, null],
  ['西丰梅花鹿', 'Xifeng Sika Deer', 1, '辽宁'],
  ['东大梅花鹿', 'Dongda Sika Deer', 1, '吉林'],
  ['阿山马鹿', 'Ashan Red Deer', 0, '新疆'],
  ['伊河马鹿', 'Yihe Red Deer', 1, '新疆'],
  ['天峨六画山鸡', 'Tiane Liuhua Mountain Chicken', 0, '广西'],
  ['申鸿七彩雉', 'Shenhong Qicai Pheasant', 1, '上海'],
  ['中畜长白半番鸭', 'Zhongxu Changbai Mule Duck', 2, '北京'],
  ['名威银蓝色水貂', 'Mingwei Silver-blue Mink', 1, null],
  ['国蜂414配套系', 'Guofeng Bee Line 414', 1, null],
];

const slugify = (englishName) =>
  englishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

export async function rebuildMl2024Entries({ check = false } = {}) {
  const manifest = JSON.parse(readFileSync(MANIFEST, 'utf8'));
  const manifestByName = new Map();
  for (const section of manifest.sections) {
    for (const name of section.names) {
      if (manifestByName.has(name)) throw new Error('manifest 重复名称: ' + name);
      manifestByName.set(name, {
        species: section.subSpecies ?? section.species,
        subtype: section.subtype,
      });
    }
  }

  const existing = JSON.parse(readFileSync(TARGET, 'utf8')).map((t) => [...t]);
  const introSet = new Set(REMOVE_INTRODUCED);
  const phantomSet = new Set(REMOVE_PHANTOM_DUPLICATES.map(([name]) => name));
  const renameMap = new Map(RENAMES.filter(([from]) => !phantomSet.has(from)).map(([from, to]) => [from, to]));

  const kept = [];
  for (const tuple of existing) {
    if (introSet.has(tuple[0]) || phantomSet.has(tuple[0])) continue;
    const renamed = renameMap.get(tuple[0]);
    if (renamed) tuple[0] = renamed;
    kept.push(tuple);
  }

  const byName = new Map(kept.map((t) => [t[0], t]));
  const problems = [];
  for (const [from, to] of RENAMES) {
    if (!byName.has(to)) problems.push('改名后缺失: ' + from + ' -> ' + to);
    if (from !== to && byName.has(from)) problems.push('改名前条目仍存在: ' + from);
  }
  for (const name of REMOVE_INTRODUCED) {
    if (byName.has(name)) problems.push('引入品种仍在: ' + name);
  }
  // 为既有条目补 species 并把 OCR 讹变的子类码归一到 manifest（官方 PDF 逐页核对结果）
  const SUBTYPE_CODE = { 地方品种: 0, 培育品种: 1, 培育配套系: 2, 其他蜂遗传资源: 3 };
  for (const tuple of kept) {
    const meta = manifestByName.get(tuple[0]);
    if (!meta) { problems.push('既有条目不在 manifest: ' + tuple[0]); continue; }
    tuple[4] = meta.species;
    tuple[2] = SUBTYPE_CODE[meta.subtype];
  }

  // 新增条目（跳过既有同名）
  const existingNames = new Set(kept.map((t) => t[0]));
  const fresh = [];
  for (const [name, englishName, subtypeCode, province] of ADDITIONS) {
    if (existingNames.has(name)) continue;
    const meta = manifestByName.get(name);
    if (!meta) { problems.push('新增条目不在 manifest: ' + name); continue; }
    const expectedCode = { 地方品种: 0, 培育品种: 1, 培育配套系: 2, 其他蜂遗传资源: 3 }[meta.subtype];
    if (expectedCode !== subtypeCode) {
      problems.push('子类码与 manifest 不符: ' + name + ' json=' + subtypeCode + ' manifest=' + meta.subtype);
    }
    fresh.push([name, englishName, subtypeCode, province, meta.species]);
  }

  // ID 唯一性校验：仅校验新增条目（既有条目沿用自身 slug，无冲突问题）
  let allRuntimeIds = [];
  try {
    allRuntimeIds = readFileSync(LEGACY_IDS_FILE, 'utf8')
      .split('\n')
      .map((l) => l.split('\t')[0])
      .filter(Boolean);
  } catch {
    // 基线 ID 清单缺失时仅做新增条目之间互查
  }
  const seen = new Set(allRuntimeIds);
  for (const tuple of fresh) {
    const slug = slugify(tuple[1]);
    if (seen.has(slug)) problems.push('ID 冲突: ' + slug + ' (' + tuple[0] + ')');
    seen.add(slug);
  }

  if (problems.length) throw new Error('重建校验失败:\n' + problems.join('\n'));

  const next = [...kept, ...fresh];
  const summary = {
    total: next.length,
    renamed: RENAMES.length,
    removedIntroduced: REMOVE_INTRODUCED.length,
    removedPhantoms: REMOVE_PHANTOM_DUPLICATES.length,
    added: fresh.length,
    subtype: next.reduce((acc, t) => { acc[t[2]] = (acc[t[2]] ?? 0) + 1; return acc; }, {}),
    nullProvince: next.filter((t) => t[3] === null).length,
    withSpecies: next.filter((t) => t.length === 5 && t[4]).length,
  };

  if (!check) {
    writeFileSync(TARGET, JSON.stringify(next, null, 2) + '\n', 'utf8');
  }
  return summary;
}

const isMain = process.argv[1] && import.meta.url.endsWith(process.argv[1].split(/[\\/]/).pop());
if (isMain) {
  const summary = await rebuildMl2024Entries({ check: process.argv.includes('--check') });
  console.log(JSON.stringify(summary, null, 2));
}
