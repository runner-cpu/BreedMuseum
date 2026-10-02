import { render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import CircularGallery from '../CircularGallery';

describe('CircularGallery reduced motion', () => {
  const originalMatchMedia = window.matchMedia;

  beforeEach(() => {
    window.matchMedia = ((query: string) => ({
      matches: query.includes('prefers-reduced-motion'),
      media: query,
      onchange: null,
      addEventListener() {},
      removeEventListener() {},
      addListener() {},
      removeListener() {},
      dispatchEvent: () => true,
    })) as typeof window.matchMedia;
  });

  afterEach(() => {
    window.matchMedia = originalMatchMedia;
  });

  it('does not schedule a RAF and exposes every item in reduced-motion mode', () => {
    const raf = vi.spyOn(window, 'requestAnimationFrame');
    render(<CircularGallery items={[{ text: '猪' }, { text: '牛' }, { text: '羊' }]} />);
    expect(raf).not.toHaveBeenCalled();
    expect(document.querySelector('[data-reduced-motion="true"]')).toBeTruthy();
    expect(screen.getAllByRole('button')).toHaveLength(3);
  });
});
