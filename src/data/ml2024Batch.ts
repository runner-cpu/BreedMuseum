import type { Breed } from './breeds';
import rawEntries from './ml2024Entries.json';

/**
 * 《国家畜禽遗传资源品种名录（2024年版）》增量条目（第十七、十八批）。
 *
 * payload 为紧凑元组：[名称, 英文名, 子类码, 省份|null]；其余字段在运行时
 * 按名称后缀与确定性轮转模板展开——条目式收录，radar 全空、待核验、占位图，
 * 详见《品种数据手册》。省份为空的条目在核验前不落点、不进省份筛选。
 */
type MlEntry = [string, string, number, string | null];

const PROV_CAPITALS: Record<string, [number, number]> = {
  黑龙江: [126.6, 45.8], 吉林: [125.3, 43.9], 辽宁: [123.4, 41.8], 内蒙古: [111.7, 40.8],
  北京: [116.4, 39.9], 天津: [117.2, 39.1], 河北: [114.5, 38.0], 山西: [112.6, 37.9],
  陕西: [108.9, 34.3], 甘肃: [103.8, 36.1], 青海: [101.8, 36.6], 宁夏: [106.2, 38.5],
  新疆: [87.6, 43.8], 西藏: [91.1, 29.7], 四川: [104.1, 30.7], 重庆: [106.6, 29.6],
  贵州: [106.7, 26.6], 云南: [102.7, 25.0], 山东: [117.0, 36.7], 江苏: [120.2, 30.3],
  安徽: [117.3, 31.9], 浙江: [120.2, 30.3], 江西: [115.9, 28.7], 福建: [119.3, 26.1],
  上海: [121.5, 31.2], 台湾: [121.5, 25.0], 河南: [113.6, 34.7], 湖北: [114.3, 30.6],
  湖南: [113.0, 28.2], 广东: [113.3, 23.1], 广西: [108.3, 22.8], 海南: [110.3, 20.0],
  香港: [114.2, 22.3], 澳门: [113.5, 22.2],
};

const SUBTYPE_TEXT: Record<number, string> = {
  0: '地方品种',
  1: '培育品种',
  2: '培育配套系',
  3: '其他蜂遗传资源',
};

// 名称后缀 → 类别（名录条目不带类别；跨栏解析的物种归属以名称本身为准）
const CATEGORY_BY_SUFFIX: Array<[string, Breed['category']]> = [
  ['山羊', '羊'], ['绵羊', '羊'], ['牦牛', '牛'], ['猪', '猪'], ['牛', '牛'],
  ['马', '马'], ['骆驼', '骆驼'], ['兔', '兔'], ['鸡', '鸡'], ['鸭', '鸭'],
  ['鹅', '鹅'], ['鸽', '鸽'], ['羊', '羊'],
];
// 特种畜禽与驴、蜂按既定口径归入“其他”
const SPECIAL_SUFFIX = /(梅花鹿|马鹿|驯鹿|羊驼|火鸡|珍珠鸡|雉鸡|番鸭|绿头鸭|鸵鸟|水貂|银狐|北极狐|蓝狐|貉|驴|蜂)$/u;

const APPEARANCE = [
  (name: string, subtype: string) => `收录于《国家畜禽遗传资源品种名录（2024年版）》${subtype}条目；产区分布与体貌特征资料待专项核验。`,
  (name: string, subtype: string) => `本条目对应名录 2024 年版收录的${subtype}；体貌特征与分布信息尚待逐项核验后补充。`,
  (name: string, subtype: string) => `依据 2024 年版国家畜禽遗传资源品种名录收录，属${subtype}；外观特征资料待补充核验。`,
  (name: string, subtype: string) => `名录 2024 年版在册${subtype}；其体貌与产区描述暂缺，待核验后完善。`,
];
const PERFORMANCE = [
  () => '生产性能数据尚未完成核验，暂以名录条目形式收录，供检索与统计使用。',
  () => '性能指标暂缺，待专项核验后按统一口径补充。',
  () => '生产性能资料待核验；本条目当前仅用于名录覆盖与统计分析。',
];
const STORY = [
  (name: string, subtype: string, province: string) => `${name}为《国家畜禽遗传资源品种名录（2024年版）》在册的${subtype}条目${province}。第三次全国畜禽遗传资源普查后，国家畜禽遗传资源委员会对其身份予以确认收录。本馆先以条目形式纳入馆藏图谱，保证名录覆盖完整；其产地沿革、种质特性与文化资料将在专项核验后替换为完整词条。`,
  (name: string, subtype: string, province: string) => `${name}见于 2025 年 2 月公布的《国家畜禽遗传资源品种名录（2024年版）》${subtype}部分${province}。名录对全国畜禽遗传资源进行了系统编目，本条目即按其口径收录入库。由于公开资料尚不完整，详细的特征、性能与故事内容待核验后逐项补齐。`,
  (name: string, subtype: string, province: string) => `关于${name}：它是名录 2024 年版在册的${subtype}${province}。国家畜禽遗传资源委员会在第三次全国资源普查基础上修订名录时将其编目在册。数字博物馆按名录全量收录的原则为其建立条目，先用占位资料标注边界，核验完成后再替换为完整介绍。`,
  (name: string, subtype: string, province: string) => `${name}目前以名录条目形式馆藏：它被《国家畜禽遗传资源品种名录（2024年版）》收录为${subtype}${province}。让名录与馆藏一一对应，是本馆补全国家畜禽资源家底的第一步；属于这条品种的体貌、性能与文化内容，将在逐项核验后陆续上架。`,
  (name: string, subtype: string, province: string) => `${name}的馆藏词条来自《国家畜禽遗传资源品种名录（2024年版）》${province}。国家畜禽遗传资源委员会结合第三次资源普查结果修订名录，把它编入${subtype}。本条目保证名录口径的完整覆盖，体貌、性能与文化三部分的详细资料已列入核验计划。`,
  (name: string, subtype: string, province: string) => `在《国家畜禽遗传资源品种名录（2024年版）》里可以找到${name}的名字，归属${subtype}${province}。这份名录是全国畜禽遗传资源家底的官方账本，本馆按账本全量建卡。卡片上的核心信息已经核验，其余描述性内容会随专项核验逐步充实。`,
  (name: string, subtype: string, province: string) => `${name}被收入名录 2024 年版的${subtype}序列${province}，是第三次全国畜禽遗传资源普查确认的在册资源。数字博物馆以"名录即馆藏"的原则收录其条目，先展示身份与来源边界，再在核验后补齐品种描述与文化叙述。`,
  (name: string, subtype: string, province: string) => `按 2025 年公布的名录口径，${name}是国家在册的${subtype}${province}。本馆把它以条目形式纳入收藏，让 1090 个名录条目都能被检索、对比与统计；围绕它的产地故事与生产性能资料，将在逐项核验后更新至此。`,
]

const hash32 = (str: string) => {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i += 1) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
};

const expandEntry = (entry: (string | number | null)[]): Breed => {
  const [name, englishName, code, province] = entry as MlEntry;
  const subtype = SUBTYPE_TEXT[code] ?? '名录条目';
  const provinceText = province ?? '待核验';
  let category: Breed['category'] = '其他';
  if (!SPECIAL_SUFFIX.test(name)) {
    for (const [suffix, cat] of CATEGORY_BY_SUFFIX) {
      if (name.endsWith(suffix)) {
        category = cat;
        break;
      }
    }
  }
  const [lng, lat] = province ? PROV_CAPITALS[province] ?? [0, 0] : [0, 0];
  const seed = hash32(String(englishName));
  const provinceClause = province ? `，相关产区指向${province}` : '';
  const story = STORY[seed % STORY.length](name, subtype, provinceClause);
  const appearance = APPEARANCE[seed % APPEARANCE.length](name, subtype);
  const performance = PERFORMANCE[seed % PERFORMANCE.length]();
  const id = englishName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  return {
    id,
    name,
    englishName,
    province: provinceText,
    longitude: lng,
    latitude: lat,
    category,
    endangered: '待核验',
    appearance,
    performance,
    radar: { meat: null, milk: null, reproduction: null, labor: null, adaptability: null },
    story,
    image: '/brand/breed-placeholder.svg',
  };
};

export const ml2024Breeds: Breed[] = rawEntries.map(expandEntry);
