/**
 * 品种智能推荐引擎：本地规则表 + 评分决策。
 *
 * 规则由人工依据品种志与名录资料编制（不调用任何外部模型），
 * 输入海拔区间、养殖目的与饲养模式，输出 0–100 的适应性评分与
 * 逐条推荐理由。评分口径为教学演示用途，不替代畜牧部门选种指导。
 */
import { breeds, type Breed } from './breeds';

export type AltitudeBand = 'low' | 'mid' | 'high' | 'veryHigh';
export type Purpose = 'meat' | 'milk' | 'wool' | 'labor' | 'egg';
export type HusbandryMode = 'grazing' | 'shed';

export interface RecommendInput {
  altitude: AltitudeBand;
  purpose: Purpose;
  mode: HusbandryMode;
}

export interface BreedRule {
  /** 馆藏品种 id */
  id: string;
  /** 适宜海拔区间（含端点，单位米） */
  altitudeRange: [number, number];
  /** 匹配的生产方向 */
  purposes: Purpose[];
  /** 适配的饲养模式 */
  modes: HusbandryMode[];
  /** 规则说明（进入推荐理由） */
  note: string;
}

export interface Recommendation {
  breed: Breed;
  score: number;
  /** 面向展示的三条决策路径拆解（海拔 / 用途 / 模式） */
  factors: Array<{ label: string; detail: string; matched: boolean }>;
  reasons: string[];
}

export const ALTITUDE_BANDS: Record<AltitudeBand, { label: string; range: [number, number] }> = {
  low: { label: '低海拔（< 1500 米）', range: [0, 1500] },
  mid: { label: '中海拔（1500–3000 米）', range: [1500, 3000] },
  high: { label: '高海拔（3000–4200 米）', range: [3000, 4200] },
  veryHigh: { label: '超高海拔（> 4200 米）', range: [4200, 6000] },
};

export const PURPOSE_LABELS: Record<Purpose, string> = {
  meat: '肉用',
  milk: '奶用',
  wool: '毛绒用',
  labor: '役用 / 骑乘',
  egg: '蛋用',
};

export const MODE_LABELS: Record<HusbandryMode, string> = {
  grazing: '放牧',
  shed: '舍饲 / 半舍饲',
};

/**
 * 规则表：覆盖青藏高原及周边（青海、西藏、甘肃、四川、云南、新疆）
 * 馆藏品种。其余品种不参与推荐，避免给出无依据结论。
 *
 * 2026-10 瘦身：删除低海拔农区品种规则（滩羊、小尾寒羊、湖羊、蒙古羊、
 * 哈萨克羊、阿勒泰羊、辽宁绒山羊、中卫山羊、太行山羊、内蒙古绒山羊、
 * 河西绒山羊、伊犁马），使推荐结果全部落在高原与高寒辐射带产区。
 */
export const BREED_RULES: BreedRule[] = [
  // —— 牦牛 ——
  { id: 'qinghai-plateau-yak', altitudeRange: [2800, 5200], purposes: ['meat', 'milk', 'labor'], modes: ['grazing'], note: '青海高原牦牛为高寒牧区核心畜种，耐寒耐低氧，乳肉兼用。' },
  { id: 'huanhu-yak', altitudeRange: [2800, 4500], purposes: ['meat', 'milk'], modes: ['grazing'], note: '环湖牦牛适应青海湖流域高寒草原，抗逆性强。' },
  { id: 'yushu-yak', altitudeRange: [3200, 5200], purposes: ['meat', 'milk', 'labor'], modes: ['grazing'], note: '玉树牦牛长期适应三江源高寒低氧环境。' },
  { id: 'xueduo-yak', altitudeRange: [3200, 5000], purposes: ['meat', 'milk'], modes: ['grazing'], note: '雪多牦牛为黄河源头产区地方品种。' },
  { id: 'ashendan-yak', altitudeRange: [3000, 4800], purposes: ['milk'], modes: ['grazing', 'shed'], note: '阿什旦牦牛为培育牦牛品种，产奶性能相对突出。' },
  { id: 'datong-yak', altitudeRange: [2600, 4200], purposes: ['meat', 'milk'], modes: ['grazing', 'shed'], note: '大通牦牛为培育品种，体格较大、生长较快。' },
  { id: 'maihua-yak', altitudeRange: [2800, 4500], purposes: ['meat', 'milk'], modes: ['grazing'], note: '麦洼牦牛为川西北高原代表品种。' },
  { id: 'jiulong-yak', altitudeRange: [2500, 4200], purposes: ['meat', 'labor'], modes: ['grazing'], note: '九龙牦牛以体格大著称。' },
  { id: 'pali-yak', altitudeRange: [3600, 5200], purposes: ['meat', 'milk'], modes: ['grazing'], note: '帕里牦牛适应喜马拉雅高寒环境。' },
  { id: 'sibu-yak', altitudeRange: [3600, 5200], purposes: ['milk'], modes: ['grazing'], note: '斯布牦牛产乳性能在西藏产区较为突出。' },
  { id: 'niangya-yak', altitudeRange: [3600, 5000], purposes: ['meat', 'milk'], modes: ['grazing'], note: '娘亚牦牛为藏北高原地方品种。' },
  { id: 'gannan-yak', altitudeRange: [2800, 4200], purposes: ['meat', 'milk'], modes: ['grazing'], note: '甘南牦牛适应甘南高寒草甸。' },
  { id: 'tianzhu-white-yak', altitudeRange: [2800, 4200], purposes: ['meat', 'wool'], modes: ['grazing'], note: '天祝白牦牛为珍稀白色牦牛群体，尾毛可作工艺原料。' },
  { id: 'xizanggaoshan-yak', altitudeRange: [3500, 5500], purposes: ['meat', 'labor'], modes: ['grazing'], note: '西藏高山牦牛适应极高海拔放牧。' },
  { id: 'yading-yak', altitudeRange: [3000, 4800], purposes: ['meat', 'milk'], modes: ['grazing'], note: '亚丁牦牛为川西高海拔地方品种。' },
  { id: 'sunan-yak', altitudeRange: [2600, 4200], purposes: ['meat', 'milk'], modes: ['grazing'], note: '肃南牦牛为祁连山北麓代表品种。' },
  { id: 'subei-yak', altitudeRange: [2800, 4500], purposes: ['meat', 'milk'], modes: ['grazing'], note: '肃北牦牛适应河西走廊高寒山区。' },
  { id: 'chawula-yak', altitudeRange: [3800, 5200], purposes: ['meat', 'milk'], modes: ['grazing'], note: '查吾拉牦牛为藏北高原地方群体。' },
  { id: 'meiren-yak', altitudeRange: [2800, 4000], purposes: ['meat', 'milk'], modes: ['grazing'], note: '美仁牦牛为甘南合作一带地方群体。' },

  // —— 绵羊 / 藏羊 ——
  { id: 'qinghai-black-sheep', altitudeRange: [2600, 4600], purposes: ['meat', 'wool'], modes: ['grazing'], note: '青海黑藏羊为高原特色藏羊群体，肉毛兼用。' },
  { id: 'oula-sheep', altitudeRange: [2800, 4200], purposes: ['meat'], modes: ['grazing'], note: '欧拉羊为甘南高原著名肉用型藏羊。' },
  { id: 'zeku-sheep', altitudeRange: [3000, 4400], purposes: ['meat', 'wool'], modes: ['grazing'], note: '泽库羊为青海高寒牧区藏羊品种。' },
  { id: 'xizang-sheep', altitudeRange: [3000, 5200], purposes: ['meat', 'wool'], modes: ['grazing'], note: '西藏羊（藏羊）适应高寒放牧，毛肉兼用。' },
  { id: 'guide-black-sheep', altitudeRange: [2200, 3800], purposes: ['wool', 'meat'], modes: ['grazing', 'shed'], note: '贵德黑裘皮羊以二毛裘皮著称。' },
  { id: 'qinghai-semifine-sheep', altitudeRange: [2400, 3800], purposes: ['wool', 'meat'], modes: ['grazing', 'shed'], note: '青海半细毛羊为毛肉兼用培育品种。' },
  { id: 'qinghaimaoroujianyongximao-sheep', altitudeRange: [2400, 3800], purposes: ['wool', 'meat'], modes: ['grazing', 'shed'], note: '青海毛肉兼用细毛羊面向毛肉双目标。' },
  { id: 'qinghaigaoyuanmaoroujianyongbanximao-sheep', altitudeRange: [2600, 4000], purposes: ['wool', 'meat'], modes: ['grazing', 'shed'], note: '青海高原毛肉兼用半细毛羊耐寒、毛质稳定。' },
  { id: 'maduo-sheep', altitudeRange: [3800, 4800], purposes: ['meat'], modes: ['grazing'], note: '玛多羊为黄河源头高海拔地方群体。' },
  { id: 'zhashenjia-sheep', altitudeRange: [3000, 4400], purposes: ['meat', 'wool'], modes: ['grazing'], note: '扎什加羊为玉树产区藏羊群体。' },
  { id: 'liangshanhei-sheep', altitudeRange: [2000, 3600], purposes: ['meat'], modes: ['grazing'], note: '凉山黑绵羊适应川西南山地放牧。' },
  { id: 'diqing-sheep', altitudeRange: [2600, 4000], purposes: ['meat', 'wool'], modes: ['grazing'], note: '迪庆绵羊适应滇西北高原。' },

  // —— 山羊 ——
  { id: 'chaidamu-goat', altitudeRange: [2600, 4000], purposes: ['meat', 'wool'], modes: ['grazing'], note: '柴达木山羊适应柴达木盆地干旱高寒环境。' },
  { id: 'chaidamurong-goat', altitudeRange: [2600, 4000], purposes: ['wool'], modes: ['grazing', 'shed'], note: '柴达木绒山羊以羊绒品质见长。' },

  // —— 马 / 骆驼 ——
  { id: 'datong-horse', altitudeRange: [2200, 4000], purposes: ['labor'], modes: ['grazing', 'shed'], note: '大通马适应青藏高原东部，乘挽兼用。' },
  { id: 'yushu-horse', altitudeRange: [3200, 4800], purposes: ['labor'], modes: ['grazing'], note: '玉树马为三江源高海拔乘用马。' },
  { id: 'menyuan-horse', altitudeRange: [2400, 3800], purposes: ['labor'], modes: ['grazing', 'shed'], note: '门源马适应祁连山冷凉牧区。' },
  { id: 'chaidamu-horse', altitudeRange: [2600, 3800], purposes: ['labor'], modes: ['grazing'], note: '柴达木马适应干旱高寒荒漠草原。' },
  { id: 'chaidamu-bactrian-camel', altitudeRange: [2600, 3600], purposes: ['labor', 'milk'], modes: ['grazing'], note: '柴达木双峰驼适应荒漠高寒，驮运与产奶兼用。' },
  { id: 'qinghai-camel', altitudeRange: [2600, 3600], purposes: ['labor', 'milk'], modes: ['grazing'], note: '青海双峰驼适应环湖与柴达木荒漠区。' },

  // —— 猪 / 鸡 ——
  { id: 'huzhu-pig', altitudeRange: [2000, 3200], purposes: ['meat'], modes: ['shed', 'grazing'], note: '互助猪为青海地方猪种，耐粗饲、适应冷凉气候。' },
  { id: 'tibetan-pig', altitudeRange: [2500, 4200], purposes: ['meat'], modes: ['grazing', 'shed'], note: '藏猪适合高原林牧交错区放牧与半舍饲。' },
  { id: 'bamei-pig', altitudeRange: [1800, 3000], purposes: ['meat'], modes: ['shed', 'grazing'], note: '八眉猪为西北地方猪种，耐寒耐粗饲。' },
  { id: 'haidong-chicken', altitudeRange: [1800, 3000], purposes: ['egg', 'meat'], modes: ['shed', 'grazing'], note: '海东鸡适应青海东部农业区，蛋肉兼用。' },
  { id: 'tibetan-chicken', altitudeRange: [2500, 4000], purposes: ['egg', 'meat'], modes: ['grazing', 'shed'], note: '藏鸡耐低氧、耐粗饲，适合高原庭院养殖。' },

  // —— 驴 ——
  { id: 'qinghai-donkey', altitudeRange: [2000, 3800], purposes: ['labor'], modes: ['grazing', 'shed'], note: '青海毛驴适应高原农区役用与驮运。' },
];

/** 简单稳定哈希：用于同分排序的可复现打散，避免结果随渲染顺序跳动 */
function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i += 1) {
    h = (h * 31 + input.charCodeAt(i)) >>> 0;
  }
  return h;
}

function altitudeFit(range: [number, number], band: [number, number]): { score: number; reason?: string } {
  const overlap = Math.min(range[1], band[1]) - Math.max(range[0], band[0]);
  if (overlap >= 0) return { score: 40 };
  const distance = range[0] > band[1] ? range[0] - band[1] : band[0] - range[1];
  const score = Math.max(0, 40 - distance / 50);
  return { score, reason: `海拔适配边缘：适宜区间 ${range[0]}–${range[1]} 米` };
}

export function recommendBreeds(input: RecommendInput, limit = 5): Recommendation[] {
  const band = ALTITUDE_BANDS[input.altitude];
  const results: Recommendation[] = [];

  for (const rule of BREED_RULES) {
    const breed = breeds.find((b) => b.id === rule.id);
    if (!breed) continue;

    const reasons: string[] = [];
    const factors: Recommendation['factors'] = [];
    const fit = altitudeFit(rule.altitudeRange, band.range);
    let score = fit.score;
    factors.push({
      label: '海拔匹配',
      detail: `：适宜区间 ${rule.altitudeRange[0]}–${rule.altitudeRange[1]} 米，当前${band.label}${fit.reason ? '（边缘适配）' : ''}`,
      matched: !fit.reason,
    });
    if (fit.reason) reasons.push(fit.reason);

    const purposeMatched = rule.purposes.includes(input.purpose);
    if (purposeMatched) {
      score += 35;
      reasons.push(`生产方向匹配：${PURPOSE_LABELS[input.purpose]}（${rule.note}）`);
    } else {
      score += 8;
      reasons.push(`生产方向为次要匹配：该品种以${rule.purposes.map((p) => PURPOSE_LABELS[p]).join('、')}见长`);
    }
    factors.push({
      label: '用途匹配',
      detail: `：目标${PURPOSE_LABELS[input.purpose]}，该品种以${rule.purposes.map((p) => PURPOSE_LABELS[p]).join('、')}为主`,
      matched: purposeMatched,
    });

    const modeMatched = rule.modes.includes(input.mode);
    if (modeMatched) {
      score += 25;
      reasons.push(`饲养模式匹配：${MODE_LABELS[input.mode]}`);
    } else {
      score += 6;
      reasons.push(`饲养模式需要调整：该品种通常采用${rule.modes.map((m) => MODE_LABELS[m]).join('或')}`);
    }
    factors.push({
      label: '模式匹配',
      detail: `：当前${MODE_LABELS[input.mode]}，该品种通常${rule.modes.map((m) => MODE_LABELS[m]).join('或')}`,
      matched: modeMatched,
    });

    if (score < 35) continue;
    results.push({ breed, score: Math.min(100, Math.round(score)), factors, reasons });
  }

  return results
    .sort((a, b) => b.score - a.score || stableHash(a.breed.id + input.altitude + input.purpose + input.mode) - stableHash(b.breed.id + input.altitude + input.purpose + input.mode))
    .slice(0, limit);
}
