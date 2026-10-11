import { describe, expect, it } from 'vitest';
import {
  CHOROPLETH_DARK_COLORS,
  CHOROPLETH_LIGHT_COLORS,
  buildProvinceChoropleth,
  colorForProvinceCount,
} from '@/lib/geo/provinceChoropleth';

describe('province choropleth', () => {
  it('builds deterministic five-bin quantiles from a record', () => {
    const scale = buildProvinceChoropleth({
      北京: 1,
      云南: 2,
      四川: 3,
      河南: 4,
      新疆: 5,
    });

    expect(scale.thresholds).toEqual([1.8, 2.6, 3.4, 4.2]);
    expect(scale.binFor(0)).toBe(0);
    expect(scale.binFor(1)).toBe(0);
    expect(scale.binFor(2)).toBe(1);
    expect(scale.binFor(3)).toBe(2);
    expect(scale.binFor(4)).toBe(3);
    expect(scale.binFor(5)).toBe(4);
    expect(scale.colorFor(5)).toBe(CHOROPLETH_LIGHT_COLORS[4]);
  });

  it('accepts maps and keeps empty/sentinel values in the lightest bin', () => {
    const scale = buildProvinceChoropleth(
      new Map([
        ['甲', 0],
        ['乙', -3],
        ['丙', Number.NaN],
        ['丁', 8],
      ]),
    );

    expect(scale.max).toBe(8);
    expect(scale.binFor(0)).toBe(0);
    expect(scale.binFor(-9)).toBe(0);
    expect(scale.binFor(8)).toBe(4);
    expect(scale.values).toEqual({ 甲: 0, 乙: 0, 丙: 0, 丁: 8 });
  });

  it('promotes a single non-empty province and reverses the ramp for dark mode', () => {
    const scale = buildProvinceChoropleth({ 西藏: 12 });
    expect(scale.binFor(12)).toBe(4);
    expect(colorForProvinceCount({ 西藏: 12 }, 12, true)).toBe(CHOROPLETH_DARK_COLORS[4]);
    expect(scale.legend).toHaveLength(5);
    expect(scale.legend[0].from).toBe(0);
    expect(scale.legend[4].to).toBeNull();
  });
});

