import { breeds, type Breed } from './breeds';
import { getBreedMetadata } from './breedMetadata';

const byId = new Map(breeds.map((breed) => [breed.id, breed]));

/**
 * Normalise user input once at the search boundary. NFKC handles full-width
 * latin characters and removing whitespace makes pasted names predictable.
 * We intentionally do not invent pinyin or simplified/traditional aliases;
 * only names present in the reviewed metadata are searchable.
 */
export const normalizeBreedQuery = (value: string) =>
  value.normalize('NFKC').toLocaleLowerCase('zh-CN').replace(/\s+/gu, '').trim();

const searchIndex = new Map<string, string[]>();
const contentIndex = new Map<string, string[]>();
for (const breed of breeds) {
  const metadata = getBreedMetadata(breed);
  searchIndex.set(
    breed.id,
    [breed.name, breed.englishName, metadata.officialName, ...metadata.aliases]
      .map(normalizeBreedQuery)
      .filter(Boolean),
  );
  contentIndex.set(
    breed.id,
    [breed.appearance, breed.performance, breed.story].map(normalizeBreedQuery).filter(Boolean),
  );
}

export function findBreedById(id: string | null): Breed | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

function matchesNameQuery(breed: Breed, needle: string): boolean {
  const values = searchIndex.get(breed.id) ?? (() => {
    const metadata = getBreedMetadata(breed);
    return [breed.name, breed.englishName, metadata.officialName, ...metadata.aliases]
      .map(normalizeBreedQuery)
      .filter(Boolean);
  })();
  return values.some((value) => value.includes(needle));
}

/**
 * 名称/别名/英文名命中。
 */
export function matchesBreedNameQuery(breed: Breed, query: string): boolean {
  const needle = normalizeBreedQuery(query);
  if (!needle) return true;
  return matchesNameQuery(breed, needle);
}

/**
 * 搜索范围与《网站说明书》一致：名称命中之外，特征、性能与文化故事
 * 参与全文匹配。单字查询过于宽泛，全文匹配仅对 ≥2 字符的查询开放。
 */
export function matchesBreedQuery(breed: Breed, query: string): boolean {
  const needle = normalizeBreedQuery(query);
  if (!needle) return true;
  if (matchesNameQuery(breed, needle)) return true;
  if (needle.length < 2) return false;
  const content = contentIndex.get(breed.id);
  return content ? content.some((value) => value.includes(needle)) : false;
}

/**
 * 相关性排序：名称命中的品种排在全文命中的品种之前，其余保持原顺序。
 */
export function sortBreedsByRelevance(list: Breed[], query: string): Breed[] {
  const needle = normalizeBreedQuery(query);
  if (!needle) return list;
  return [...list].sort((a, b) => Number(matchesNameQuery(b, needle)) - Number(matchesNameQuery(a, needle)));
}
