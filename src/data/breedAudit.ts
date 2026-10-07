import { categories, endangeredLevels, type Breed } from './breeds';
import { isKnownProvince, isSentinelCoordinate, UNVERIFIED_PROVINCE } from './catalog';

export type AuditCode =
  | 'duplicate-id'
  | 'duplicate-name'
  | 'missing-field'
  | 'invalid-coordinate'
  | 'invalid-category'
  | 'invalid-endangered-level'
  | 'invalid-radar'
  | 'invalid-province'
  | 'sentinel-coordinate'
  | 'missing-source'
  | 'ambiguous-alias';

export interface AuditIssue {
  code: AuditCode;
  breedId?: string;
  message: string;
}

export interface AuditableMetadata {
  aliases: readonly string[];
  sourceIds: readonly string[];
}

export interface AuditOptions {
  resolveMetadata?: (breed: Breed) => AuditableMetadata;
}

const radarDimensions = ['meat', 'milk', 'reproduction', 'labor', 'adaptability'] as const;
const requiredTextFields = [
  'id',
  'name',
  'englishName',
  'province',
  'appearance',
  'performance',
  'story',
  'image',
] as const;

export function auditBreedDataset(
  items: readonly Breed[],
  options: AuditOptions = {},
): AuditIssue[] {
  const issues: AuditIssue[] = [];
  const ids = new Map<string, string>();
  const names = new Map<string, string>();
  const aliases = new Map<string, string>();

  for (const breed of items) {
    for (const key of requiredTextFields) {
      if (!String(breed[key] ?? '').trim()) {
        issues.push({
          code: 'missing-field',
          breedId: breed.id,
          message: key + ' is empty',
        });
      }
    }

    if (ids.has(breed.id)) {
      issues.push({
        code: 'duplicate-id',
        breedId: breed.id,
        message: breed.id + ': ' + ids.get(breed.id) + ' / ' + breed.name,
      });
    } else {
      ids.set(breed.id, breed.name);
    }

    if (names.has(breed.name)) {
      issues.push({
        code: 'duplicate-name',
        breedId: breed.id,
        message: breed.name + ': ' + names.get(breed.name) + ' / ' + breed.id,
      });
    } else {
      names.set(breed.name, breed.id);
    }

    if (
      !Number.isFinite(breed.longitude) ||
      breed.longitude < -180 ||
      breed.longitude > 180 ||
      !Number.isFinite(breed.latitude) ||
      breed.latitude < -90 ||
      breed.latitude > 90
    ) {
      issues.push({
        code: 'invalid-coordinate',
        breedId: breed.id,
        message: String(breed.longitude) + ',' + String(breed.latitude),
      });
    }

    // 省份必须是 34 个行政区词汇之一；“待核验”是合法的产区未核验哨兵，不是省份。
    // 空值由 missing-field 负责，不在此重复报告。
    if (breed.province && breed.province !== UNVERIFIED_PROVINCE && !isKnownProvince(breed.province)) {
      issues.push({
        code: 'invalid-province',
        breedId: breed.id,
        message: breed.province,
      });
    }

    // 已核验省份的记录不得停留在 (0,0) 哨兵坐标；
    // 反之“待核验”省份 +(0,0) 是登记的缺省状态，不视为问题。
    if (isSentinelCoordinate(breed.longitude, breed.latitude) && isKnownProvince(breed.province)) {
      issues.push({
        code: 'sentinel-coordinate',
        breedId: breed.id,
        message: breed.province + ' @ 0,0',
      });
    }

    if (!(categories as readonly string[]).includes(breed.category)) {
      issues.push({
        code: 'invalid-category',
        breedId: breed.id,
        message: breed.category,
      });
    }

    if (!(endangeredLevels as readonly string[]).includes(breed.endangered)) {
      issues.push({
        code: 'invalid-endangered-level',
        breedId: breed.id,
        message: breed.endangered,
      });
    }

    const radarValues = radarDimensions.map((key) => breed.radar[key]);
    const allRadarValuesUnavailable = radarValues.every((value) => value === null);
    const allRadarValuesValid = radarValues.every(
      (value) => value !== null && Number.isFinite(value) && value >= 0 && value <= 100,
    );

    if (!allRadarValuesUnavailable && !allRadarValuesValid) {
      issues.push({
        code: 'invalid-radar',
        breedId: breed.id,
        message: JSON.stringify(breed.radar),
      });
    }

    const metadata = options.resolveMetadata?.(breed);
    if (options.resolveMetadata && (!metadata || metadata.sourceIds.length === 0)) {
      issues.push({
        code: 'missing-source',
        breedId: breed.id,
        message: breed.name,
      });
    }

    for (const alias of metadata?.aliases ?? []) {
      const owner = aliases.get(alias) ?? names.get(alias);
      if (owner && owner !== breed.id) {
        issues.push({
          code: 'ambiguous-alias',
          breedId: breed.id,
          message: alias + ': ' + owner,
        });
      } else {
        aliases.set(alias, breed.id);
      }
    }
  }

  return issues;
}
