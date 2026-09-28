import { breeds, type Breed } from './breeds';
import { getBreedMetadata } from './breedMetadata';

const byId = new Map(breeds.map((breed) => [breed.id, breed]));

const fold = (value: string) => value.normalize('NFKC').trim().toLocaleLowerCase('zh-CN');

export function findBreedById(id: string | null): Breed | null {
  if (!id) return null;
  return byId.get(id) ?? null;
}

export function matchesBreedQuery(breed: Breed, query: string): boolean {
  const needle = fold(query);
  if (!needle) return true;
  const metadata = getBreedMetadata(breed);
  return [breed.name, breed.englishName, metadata.officialName, ...metadata.aliases]
    .map(fold)
    .some((value) => value.includes(needle));
}
