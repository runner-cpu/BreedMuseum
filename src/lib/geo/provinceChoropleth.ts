/**
 * Runtime choropleth scale for the 2D province map.
 *
 * The map is intentionally classified from the values that are currently
 * visible (all records, a category, protected records, or editorial risk).
 * This keeps the colour promise honest when a lens changes: the darkest
 * province is always the province with the most records in that view.
 *
 * 2026-10 配色二次修订：原先的两套色阶都是「鼠尾草绿」，与参考站的金色版图
 * 完全不在一个色温里。现在浅色走「宣纸 → 黄铜」沙金阶，深色走「午夜藏蓝」
 * 蓝阶，正好对上原站的 `#f5f0e8 / #d4a853` 与 `#0a0a1a / #15203c`；
 * 最高档仍与纸底/夜色保持可读层级，同时不和类别点位的暖色抢眼。
 */

export const CHOROPLETH_LIGHT_COLORS = [
  '#ece3d1',
  '#ddcba8',
  '#cbb383',
  '#b6975f',
  '#8f6d34',
] as const;

/** Dark mode reverses the ramp so a high value remains visually prominent. */
export const CHOROPLETH_DARK_COLORS = [
  '#1a2a45',
  '#22375c',
  '#2c4874',
  '#3a5f92',
  '#4d7cb5',
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
