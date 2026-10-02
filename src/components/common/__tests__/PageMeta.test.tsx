import { describe, expect, it } from 'vitest';
import { buildSiteAssetUrl, buildCanonicalUrl } from '../PageMeta';

describe('PageMeta URL handling', () => {
  it('resolves assets under the configured deployment base', () => {
    expect(buildSiteAssetUrl('brand/museum-mark.svg', 'https://example.test/BreedMuseum/')).toBe('https://example.test/BreedMuseum/brand/museum-mark.svg');
  });

  it('does not publish hash fragments as canonical URLs', () => {
    expect(buildCanonicalUrl('/encyclopedia', 'https://example.test/BreedMuseum/')).toBe('https://example.test/BreedMuseum/');
  });
});
