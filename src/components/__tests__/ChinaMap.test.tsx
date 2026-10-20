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
  category: '鸡',
  endangered: endangeredLevels[0],
  appearance: '',
  performance: '',
  radar: { meat: null, milk: null, reproduction: null, labor: null, adaptability: null },
  story: '',
  image: '',
};

const nearby: Breed = {
  ...breed,
  id: 'nearby-breed',
  name: 'Nearby breed',
  longitude: 110.05,
  latitude: 35.05,
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

/** 找「产区标记」：省级按钮是 path，产区是带 aria-label 的 g。 */
const clusterButtons = () =>
  screen.getAllByRole('button').filter((node) => node.tagName.toLowerCase() === 'g');

describe('ChinaMap accessibility', () => {
  it('exposes provinces with data as keyboard-operable buttons', () => {
    render(<ChinaMap {...defaultProps} breeds={[breed]} />);

    const province = document.querySelector('path[role="button"]');
    expect(province).not.toBeNull();
    expect(province).toHaveAttribute('tabindex', '0');
    expect(province).toHaveAttribute('aria-label');

    fireEvent.keyDown(province!, { key: 'Enter' });
    fireEvent.keyDown(province!, { key: ' ' });

    expect(defaultProps.onProvinceClick).toHaveBeenCalledTimes(2);
    expect(defaultProps.onProvinceClick).toHaveBeenNthCalledWith(1, '云南');
  });

  /**
   * 没有落点的省份只是地理轮廓。旧实现给全部 34 个省级单位都挂
   * role="button" + tabIndex，键盘必须 Tab 三十多次才能走到产区点位，
   * 而其中大多数回车只会得到空地图。
   */
  it('keeps provinces without records out of the tab order', () => {
    render(<ChinaMap {...defaultProps} breeds={[breed]} />);

    const buttons = [...document.querySelectorAll('path[role="button"]')];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toHaveAttribute('aria-label', '云南');
    // 其余省份仍是可读的路径元素，但不可聚焦、不可点击
    const 海南 = document.querySelector('[data-province="海南"] path');
    expect(海南).not.toBeNull();
    expect(海南).not.toHaveAttribute('role');
    expect(海南).not.toHaveAttribute('tabindex');
  });

  it('exposes one marker per production site, keyboard-operable', () => {
    const onClusterClick = vi.fn();
    render(<ChinaMap {...defaultProps} breeds={[breed]} onClusterClick={onClusterClick} />);

    const markers = clusterButtons();
    expect(markers).toHaveLength(1);
    const marker = markers[0];
    expect(marker).toHaveAttribute('tabindex', '0');
    expect(marker).toHaveAttribute('aria-pressed', 'false');
    expect(marker.getAttribute('aria-label')).toMatch(/云南产区，1 个品种/);

    fireEvent.keyDown(marker, { key: 'Enter' });
    fireEvent.keyDown(marker, { key: ' ' });

    expect(onClusterClick).toHaveBeenCalledTimes(2);
    expect(onClusterClick.mock.calls[0][0].province).toBe('云南');
  });

  it('merges nearby coordinates into a single marker instead of a ring of dots', () => {
    render(<ChinaMap {...defaultProps} breeds={[breed, nearby]} />);

    // 两个相距 0.05° 的记录属于同一产区 → 一个标记，不是一个环
    const markers = clusterButtons();
    expect(markers).toHaveLength(1);
    expect(markers[0].getAttribute('aria-label')).toMatch(/云南产区，2 个品种/);
  });

  it('never renders unverified (0,0) sentinel records as markers', () => {
    render(<ChinaMap {...defaultProps} breeds={[breed, unverified]} />);

    expect(clusterButtons()).toHaveLength(1);
    expect(screen.queryByRole('button', { name: /Unverified breed/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/待核验产区/)).not.toBeInTheDocument();
  });

  it('falls back to opening the record directly when no cluster handler is given', () => {
    const onBreedClick = vi.fn();
    render(<ChinaMap {...defaultProps} breeds={[breed]} onBreedClick={onBreedClick} />);

    fireEvent.click(clusterButtons()[0]);
    expect(onBreedClick).toHaveBeenCalledWith(breed);
  });
});
