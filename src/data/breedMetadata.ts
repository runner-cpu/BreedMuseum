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
  metricBasis: 'editorial-normalized';
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
};

const protectedNames = new Set<string>(NATIONAL_PROTECTED_BREED_NAMES);

export function getBreedMetadata(breed: Breed): BreedMetadata {
  const override = metadataOverrides[breed.name];
  const officialName = override?.officialName ?? breed.name;
  const listed = protectedNames.has(officialName);
  const sourceIds = override?.sourceIds ?? ['breed-museum-legacy'];

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
    imageRights: override?.imageRights ?? 'unverified',
    metricBasis: 'editorial-normalized',
  };
}

export { getBreedSource };
export type { BreedSource };
