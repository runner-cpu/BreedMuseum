import { hasBreedImage } from './breedImage';
import { breeds } from './breeds';

/** Visitor-facing collection: records without a real image are omitted. */
export const visibleBreeds = breeds.filter((breed) => hasBreedImage(breed.image));
