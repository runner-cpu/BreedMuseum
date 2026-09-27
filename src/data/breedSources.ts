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
