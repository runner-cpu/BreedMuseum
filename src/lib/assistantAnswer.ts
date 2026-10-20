import { categories, provinces } from '@/data/catalog';

/**
 * 馆藏助手的离线规则问答。
 *
 * 单独成模块并**按需加载数据**：助手按钮出现在每一页，如果它静态 import
 * `visibleBreeds`（约 660 kB，含 1186 条记录），首页首屏就要为它付一次完整数据下载。
 * 现在只有用户真的提问时才拉取数据，首屏静态图只保留目录词表。
 */

interface AssistantData {
  breeds: typeof import('@/data/visibleBreeds').visibleBreeds;
  matches: typeof import('@/data/breedSearch').matchesBreedQuery;
}

let dataPromise: Promise<AssistantData> | null = null;

function loadData(): Promise<AssistantData> {
  dataPromise ??= Promise.all([import('@/data/visibleBreeds'), import('@/data/breedSearch')]).then(
    ([visible, search]) => ({ breeds: visible.visibleBreeds, matches: search.matchesBreedQuery }),
  );
  return dataPromise;
}

export async function answerQuestion(input: string): Promise<string> {
  const query = input.trim();
  if (!query) return '可以问我品种名称、类别、产区或馆藏统计。';
  const { breeds, matches } = await loadData();

  const exact = breeds.find((breed) => breed.name === query) ?? breeds.find((breed) => matches(breed, query));
  if (exact) {
    return `${exact.name}属于${exact.category}，主要产区记录为${exact.province}。${exact.appearance || '体貌资料待补充。'} ${exact.performance || '生产性能资料待补充。'} 以上内容来自馆藏编辑字段，具体结论请以来源资料为准。`;
  }
  const province = provinces.find((item) => query.includes(item));
  if (province) {
    const rows = breeds.filter((breed) => breed.province === province);
    const names = rows.slice(0, 6).map((breed) => breed.name).join('、');
    return `${province}共有 ${rows.length} 条馆藏记录${names ? `，例如：${names}` : ''}。产区待核验记录不会被当作已确认落点。`;
  }
  const category = categories.find((item) => query.includes(item));
  if (category) {
    const rows = breeds.filter((breed) => breed.category === category);
    return `馆藏中${category}共有 ${rows.length} 条记录，覆盖 ${new Set(rows.map((breed) => breed.province).filter((item) => item !== '待核验')).size} 个已核验省份。`;
  }
  if (/多少|数量|统计|总共|几种|记录/.test(query)) {
    return `当前可浏览馆藏共 ${breeds.length.toLocaleString()} 条记录。地图仅展示同时具备图片与可落点坐标的记录。`;
  }
  return '我可以查询馆藏中的品种、类别、产区和统计数字。试试输入“东北民猪”“云南有哪些品种”或“鸡有多少条记录”。';
}
