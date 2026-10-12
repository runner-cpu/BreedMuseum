import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { breedImageOverrides } from '@/data/breedImageOverrides';

/**
 * 登记表守卫：任何进入 breedImageOverrides 的条目都必须满足——
 * 品种 id 存在、图片文件已随仓库提交、授权属于可复用白名单。
 * 空登记表时这些用例空转，行为保持不变。
 */
test('registered overrides point to existing local files and reusable licenses', () => {
  const ids = new Set(breeds.map((breed) => breed.id));
  for (const [id, credit] of Object.entries(breedImageOverrides)) {
    expect(ids.has(id)).toBe(true);
    expect(credit.src).toMatch(/^\/images\/breeds\/[\w.-]+$/);
    expect(existsSync(resolve('public', credit.src.replace(/^\//, '')))).toBe(true);
    expect(credit.license).toMatch(/^(CC0|Public [Dd]omain|CC BY(?:-SA)? [1-4]\.0)$/);
    expect(credit.author).not.toBe('');
    expect(credit.sourceUrl).toMatch(/^https:\/\/commons\.wikimedia\.org\//);
  }
});

test('override application swaps the image field at the dataset boundary', () => {
  for (const [id, credit] of Object.entries(breedImageOverrides)) {
    const breed = breeds.find((item) => item.id === id);
    if (!breed) continue;
    expect(breed.image).toBe(credit.src);
    expect(getBreedMetadata(breed).imageRights).toBe('verified');
    expect(getBreedMetadata(breed).imageSource).toContain(credit.license);
  }
});

test('with an empty registry no breed claims verified imagery', () => {
  if (Object.keys(breedImageOverrides).length === 0) {
    expect(breeds.some((breed) => getBreedMetadata(breed).imageRights === 'verified')).toBe(false);
  }
});

test('dataset image references are explicit and external URLs are not reused', () => {
  const external = breeds.filter((breed) => /^https?:\/\//.test(breed.image));
  const placeholder = '/brand/breed-placeholder.svg';

  // Every record must either point at an explicit project placeholder, a
  // registered local override, or an external historical image. Empty or
  // relative ad-hoc paths make it impossible for the cards to communicate
  // whether an image is available and where it came from.
  for (const breed of breeds) {
    expect(
      breed.image === placeholder ||
        /^https?:\/\//.test(breed.image) ||
        /^\/images\/breeds\/[\w.-]+$/.test(breed.image),
    ).toBe(true);
  }

  // A single image must not silently represent multiple breeds. The
  // placeholder is intentionally shared and is excluded from this check.
  expect(new Set(external.map((breed) => breed.image)).size).toBe(external.length);
});
