import { expect, test } from 'vitest';
import { breeds } from '../breeds';
import { hasBreedImage } from '../breedImage';
import { visibleBreeds } from '../visibleBreeds';

test('visitor-facing collection excludes every placeholder image record', () => {
  expect(visibleBreeds.length).toBeLessThan(breeds.length);
  expect(visibleBreeds.every((breed) => hasBreedImage(breed.image))).toBe(true);
  expect(visibleBreeds.some((breed) => breed.image.includes('breed-placeholder'))).toBe(false);
});
