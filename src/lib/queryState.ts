/** Canonical URL state shared by the encyclopedia and comparison views. */

export interface EncyclopediaQueryState {
  search: string;
  province: string | null;
  category: string | null;
  endangered: string | null;
}

export interface EncyclopediaQueryOptions {
  provinces?: readonly string[];
  categories?: readonly string[];
  endangeredLevels?: readonly string[];
}

type QueryInput = URLSearchParams | string | null | undefined;

const normalize = (value: string) => value.normalize('NFKC').trim();

function toSearchParams(input: QueryInput): URLSearchParams {
  if (input instanceof URLSearchParams) return new URLSearchParams(input);
  if (!input) return new URLSearchParams();
  const query = input.includes('?') ? input.slice(input.indexOf('?') + 1) : input;
  return new URLSearchParams(query.replace(/^\?/, ''));
}

function readFilter(
  params: URLSearchParams,
  key: string,
  allowed: readonly string[] | undefined,
): string | null {
  const value = normalize(params.get(key) ?? '');
  if (!value || value.toLocaleLowerCase('en-US') === 'all') return null;
  if (allowed && !allowed.includes(value)) return null;
  return value;
}

export function parseEncyclopediaQuery(
  input: QueryInput,
  options: EncyclopediaQueryOptions = {},
): EncyclopediaQueryState {
  const params = toSearchParams(input);
  return {
    search: normalize(params.get('search') ?? ''),
    province: readFilter(params, 'province', options.provinces),
    category: readFilter(params, 'category', options.categories),
    endangered: readFilter(params, 'endangered', options.endangeredLevels),
  };
}

export function serializeEncyclopediaQuery(state: Partial<EncyclopediaQueryState>): string {
  const params = new URLSearchParams();
  const filters: Array<[string, string | null | undefined]> = [
    ['province', state.province],
    ['category', state.category],
    ['endangered', state.endangered],
  ];
  for (const [key, rawValue] of filters) {
    const value = normalize(String(rawValue ?? ''));
    if (value && value.toLocaleLowerCase('en-US') !== 'all') params.set(key, value);
  }
  const search = normalize(state.search ?? '');
  if (search) params.set('search', search);
  return params.toString();
}

const MAX_COMPARE_IDS = 4;

function normalizeCompareIds(ids: Iterable<string>): string[] {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const rawId of ids) {
    const id = normalize(rawId);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    result.push(id);
    if (result.length === MAX_COMPARE_IDS) break;
  }
  return result;
}

export function parseCompareQuery(input: QueryInput): string[] {
  const params = toSearchParams(input);
  // `compare` is the canonical key. Read the historical `breeds` alias first
  // so links that contain both forms have a stable, backwards-compatible order.
  const values = [
    ...params.getAll('breeds').flatMap((value) => value.split(',')),
    ...params.getAll('compare').flatMap((value) => value.split(',')),
  ];
  return normalizeCompareIds(values);
}

export function serializeCompareQuery(ids: readonly string[]): string {
  const normalized = normalizeCompareIds(ids);
  if (normalized.length === 0) return '';
  const params = new URLSearchParams();
  params.set('compare', normalized.join(','));
  return params.toString();
}
