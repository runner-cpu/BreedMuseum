import { breeds, type Breed } from './breeds';

/**
 * 首页“精选品种”展示名单。
 * 手工遴选兼顾类别与产区代表性的名品；若数据变更导致条目缺失，
 * 以“真实配图 + 故事完整度 + 指标完备度”的确定性评分自动补足，
 * 保证该模块始终展示资料最完善的记录而非数据批次末尾的待核验条目。
 */
const curatedIds = [
  'qinchuan-cattle', // 秦川牛 · 陕西 · 牛
  'meishan-pig', // 梅山猪 · 江苏 · 猪
  'hu-sheep', // 湖羊 · 浙江 · 羊
  'beijing-oil-chicken', // 北京油鸡 · 北京 · 鸡
  'beijing-duck', // 北京鸭 · 北京 · 鸭
  'shitou-goose', // 狮头鹅 · 广东 · 鹅
  'tan-sheep', // 滩羊 · 宁夏 · 羊
  'xinjiang-horse', // 伊犁马 · 新疆 · 马
  'alashan-camel', // 阿拉善双峰驼 · 内蒙古 · 骆驼
  'haerbin-white-rabbit', // 哈尔滨大白兔 · 黑龙江 · 兔
  'shiqi-pigeon', // 石岐鸽 · 广东 · 鸽
  'hebei-donkey', // 德州驴 · 山东 · 其他
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
