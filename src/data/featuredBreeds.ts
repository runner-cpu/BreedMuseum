import { breeds, type Breed } from './breeds';

/**
 * 首页“精选品种”展示名单。
 * 全部选用青海主场代表（高原牦牛、环湖牦牛、欧拉羊、藏羊系、大通马、
 * 柴达木双峰驼等），突出青藏高原种质资源差异；条目缺失时以
 * “真实配图 + 故事完整度 + 指标完备度”的确定性评分自动补足。
 */
const curatedIds = [
  'qinghai-plateau-yak', // 青海高原牦牛 · 青海 · 牛
  'huanhu-yak', // 环湖牦牛 · 青海 · 牛
  'oula-sheep', // 欧拉羊 · 甘肃（环青海湖牧区毗邻）· 羊
  'qinghai-black-sheep', // 青海黑藏羊 · 青海 · 羊
  'zeku-sheep', // 泽库羊（藏羊）· 青海 · 羊
  'datong-horse', // 大通马 · 青海 · 马
  'chaidamu-bactrian-camel', // 柴达木双峰驼 · 青海 · 骆驼
  'chaidamurong-goat', // 柴达木绒山羊 · 青海 · 羊
  'huzhu-pig', // 互助猪 · 青海 · 猪
  'haidong-chicken', // 海东鸡 · 青海 · 鸡
  'qinghai-donkey', // 青海毛驴 · 青海 · 驴
  'guide-black-sheep', // 贵德黑裘皮羊 · 青海 · 羊
] as const;

export const FEATURED_BREED_COUNT = 12;

const byId = new Map(breeds.map((breed) => [breed.id, breed]));

const curated = curatedIds
  .map((id) => byId.get(id))
  .filter((breed): breed is Breed => Boolean(breed))
  .slice(0, FEATURED_BREED_COUNT);

const scoreBreed = (breed: Breed) => {
  let value = 0;
  if (!breed.image.includes('breed-placeholder')) value += 40;
  value += Math.min(breed.story.length / 10, 30);
  const radarValues = Object.values(breed.radar ?? {});
  if (radarValues.length > 0) {
    value += (radarValues.filter((v) => typeof v === 'number').length / radarValues.length) * 20;
  }
  if (breed.appearance.length >= 60) value += 10;
  return value;
};

const autofill = (picked: Breed[]): Breed[] => {
  const chosen = new Set(picked.map((breed) => breed.id));
  const categoryUsed = new Map<string, number>();
  for (const breed of picked) {
    categoryUsed.set(breed.category, (categoryUsed.get(breed.category) ?? 0) + 1);
  }
  const pool = [...breeds]
    .filter((breed) => !chosen.has(breed.id))
    .sort((a, b) => scoreBreed(b) - scoreBreed(a) || a.id.localeCompare(b.id));
  const result = [...picked];
  while (result.length < FEATURED_BREED_COUNT && pool.length > 0) {
    // 每个类别至多出现两次，保证首页画像多样
    const next = pool.find((breed) => (categoryUsed.get(breed.category) ?? 0) < 2) ?? pool[0];
    pool.splice(pool.indexOf(next), 1);
    chosen.add(next.id);
    categoryUsed.set(next.category, (categoryUsed.get(next.category) ?? 0) + 1);
    result.push(next);
  }
  return result;
};

export const featuredBreeds: Breed[] = curated.length >= FEATURED_BREED_COUNT ? curated : autofill(curated);
