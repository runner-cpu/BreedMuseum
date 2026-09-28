import { render, screen } from '@testing-library/react';
import { expect, test } from 'vitest';
import { BrandLogo } from '@/components/brand/BrandLogo';

test('renders the compact mark with an accessible museum name', () => {
  render(<BrandLogo compact />);
  expect(screen.getByRole('img', { name: '中国地方畜禽品种数字博物馆' })).toHaveAttribute(
    'src',
    '/brand/museum-mark.svg',
  );
});

test('renders the wordmark for wide layouts', () => {
  render(<BrandLogo />);
  expect(screen.getByRole('img', { name: '中国地方畜禽品种数字博物馆' })).toHaveAttribute(
    'src',
    '/brand/museum-wordmark.svg',
  );
});
