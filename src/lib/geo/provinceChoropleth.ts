/**
 * Runtime choropleth scale for the 2D province map.
 *
 * The map is intentionally classified from the values that are currently
 * visible (all records, a category, protected records, or editorial risk).
 * This keeps the colour promise honest when a lens changes: the darkest
 * province is always the province with the most records in that view.
 *
 * 2026-10 配色修订：旧色阶最高档是 `#1d3a2d`（近墨黑），深色省份上的
 * 深色类别点几乎完全看不见；浅色档又偏黄，整块版图像一张旧报纸。
 * 现在两套色阶都收在「鼠尾草绿」中段：最高档对纸底约 4.6:1，
 * 足够读出层级，又不会把点位吞掉；深色模式用同一色相反向排列，
 * 最亮档也只到 #6B956E，亮度不再反超文字。
 */

export const CHOROPLETH_LIGHT_COLORS = [
  '#e7e9da',
  '#cfd8bf',
  '#aabf9c',
  '#7e9e7c',
  '#4c735c',
] as const;

/** Dark mode reverses the ramp so a high value remains visually prominent. */
export const CHOROPLETH_DARK_COLORS = [
  '#22322a',
  '#2c4434',
  '#3a5a43',
  '#4e7455',
  '#6b956e',
] as const;

export type ProvinceValues =
  | ReadonlyMap<string, number>
  | Readonly<Record<string, number>>
  | Iterable<readonly [string, number]>;

export interface ChoroplethLegendItem {
  bin: number;
  color: string;
  /** Inclusive lower bound represented by this swatch. */
  from: number;
  /** Inclusive upper bound. `null` means the highest open-ended bucket. */
  to: number | null;
}

export interface ProvinceChoroplethScale {
  /** Four quantile cut points, ascending. */
  readonly thresholds: readonly number[];
  /** Highest input value, or zero for an empty input. */
  readonly max: number;
  /** The five swatch colours for the selected theme. */
  readonly colors: readonly string[];
  /** Classify a count into the deterministic range 0…4. */
  readonly binFor: (count: number) => number;
  /** Pick the swatch for a count. Zero values use the lightest swatch. */
  readonly colorFor: (count: number) => string;
  /** Ready-to-render legend rows, including their numeric ranges. */
  readonly legend: readonly ChoroplethLegendItem[];
  /** Values copied into a plain map for consumers that need province lookup. */
  readonly values: Readonly<Record<string, number>>;
}

const finiteCount = (value: number): number => (Number.isFinite(value) && value > 0 ? value : 0);

const entriesOf = (input: ProvinceValues): Array<[string, number]> => {
  if (input instanceof Map) return [...input.entries()].map(([key, value]) => [key, finiteCount(value)]);
  if (typeof input === 'object' && input !== null && Symbol.iterator in input) {
    return [...(input as Iterable<readonly [string, number]>)]
      .map(([key, value]) => [key, finiteCount(value)] as [string, number]);
  }
  return Object.entries(input).map(([key, value]) => [key, finiteCount(value)]);
};

/** Linear interpolation quantile (R-7 / d3 default), deterministic for ties. */
const quantile = (sorted: readonly number[], percentile: number): number => {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0];
  const index = (sorted.length - 1) * percentile;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
};

/**
 * Build a five-bin runtime province scale.
 *
 * Only positive values participate in quantile computation. Empty provinces
 * still receive bin 0, while a single non-empty province is promoted to the
 * darkest bin so a one-province fixture remains visible in tests and on the
 * map. The output does not mutate the input.
 */
export function buildProvinceChoropleth(input: ProvinceValues = {}): ProvinceChoroplethScale {
  const entries = entriesOf(input);
  const values = Object.fromEntries(entries);
  const positive = entries
    .map(([, value]) => value)
    .filter((value) => value > 0)
    .sort((a, b) => a - b);
  const max = positive.length > 0 ? positive[positive.length - 1] : 0;
  const thresholds = [0.2, 0.4, 0.6, 0.8].map((percentile) => quantile(positive, percentile));
  const colors = [...CHOROPLETH_LIGHT_COLORS];

  const binFor = (count: number): number => {
    const normalized = finiteCount(count);
    if (normalized === 0 || positive.length === 0) return 0;
    if (positive.length === 1) return 4;
    // Strict comparison keeps exact quantile boundaries deterministic and
    // means every bucket's lower edge belongs to that bucket.
    let bin = 0;
    for (const threshold of thresholds) {
      if (normalized > threshold) bin += 1;
    }
    return Math.min(4, bin);
  };

  const colorFor = (count: number): string => colors[binFor(count)];
  const legend = colors.map((color, bin) => ({
    bin,
    color,
    from: bin === 0 ? 0 : thresholds[bin - 1],
    to: bin === 4 ? null : thresholds[bin],
  }));

  return {
    thresholds,
    max,
    colors,
    binFor,
    colorFor,
    legend,
    values,
  };
}

/** Alias kept terse for chart and map call sites. */
export const createProvinceChoropleth = buildProvinceChoropleth;

/** Classify a count against an existing scale without exposing implementation details. */
export const getChoroplethBin = (scale: ProvinceChoroplethScale, count: number): number =>
  scale.binFor(count);

/** Return one theme-independent colour directly from an ad-hoc values input. */
export function colorForProvinceCount(
  input: ProvinceValues,
  count: number,
  darkMode = false,
): string {
  const scale = buildProvinceChoropleth(input);
  if (!darkMode) return scale.colorFor(count);
  const darkColors = CHOROPLETH_DARK_COLORS;
  return darkColors[scale.binFor(count)];
}
