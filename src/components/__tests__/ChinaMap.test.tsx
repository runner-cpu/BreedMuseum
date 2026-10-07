import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ChinaMap } from '@/components/ChinaMap';
import { endangeredLevels, type Breed } from '@/data/breeds';

const breed: Breed = {
  id: 'accessible-breed',
  name: 'Accessible breed',
  englishName: 'Accessible breed',
  province: '云南',
  longitude: 110,
  latitude: 35,
  category: 'Test',
  endangered: endangeredLevels[0],
  appearance: '',
  performance: '',
  radar: { meat: null, milk: null, reproduction: null, labor: null, adaptability: null },
  story: '',
  image: '',
};

const unverified: Breed = {
  ...breed,
  id: 'unverified-breed',
  name: 'Unverified breed',
  province: '待核验',
  longitude: 0,
  latitude: 0,
};

const defaultProps = {
  selectedProvince: null,
  selectedBreed: null,
  onProvinceClick: vi.fn(),
  onBreedClick: vi.fn(),
  onClearSelection: vi.fn(),
};

describe('ChinaMap accessibility', () => {
  it('exposes provinces as keyboard-operable buttons', () => {
    render(<ChinaMap {...defaultProps} breeds={[]} />);

    const province = document.querySelector('path[role="button"]');
    expect(province).not.toBeNull();
    expect(province).toHaveAttribute('tabindex', '0');
    expect(province).toHaveAttribute('aria-label');

    fireEvent.keyDown(province!, { key: 'Enter' });
    fireEvent.keyDown(province!, { key: ' ' });

    expect(defaultProps.onProvinceClick).toHaveBeenCalledTimes(2);
  });

  it('exposes breed points as pressed-state buttons with keyboard activation', () => {
    render(<ChinaMap {...defaultProps} breeds={[breed]} />);

    const point = screen.getByRole('button', { name: /Accessible breed/ });
    expect(point).toHaveAttribute('tabindex', '0');
    expect(point).toHaveAttribute('aria-pressed', 'false');

    fireEvent.keyDown(point, { key: 'Enter' });
    fireEvent.keyDown(point, { key: ' ' });

    expect(defaultProps.onBreedClick).toHaveBeenCalledTimes(2);
    expect(defaultProps.onBreedClick).toHaveBeenLastCalledWith(breed);
  });

  it('never renders unverified (0,0) sentinel records as focusable points', () => {
    render(<ChinaMap {...defaultProps} breeds={[breed, unverified]} />);

    expect(screen.getByRole('button', { name: /Accessible breed/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Unverified breed/ })).not.toBeInTheDocument();
  });
});
