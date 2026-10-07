import type { Breed } from './breeds';
import { NATIONAL_PROTECTED_BREED_NAMES } from './nationalProtectionList';
import { getBreedSource, type BreedSource } from './breedSources';
import { breedImageOverrides } from './breedImageOverrides';
import ml2024Entries from './ml2024Entries.json';

/** 2024 名录增量条目名集合：用于把这些记录挂到官方名录来源。 */
const ml2024Names = new Set<string>(
  (ml2024Entries as string[][]).map((entry) => entry[0]),
);

export type ProtectionStatus = 'national-list' | 'not-on-national-list' | 'unverified';
export type ImageRights = 'verified' | 'unverified' | 'project-svg';

export interface BreedMetadata {
  officialName: string;
  aliases: string[];
  protectionStatus: ProtectionStatus;
  sourceIds: string[];
  verifiedAt: string;
  legacyIds?: string[];
  imageSource?: string;
  imageRights: ImageRights;
  metricBasis: 'editorial-normalized' | 'not-available';
}

type BreedMetadataOverride = Partial<Omit<BreedMetadata, 'metricBasis'>>;

/** Reviewed aliases and identity repairs are added here as records are normalized. */
export const metadataOverrides: Partial<Record<string, BreedMetadataOverride>> = {
  八眉猪: { aliases: ['互助八眉猪'] },
  // 同物异名合并后的别名接续与名录名对齐（详见 breeds.ts mergedVariants 注释）
  南丹瑶鸡: { officialName: '瑶鸡', aliases: ['瑶鸡'] },
  中原斗鸡: { officialName: '河南斗鸡', aliases: ['河南斗鸡'] },
  梅花鹿: { officialName: '吉林梅花鹿', aliases: ['吉林梅花鹿'] },
  藏马: { aliases: ['西藏马'] },
  皖南牛: { aliases: ['安徽皖南牛'] },
  恩施黄牛: { aliases: ['湖北恩施黄牛'] },
  赣中南花猪: { aliases: ['江西赣中南花猪'] },
  山丹马: { aliases: ['甘肃山丹马'] },
  塔里木马鹿: { aliases: ['塔河马鹿'] },
  泰和乌鸡: { aliases: ['泰和乌骨鸡'] },
  济宁青山羊: { aliases: ['山东济宁青山羊'] },
  哈尔滨大白兔: { aliases: ['哈尔滨白兔'] },
  青海高原牦牛: { aliases: ['高原牦牛'] },
  莆田黑猪: { aliases: ['蒲田猪'] },
  云南邓川牛: { aliases: ['邓川牛'] },
  隆林黄牛: { aliases: ['隆林牛'] },
  南丹黄牛: { aliases: ['南丹牛'] },
  凉山黄牛: { aliases: ['凉山牛'] },
  黎平黄牛: { aliases: ['黎平牛'] },
  威宁黄牛: { aliases: ['威宁牛'] },
  青海双峰驼: { aliases: ['青海骆驼'] },
  四川驴: { aliases: ['川驴'] },
  平武牛: { aliases: ['平武黄牛'] },
  徐闻牛: { aliases: ['徐闻黄牛'] },
  雷州牛: { aliases: ['雷州黄牛'] },
  福安牛: { aliases: ['福安黄牛'] },
  赣西牛: { aliases: ['赣西黄牛'] },
  锦江牛: { aliases: ['锦江黄牛'] },
  广丰牛: { aliases: ['广丰黄牛'] },
  新疆准噶尔双峰驼: { aliases: ['准噶尔双峰驼'] },
  龙岩山麻鸭: { aliases: ['山麻鸭'] },
  敖鲁古雅驯鹿: { aliases: ['驯鹿'] },
  青海毛驴: { aliases: ['青海驴'] },
  // 2024 名录口径名与既有记录名的变体接续（逐条有官方资料佐证）
  阿尔泰白头牛: { aliases: ['阿勒泰白头牛'] },
  和田驴: { aliases: ['和田青驴'] },
  迪庆黄牛: { aliases: ['迪庆牛'] },
};

const verifiedAdditionNames = new Set([
  '独龙牛',
  '青海毛驴',
  '河田鸡',
  '金阳丝毛鸡',
  '林甸鸡',
  '怀乡鸡',
  '闽清毛脚鸡',
  '皖南三黄鸡',
  '金湖乌凤鸡',
  '烟台䅟糠鸡',
  '淅川乌骨鸡',
  '河南斗鸡',
  '景阳鸡',
  '来凤酉水鸡',
  '雪峰乌骨鸡',
  '广西麻鸡',
  '瑶鸡',
  '腾冲雪鸡',
  '太平鸡',
  '海东鸡',
  '麻旺鸭',
  '向海飞鹅',
  '吉林梅花鹿',
]);

const protectedNames = new Set<string>(NATIONAL_PROTECTED_BREED_NAMES);

export function getBreedMetadata(breed: Breed): BreedMetadata {
  const override = metadataOverrides[breed.name];
  const officialName = override?.officialName ?? breed.name;
  const listed = protectedNames.has(officialName);
  const recordSourceIds =
    override?.sourceIds ??
    (ml2024Names.has(breed.name)
      ? ['nahs-catalog-2024']
      : verifiedAdditionNames.has(officialName)
        ? ['moa-notice-940', 'breed-museum-editorial']
        : ['breed-museum-legacy']);
  const sourceIds = listed
    ? Array.from(new Set(['moa-notice-940', ...recordSourceIds]))
    : recordSourceIds;

  const imageCredit = breedImageOverrides[breed.id];

  return {
    officialName,
    aliases: override?.aliases ?? [],
    protectionStatus: listed
      ? 'national-list'
      : (override?.protectionStatus ?? 'unverified'),
    sourceIds,
    verifiedAt: override?.verifiedAt ?? '2026-09-27',
    legacyIds: override?.legacyIds,
    imageSource: imageCredit
      ? `${imageCredit.author} · ${imageCredit.license}`
      : override?.imageSource,
    imageRights: imageCredit
      ? 'verified'
      : (override?.imageRights ?? (breed.image === '/brand/breed-placeholder.svg' ? 'project-svg' : 'unverified')),
    metricBasis:
      breed.image === '/brand/breed-placeholder.svg'
        ? 'not-available'
        : 'editorial-normalized',
  };
}

export { getBreedSource };
export type { BreedSource };
