import type { Breed } from './breeds';
import { NATIONAL_PROTECTED_BREED_NAMES } from './nationalProtectionList';
import { getBreedSource, type BreedSource } from './breedSources';

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
    (verifiedAdditionNames.has(officialName)
      ? ['moa-notice-940', 'breed-museum-editorial']
      : ['breed-museum-legacy']);
  const sourceIds = listed
    ? Array.from(new Set(['moa-notice-940', ...recordSourceIds]))
    : recordSourceIds;

  return {
    officialName,
    aliases: override?.aliases ?? [],
    protectionStatus: listed
      ? 'national-list'
      : (override?.protectionStatus ?? 'unverified'),
    sourceIds,
    verifiedAt: override?.verifiedAt ?? '2026-09-27',
    legacyIds: override?.legacyIds,
    imageSource: override?.imageSource,
    imageRights:
      override?.imageRights ?? (breed.image === '/brand/breed-placeholder.svg' ? 'project-svg' : 'unverified'),
    metricBasis:
      breed.image === '/brand/breed-placeholder.svg'
        ? 'not-available'
        : 'editorial-normalized',
  };
}

export { getBreedSource };
export type { BreedSource };
