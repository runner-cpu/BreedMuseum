import { type Breed } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { categories } from '@/data/catalog';
import { visibleBreeds } from '@/data/visibleBreeds';
import { hasMappableLocation } from '@/lib/geo/lightMapData';
import { CATEGORY_EN, PROVINCE_EN } from '@/lib/displayLabels';

/**
 * 互动厅出题器（纯函数，可单测）。
 *
 * 红线：题目与选项**只允许来自已核验字段**——类别（名录分组）、省份（有落点记录）、
 * 保护状态（940 号公告匹配）。待核验记录（哨兵坐标或“待核验”省份）不进题干、不作干扰项，
 * 避免把“未核实资料”包装成知识。
 *
 * 一切随机都由显式种子（局号）驱动，同一局可复现，便于 E2E 断言与答辩演示。
 */

export interface QuizOption {
  id: string;
  label: string;
  /** 选项的英文显示名（类别/省份走词表，品种取 englishName）；缺省时回退 label。 */
  labelEn?: string;
}

export interface QuizQuestion {
  /** 题型标识 */
  kind: 'category' | 'province' | 'protection' | 'silhouette';
  prompt: string;
  /** 英文题干。界面按语言二选一，避免英文界面里冒出整段中文。 */
  promptEn: string;
  /** 题干附带数据（如剪影类别） */
  subject: { id: string; name: string; category: string };
  /** 选项 `label` 是受控词表里的值（类别 / 省份 / 品种名），由界面负责翻译。 */
  options: QuizOption[];
  answerId: string;
  /** 一句话解析，需要可用官方来源回链 */
  explanation: string;
  explanationEn: string;
}

/** 确定性伪随机（mulberry32），保证同一局号输出完全一致。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T,>(items: readonly T[], random: () => number): T => items[Math.floor(random() * items.length)];

/** 抽样：从数组里取 `count` 个互不相同的元素。 */
const sample = <T,>(items: readonly T[], count: number, random: () => number): T[] => {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length > 0) {
    out.push(pool.splice(Math.floor(random() * pool.length), 1)[0]);
  }
  return out;
};

const isVerifiedForQuiz = (breed: Breed): boolean => hasMappableLocation(breed);

/**
 * 英文题干里的品种与产区也要用英文：馆藏数据的中文名不能直接塞进英文句子，
 * 否则切换语言后整道题仍是「济宁青山羊 / 山东」。没有英文名时回退到中文原名，
 * 至少保证句子结构完整、可读。
 */
const subjectName = (breed: { name: string; englishName?: string }, lang: 'zh' | 'en'): string =>
  lang === 'en' ? (breed.englishName || breed.name) : breed.name;
const categoryName = (category: string, lang: 'zh' | 'en'): string =>
  lang === 'en' ? (CATEGORY_EN[category] ?? category) : category;
const provinceName = (province: string, lang: 'zh' | 'en'): string =>
  lang === 'en' ? (PROVINCE_EN[province] ?? province) : province;

const protectedBreeds = (): Breed[] =>
  visibleBreeds.filter((breed) => getBreedMetadata(breed).protectionStatus === 'national-list');

/* ------------------------------------------------------------------ */
/* 题型 1：类别（“「XX」属于哪个类别？”）                                */
/* ------------------------------------------------------------------ */

function categoryQuestion(random: () => number): QuizQuestion {
  const pool = visibleBreeds.filter(isVerifiedForQuiz);
  const subject = pick(pool, random);
  const others = categories.filter((item) => item !== subject.category);
  const distractors = sample(others, 3, random);
  const options = sample(
    [subject.category, ...distractors].map((item) => ({ id: item, label: item, labelEn: categoryName(item, 'en') })),
    4,
    random,
  );
  return {
    kind: 'category',
    prompt: `「${subject.name}」属于下列哪个类别？`,
    promptEn: `Which category does ${subjectName(subject, 'en')} belong to?`,
    subject: { id: subject.id, name: subject.name, category: subject.category },
    options,
    answerId: subject.category,
    explanation: `${subject.name} 的类别与《国家畜禽遗传资源品种名录（2024年版）》的分组一致。`,
    explanationEn: `The category for ${subjectName(subject, 'en')} follows the grouping in the 2024 National Catalog of Livestock and Poultry Genetic Resources.`,
  };
}

/* ------------------------------------------------------------------ */
/* 题型 2：产区（“「XX」的产区在哪个省？”）                              */
/* ------------------------------------------------------------------ */

function provinceQuestion(random: () => number): QuizQuestion {
  const pool = visibleBreeds.filter(isVerifiedForQuiz);
  const subject = pick(pool, random);
  const sameCategory = pool.filter(
    (breed) => breed.category === subject.category && breed.province !== subject.province,
  );
  const fallback = pool.filter((breed) => breed.province !== subject.province);
  const distractorPool = (sameCategory.length >= 3 ? sameCategory : fallback).map((breed) => breed.province);
  const uniqueDistractors = [...new Set(distractorPool)].filter((item) => item !== subject.province);
  const distractors = sample(uniqueDistractors, 3, random);
  const options = sample(
    [subject.province, ...distractors].map((item) => ({ id: item, label: item, labelEn: provinceName(item, 'en') })),
    4,
    random,
  );
  return {
    kind: 'province',
    prompt: `「${subject.name}」的产区在哪个省级行政区？`,
    promptEn: `In which provincial region is ${subjectName(subject, 'en')} produced?`,
    subject: { id: subject.id, name: subject.name, category: subject.category },
    options,
    answerId: subject.province,
    explanation: `${subject.name} 的产区坐标为已核验记录，可在百科详情中查看来源范围。`,
    explanationEn: `The production site for ${subjectName(subject, 'en')} is a verified record; the encyclopedia entry lists its sources.`,
  };
}

/* ------------------------------------------------------------------ */
/* 题型 3：国家级保护（“下列哪个是国家级保护品种？”）                     */
/* ------------------------------------------------------------------ */

function protectionQuestion(random: () => number): QuizQuestion {
  const protectedPool = protectedBreeds();
  const answer = pick(protectedPool, random);
  const sameCategory = visibleBreeds.filter(
    (breed) =>
      isVerifiedForQuiz(breed) &&
      breed.category === answer.category &&
      getBreedMetadata(breed).protectionStatus !== 'national-list',
  );
  const pool = sameCategory.length >= 3 ? sameCategory : visibleBreeds.filter(
    (breed) => isVerifiedForQuiz(breed) && getBreedMetadata(breed).protectionStatus !== 'national-list',
  );
  const distractors = sample(pool, 3, random);
  const options = sample(
    [answer, ...distractors].map((breed) => ({ id: breed.id, label: breed.name, labelEn: subjectName(breed, 'en') })),
    4,
    random,
  );
  return {
    kind: 'protection',
    prompt: '下列哪个品种登载于农业农村部第 940 号公告（国家级保护名录）？',
    promptEn: 'Which of these breeds appears in MOA Announcement No. 940, the national protection list?',
    subject: { id: answer.id, name: answer.name, category: answer.category },
    options,
    answerId: answer.id,
    explanation: `${answer.name} 见于农业农村部第 940 号公告；其余选项未列入该公告。`,
    explanationEn: `${subjectName(answer, 'en')} appears in MOA Announcement No. 940; the other options are not on that list.`,
  };
}

/* ------------------------------------------------------------------ */
/* 题型 4：剪影（“这个剪影对应哪一类？”）                                */
/* ------------------------------------------------------------------ */

function silhouetteQuestion(random: () => number): QuizQuestion {
  const pool = visibleBreeds.filter(isVerifiedForQuiz);
  const subject = pick(pool, random);
  const others = categories.filter((item) => item !== subject.category);
  const options = sample(
    [subject.category, ...sample(others, 3, random)].map((item) => ({ id: item, label: item, labelEn: categoryName(item, 'en') })),
    4,
    random,
  );
  return {
    kind: 'silhouette',
    prompt: `这张剪影属于哪一类家畜？（提示：本站收录的「${categoryHint(subject.category)}」）`,
    promptEn: `Which category does this silhouette show? (Hint: the collection lists it as ${categoryHintEn(subject.category)})`,
    subject: { id: subject.id, name: subject.name, category: subject.category },
    options,
    answerId: subject.category,
    explanation: `剪影取自馆藏类别的四足/禽类轮廓；该题对应的代表品种是 ${subject.name}。`,
    explanationEn: `The silhouette is drawn from the collection's category outlines; the representative breed for this question is ${subjectName(subject, 'en')}.`,
  };
}

/** 剪影题中的弱提示（不直接给出类别名）。 */
function categoryHint(category: string): string {
  if (['猪'].includes(category)) return '偶蹄类家畜';
  if (['牛', '羊', '鹿', '骆驼'].includes(category)) return '偶蹄类反刍家畜';
  if (['马', '驴'].includes(category)) return '奇蹄类役用家畜';
  if (['鸡', '鸭', '鹅', '鸽'].includes(category)) return '家禽';
  if (category === '兔') return '小型草食家畜';
  if (category === '蜂') return '授粉昆虫';
  return '名录特种畜禽或蜂遗传资源';
}

function categoryHintEn(category: string): string {
  if (['猪'].includes(category)) return 'an even-toed farm animal';
  if (['牛', '羊', '鹿', '骆驼'].includes(category)) return 'an even-toed ruminant';
  if (['马', '驴'].includes(category)) return 'an odd-toed working animal';
  if (['鸡', '鸭', '鹅', '鸽'].includes(category)) return 'poultry';
  if (category === '兔') return 'a small herbivore';
  if (category === '蜂') return 'a pollinating insect';
  return 'a special livestock group or bee genetic resource';
}

const GENERATORS: Array<(random: () => number) => QuizQuestion> = [
  categoryQuestion,
  provinceQuestion,
  protectionQuestion,
  silhouetteQuestion,
];

/**
 * 生成一局知识问答（默认 5 题，四类题型轮转）。
 *
 * @param seed 局号（同一 seed 的题目、选项顺序与答案完全一致）
 */
export function generateQuiz(seed: number, count = 5): QuizQuestion[] {
  const random = createRandom(seed);
  const questions: QuizQuestion[] = [];
  for (let index = 0; index < count; index += 1) {
    const generator = GENERATORS[index % GENERATORS.length];
    questions.push(generator(random));
  }
  return questions;
}

/* ------------------------------------------------------------------ */
/* 找家挑战：在地图上点出产区                                          */
/* ------------------------------------------------------------------ */

export interface FindHomeRound {
  breed: { id: string; name: string; englishName: string; category: string; image: string };
  answerProvince: string;
  answerCoordinate: [number, number];
}

/** 找家挑战只出“省份与坐标都已核验”的题，保证距离提示可计算。 */
export function generateFindHomeRounds(seed: number, count = 3): FindHomeRound[] {
  const random = createRandom(seed * 7919 + 13);
  const pool = visibleBreeds.filter(isVerifiedForQuiz);
  return sample(pool, count, random).map((breed) => ({
    breed: {
      id: breed.id,
      name: breed.name,
      englishName: breed.englishName,
      category: breed.category,
      image: breed.image,
    },
    answerProvince: breed.province,
    answerCoordinate: [breed.longitude, breed.latitude],
  }));
}

/* ------------------------------------------------------------------ */
/* 识图挑战：看真实馆藏照片选类别                                       */
/* ------------------------------------------------------------------ */

export interface IdentifyRound {
  breed: { id: string; name: string; englishName: string; category: string; province: string; image: string };
  options: QuizOption[];
  answerId: string;
  explanation: string;
  explanationEn: string;
}

/**
 * 识图挑战出题：拿一张真实馆藏照片，问它属于哪一类。
 *
 * 为什么问「类别」而不是「哪个品种」：照片是历史 CDN 外链、品种级身份仍待核验，
 * 但「这是一头猪 / 一只鸡」在类别层面是可靠的；这样题目既用上真实图片，
 * 又不把未核验的品种归属包装成知识。
 */
export function generateIdentifyRounds(seed: number, count = 6): IdentifyRound[] {
  const random = createRandom(seed * 104729 + 7);
  const pool = visibleBreeds.filter(isVerifiedForQuiz);
  return sample(pool, count, random).map((breed) => {
    const others = categories.filter((item) => item !== breed.category);
    const options = sample(
      [breed.category, ...sample(others, 3, random)].map((item) => ({ id: item, label: item, labelEn: categoryName(item, 'en') })),
      4,
      random,
    );
    return {
      breed: {
        id: breed.id,
        name: breed.name,
        englishName: breed.englishName,
        category: breed.category,
        province: breed.province,
        image: breed.image,
      },
      options,
      answerId: breed.category,
      explanation: `这张馆藏照片记录的是「${breed.name}」，属于${breed.category}；产地记录为${breed.province}。`,
      explanationEn: `This collection photo shows ${subjectName(breed, 'en')}, a ${categoryName(breed.category, 'en')}; its recorded production site is ${provinceName(breed.province, 'en')}.`,
    };
  });
}

/** Haversine 距离（公里），用于“差 xx 公里”提示。 */
export function haversineKm(a: [number, number], b: [number, number]): number {
  const toRad = (value: number) => (value * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(b[1] - a[1]);
  const dLon = toRad(b[0] - a[0]);
  const lat1 = toRad(a[1]);
  const lat2 = toRad(b[1]);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
}

/** 省份名义中心点（作答后计算距离用；与 ml2024Batch 的省会表同源）。 */
export const PROVINCE_CENTROIDS: Record<string, [number, number]> = {
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
