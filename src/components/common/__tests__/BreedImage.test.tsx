import { fireEvent, render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BreedImage } from '@/components/common/BreedImage';

test('keeps its frame and swaps a failed remote image to the SVG fallback', () => {
  render(<BreedImage src="https://example.invalid/breed.jpg" alt="独龙牛" className="aspect-[4/3]" />);
  const image = screen.getByRole('img', { name: '独龙牛' });
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/brand/breed-placeholder.svg');
  expect(image.parentElement).toHaveClass('aspect-[4/3]');
  fireEvent.error(image);
  expect(image).toHaveAttribute('src', '/brand/breed-placeholder.svg');
});

test('only eager-loads explicitly prioritised imagery', () => {
  const { rerender } = render(<BreedImage src="/one.jpg" alt="one" />);
  expect(screen.getByRole('img', { name: 'one' })).toHaveAttribute('loading', 'lazy');
  rerender(<BreedImage src="/two.jpg" alt="two" eager />);
  expect(screen.getByRole('img', { name: 'two' })).toHaveAttribute('loading', 'eager');
});
