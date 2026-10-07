export interface BreedSource {
  id: string;
  title: string;
  publisher: string;
  url?: string;
  publishedAt?: string;
  verifiedAt: string;
  scope: string;
}

export const breedSources = {
  'moa-notice-940': {
    id: 'moa-notice-940',
    title: '中华人民共和国农业农村部公告第940号',
    publisher: '中华人民共和国农业农村部',
    url: 'https://www.moa.gov.cn/govpublic/nybzzj1/202510/t20251029_6478525.htm',
    publishedAt: '2025-10-27',
    verifiedAt: '2026-09-27',
    scope: '国家级畜禽遗传资源保护品种名录名称与分类',
  },
  'nahs-catalog-2024': {
    id: 'nahs-catalog-2024',
    title: '《国家畜禽遗传资源品种名录（2024年版）》及蜂、蚕名录（畜资委办〔2025〕18号）',
    publisher: '国家畜禽遗传资源委员会办公室',
    url: 'https://www.nahs.org.cn/gk/tz/202502/t20250210_452797.htm',
    publishedAt: '2025-02-06',
    verifiedAt: '2026-10-07',
    scope: '2024 年版国家畜禽（1090）与蜂（39）名录在册名称、物种与名录子类；官方 PDF 逐页核对，全量 manifest 见 src/data/ml2024Catalog.json',
  },
  'breed-museum-legacy': {
    id: 'breed-museum-legacy',
    title: '项目既有整理数据集',
    publisher: '中国地方畜禽品种数字博物馆',
    verifiedAt: '2026-09-27',
    scope: '本轮升级前已存在的展示记录；具体来源与图片权利仍需逐条复核',
  },
  'breed-museum-editorial': {
    id: 'breed-museum-editorial',
    title: '项目编辑规范与归一化指标说明',
    publisher: '中国地方畜禽品种数字博物馆',
    verifiedAt: '2026-09-27',
    scope: '展示文案、别名、编辑归一化五维指标与无图占位策略',
  },
} as const satisfies Record<string, BreedSource>;

export function getBreedSource(sourceId: string): BreedSource | undefined {
  return breedSources[sourceId as keyof typeof breedSources];
}
