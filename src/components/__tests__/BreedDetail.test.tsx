import { fireEvent, render, screen } from '@testing-library/react';
import { test, expect } from 'vitest';
import { breeds } from '@/data/breeds';
import BreedDetail from '@/components/BreedDetail';
import { SettingsProvider } from '@/contexts/AppSettings';
import type { Breed } from '@/data/breeds';

test('detail shows source and verification status', () => {
  const breed = breeds.find((item) => item.name === '独龙牛');
  expect(breed).toBeDefined();

  render(
    <SettingsProvider>
      <BreedDetail breed={breed!} />
    </SettingsProvider>,
  );

  expect(screen.getByRole('heading', { name: '数据来源与核验' })).toBeInTheDocument();
  expect(screen.getByText('中华人民共和国农业农村部公告第940号')).toBeInTheDocument();
  expect(screen.getByText(/2026-09-27/)).toBeInTheDocument();
});

test('detail replaces a failed image with the branded placeholder', () => {
  const breed = breeds.find((item) => item.name === '东北民猪');
  expect(breed).toBeDefined();

  render(
    <SettingsProvider>
      <BreedDetail breed={breed!} />
    </SettingsProvider>,
  );

  const image = screen.getByRole('img', { name: breed!.name });
  fireEvent.error(image);

  expect(image).toHaveAttribute('src', '/brand/breed-placeholder.svg');
  expect(image).toHaveAttribute('data-fallback', 'true');
});

test('detail explains unavailable metrics instead of drawing a radar chart', () => {
  const source = breeds.find((item) => item.name === '独龙牛');
  expect(source).toBeDefined();
  const breed = {
    ...source!,
    endangered: '待核验',
    radar: { meat: null, milk: null, reproduction: null, labor: null, adaptability: null },
  } as Breed;

  render(
    <SettingsProvider>
      <BreedDetail breed={breed} />
    </SettingsProvider>,
  );

  expect(screen.getByText('性能指标待补充')).toBeInTheDocument();
  expect(screen.getByText('指标尚无可核验数据')).toBeInTheDocument();
  expect(screen.queryByText('编辑归一化指标（0–100）')).not.toBeInTheDocument();
});
