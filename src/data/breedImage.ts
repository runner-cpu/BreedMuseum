/**
 * A breed is eligible for visual browsing only when its record points to a
 * real image source. The shared project placeholder is intentionally excluded
 * from all visitor-facing collections.
 */
export const BREED_IMAGE_PLACEHOLDER = '/brand/breed-placeholder.svg';

export const hasBreedImage = (src?: string): boolean => {
  const value = src?.trim();
  if (!value) return false;
  return !value.includes('breed-placeholder');
};
