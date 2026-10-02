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
for (const breed of breeds) {
  const metadata = getBreedMetadata(breed);
  searchIndex.set(
    breed.id,
    [breed.name, breed.englishName, metadata.officialName, ...metadata.aliases]
      .map(normalizeBreedQuery)
      .filter(Boolean),
  );
}

export function findBreedById(id: string | null): Breed | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

export function matchesBreedQuery(breed: Breed, query: string): boolean {
  const needle = normalizeBreedQuery(query);
  if (!needle) return true;
  const values = searchIndex.get(breed.id) ?? (() => {
    const metadata = getBreedMetadata(breed);
    return [breed.name, breed.englishName, metadata.officialName, ...metadata.aliases]
      .map(normalizeBreedQuery)
      .filter(Boolean);
  })();
  return values.some((value) => value.includes(needle));
}
