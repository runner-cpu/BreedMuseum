import { categories, endangeredLevels, type Breed } from './breeds';

export type AuditCode =
  | 'duplicate-id'
  | 'duplicate-name'
  | 'missing-field'
  | 'invalid-coordinate'
  | 'invalid-category'
  | 'invalid-endangered-level'
  | 'invalid-radar'
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

    if (
      radarDimensions.some(
        (key) =>
          !Number.isFinite(breed.radar[key]) ||
          breed.radar[key] < 0 ||
          breed.radar[key] > 100,
      )
    ) {
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
