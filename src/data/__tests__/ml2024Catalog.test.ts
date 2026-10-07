import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { breedSources } from '@/data/breedSources';
import ml2024Entries from '@/data/ml2024Entries.json';
import rawCatalog from '@/data/ml2024Catalog.json';

/**
 * 2024 名录 manifest 与馆藏增量的契约测试。
 *
 * manifest（src/data/ml2024Catalog.json）是官方 PDF 逐页人工核对的全量台账：
 * 每节的条目数与官方原件一致，官方总数 1090 畜禽 + 39 蜂闭合。
 */
type CatalogSection = { species: string; subtype: string; subSpecies?: string; names: string[] };
type Catalog = {
  meta: { officialTotals: { livestock: number; bee: number; silkworm: number } };
  sections: CatalogSection[];
};
const catalog = rawCatalog as unknown as Catalog;

const SUBTYPE_CODE: Record<string, number> = {
  地方品种: 0,
  培育品种: 1,
  培育配套系: 2,
  其他蜂遗传资源: 3,
};

/** 官方 PDF 逐页核对得到的各节条目数（2026-10 复核）。 */
const OFFICIAL_SECTION_COUNTS: Record<string, number> = {
  '猪|地方品种': 89, '猪|培育品种': 32, '猪|培育配套系': 18, '猪|引入品种': 6, '猪|引入配套系': 2,
  '牛|地方品种': 110, '牛|培育品种': 13, '牛|引入品种': 19,
  '羊|地方品种': 127, '羊|培育品种': 53, '羊|引入品种': 20,
  '马|地方品种': 29, '马|培育品种': 14, '马|引入品种': 17,
  '驴|地方品种': 24, '骆驼|地方品种': 5,
  '兔|地方品种': 8, '兔|培育品种': 13, '兔|培育配套系': 5, '兔|引入品种': 10, '兔|引入配套系': 4,
  '鸡|地方品种': 140, '鸡|培育品种': 5, '鸡|培育配套系': 104, '鸡|引入品种': 8, '鸡|引入配套系': 32,
  '鸭|地方品种': 42, '鸭|培育配套系': 16, '鸭|引入品种': 1, '鸭|引入配套系': 7,
  '鹅|地方品种': 32, '鹅|培育品种': 1, '鹅|培育配套系': 4, '鹅|引入配套系': 6,
  '鸽|地方品种': 6, '鸽|培育配套系': 3, '鸽|引入品种': 3, '鸽|引入配套系': 1,
  '鹌鹑|培育配套系': 1, '鹌鹑|引入品种': 2,
  '梅花鹿|地方品种': 1, '梅花鹿|培育品种': 7,
  '马鹿|地方品种': 3, '马鹿|培育品种': 3, '马鹿|引入品种': 1,
  '驯鹿|地方品种': 1, '羊驼|引入品种': 1,
  '火鸡|地方品种': 1, '火鸡|引入品种': 2, '火鸡|引入配套系': 2,
  '珍珠鸡|引入品种': 1, '雉鸡|地方品种': 2, '雉鸡|培育品种': 2, '雉鸡|引入品种': 1,
  '鹧鸪|引入品种': 1, '番鸭|地方品种': 1, '番鸭|培育配套系': 2, '番鸭|引入品种': 1, '番鸭|引入配套系': 1,
  '绿头鸭|引入品种': 1, '鸵鸟|引入品种': 3, '鸸鹋|引入品种': 1,
  '水貂|培育品种': 8, '水貂|引入品种': 5, '银狐|引入品种': 2, '北极狐|引入品种': 1,
  '貉|地方品种': 1, '貉|培育品种': 2,
  '蜂|地方品种': 15, '蜂|培育品种': 7, '蜂|引入品种': 9, '蜂|其他蜂遗传资源': 8,
};

const sectionKey = (section: CatalogSection) => `${section.species}|${section.subtype}`;

test('manifest sections match the official PDF section counts and totals', () => {
  const counts = new Map<string, number>();
  const allNames = new Map<string, string>();
  for (const section of catalog.sections) {
    const key = sectionKey(section);
    counts.set(key, (counts.get(key) ?? 0) + section.names.length);
    for (const name of section.names) {
      expect(allNames.has(name), `manifest 重复名称: ${name}`).toBe(false);
      allNames.set(name, key);
    }
  }
  for (const [key, expected] of Object.entries(OFFICIAL_SECTION_COUNTS)) {
    expect(counts.get(key), `manifest ${key} 条目数`).toBe(expected);
  }
  expect(counts.get('蜂|地方品种')! + counts.get('蜂|培育品种')! + counts.get('蜂|引入品种')! + counts.get('蜂|其他蜂遗传资源')!)
    .toBe(catalog.meta.officialTotals.bee);
  const livestockTotal = [...counts.entries()]
    .filter(([key]) => !key.startsWith('蜂|'))
    .reduce((sum, [, n]) => sum + n, 0);
  expect(livestockTotal).toBe(catalog.meta.officialTotals.livestock);
  expect(catalog.meta.officialTotals.silkworm).toBe(307);
});

test('official PDF checksum matches the transcribed source', () => {
  const manifestOnDisk = JSON.parse(
    readFileSync(resolve('src/data/ml2024Catalog.json'), 'utf8'),
  ) as Catalog;
  expect(manifestOnDisk.meta.pdfSha256).toBe(
    '432f44c5bafd921be22aad3533501899bf674d97d472a74b2f00c1f8bdab6166',
  );
  expect(manifestOnDisk.meta.notice).toBe('畜资委办〔2025〕18号');
});

test('every increment entry traces back to the manifest with matching species and subtype', () => {
  const manifestByName = new Map<string, { species: string; subtype: string }>();
  for (const section of catalog.sections) {
    for (const name of section.names) {
      manifestByName.set(name, { species: section.subSpecies ?? section.species, subtype: section.subtype });
    }
  }
  for (const entry of ml2024Entries as string[][]) {
    const [name, , subtypeCode, , species] = entry;
    const meta = manifestByName.get(name);
    expect(meta, `增量条目不在 manifest: ${name}`).toBeDefined();
    expect(SUBTYPE_CODE[meta!.subtype]).toBe(subtypeCode);
    expect(species).toBe(meta!.species);
  }
});

test('increment contains no introduced breeds and covers every in-scope domestic name', () => {
  const incrementNames = new Set((ml2024Entries as string[][]).map((entry) => entry[0]));
  const identity = new Set<string>();
  for (const breed of breeds) {
    const metadata = getBreedMetadata(breed);
    identity.add(breed.name);
    identity.add(metadata.officialName);
    for (const alias of metadata.aliases) identity.add(alias);
  }
  const introduced: string[] = [];
  const uncovered: string[] = [];
  for (const section of catalog.sections) {
    const isIntroduced = section.subtype === '引入品种' || section.subtype === '引入配套系';
    for (const name of section.names) {
      if (isIntroduced) {
        if (incrementNames.has(name)) introduced.push(name);
      } else if (!identity.has(name)) {
        uncovered.push(name);
      }
    }
  }
  expect(introduced, '引入品种混入增量').toEqual([]);
  expect(uncovered, '范围内条目未被馆藏覆盖').toEqual([]);
});

test('2024 increment records carry the official catalog source', () => {
  expect(breedSources['nahs-catalog-2024']).toBeDefined();
  for (const entry of ml2024Entries as string[][]) {
    const breed = breeds.find((item) => item.name === entry[0]);
    expect(breed, `增量条目未进入运行时: ${entry[0]}`).toBeDefined();
    const metadata = getBreedMetadata(breed!);
    expect(metadata.sourceIds).toContain('nahs-catalog-2024');
  }
});

test('species-driven categories replace name-suffix inference', () => {
  const DIRECT: Record<string, string> = {
    猪: '猪', 牛: '牛', 羊: '羊', 马: '马', 鸡: '鸡', 鸭: '鸭', 鹅: '鹅',
    兔: '兔', 鸽: '鸽', 骆驼: '骆驼',
  };
  for (const entry of ml2024Entries as string[][]) {
    const [, , , , species] = entry;
    const breed = breeds.find((item) => item.name === entry[0]);
    if (!breed) continue;
    const expected = DIRECT[species] ?? '其他';
    expect(breed.category, `${breed.name} (${species})`).toBe(expected);
  }
  // 名录增量的配套系条目不得再因名称后缀落进“其他”
  const misclassified = (breeds ?? []).filter(
    (breed) => breed.name.endsWith('配套系') && breed.category === '其他'
      && (ml2024Entries as string[][]).some((entry) => entry[0] === breed.name && !['驴', '蜂'].includes(entry[4])),
  );
  expect(misclassified.map((breed) => breed.name)).toEqual([]);
});

test('Inner Mongolia catalog breeds restored with verified provinces', () => {
  const expected: Array<[string, number, string]> = [
    ['札萨克图羊', 0, '内蒙古'],
    ['华西牛', 1, '内蒙古'],
    ['杜蒙羊', 1, '内蒙古'],
    ['华蒙肉羊', 1, '内蒙古'],
  ];
  for (const [name, subtypeCode, province] of expected) {
    const breed = breeds.find((item) => item.name === name);
    expect(breed, `${name} 缺失`).toBeDefined();
    expect(breed!.province).toBe(province);
    const entry = (ml2024Entries as string[][]).find((item) => item[0] === name);
    expect(entry?.[2]).toBe(subtypeCode);
  }
});

test('OCR phantom duplicates stay removed from the increment', () => {
  const incrementNames = new Set((ml2024Entries as string[][]).map((entry) => entry[0]));
  for (const phantom of ['宁黑绵羊', '浙川乌骨鸡', '烟台穆糠鸡', '山下长黑', '山鸡', '宁高原鸡', '维西家乌鸡']) {
    expect(incrementNames.has(phantom), `幻影/讹变名仍在增量: ${phantom}`).toBe(false);
  }
});
