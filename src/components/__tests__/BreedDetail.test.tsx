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

test('2024 catalog records link the official catalog and mark descriptive fields pending', () => {
  const breed = breeds.find((item) => item.name === '札萨克图羊');
  expect(breed).toBeDefined();

  render(
    <SettingsProvider>
      <BreedDetail breed={breed!} />
    </SettingsProvider>,
  );

  const catalogLink = screen.getByRole('link', { name: /国家畜禽遗传资源品种名录（2024年版）/ });
  expect(catalogLink).toHaveAttribute('href', 'https://www.nahs.org.cn/gk/tz/202502/t20250210_452797.htm');
  expect(screen.getByText(/2026-10-07/)).toBeInTheDocument();
  expect(screen.getByText('保护状态待进一步核验')).toBeInTheDocument();
  expect(screen.getByText('项目 SVG 占位图')).toBeInTheDocument();
  expect(screen.getByText(/品种身份与名录分类已对照国家畜禽遗传资源委员会官方名录资料核验/)).toBeInTheDocument();
});
