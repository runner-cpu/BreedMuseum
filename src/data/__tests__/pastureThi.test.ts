import { describe, expect, it } from 'vitest';
import {
  AGE_LABELS,
  LEVEL_ADVICE,
  SPECIES_CONFIG,
  altitudeAdjustment,
  classifyLevel,
  computeThi,
  evaluateThi,
} from '@/data/pastureThi';

/**
 * THI 口径固定：公式、修正与分级一旦调整，这些断言必须先更新，
 * 防止展示端与管理建议随实现漂移。
 */
describe('pastureThi', () => {
  it('computes the standard THI from temperature and humidity', () => {
    // T=30, RH=0.7 → 30 − (0.55 − 0.385) × 15.5 = 27.44
    expect(computeThi(30, 70)).toBeCloseTo(27.4, 1);
    // 干燥高温：RH=0 → 30 − 0.55 × 15.5 = 21.48
    expect(computeThi(30, 0)).toBeCloseTo(21.5, 1);
    // 低于 14.5℃ 时第二项变负，THI 高于气温（无散热加成）
    expect(computeThi(10, 50)).toBeGreaterThan(10);
  });

  it('clamps humidity input to 0–100 percent', () => {
    expect(computeThi(25, -20)).toBe(computeThi(25, 0));
    expect(computeThi(25, 180)).toBe(computeThi(25, 100));
  });

  it('applies altitude adjustment only above 2000 m with a 3.6 cap', () => {
    expect(altitudeAdjustment(1800)).toBe(0);
    expect(altitudeAdjustment(2000)).toBe(0);
    expect(altitudeAdjustment(3000)).toBeCloseTo(1.2, 1);
    expect(altitudeAdjustment(5000)).toBeCloseTo(3.6, 1);
    expect(altitudeAdjustment(8000)).toBe(3.6);
  });

  it('classifies levels per species thresholds', () => {
    const yak = SPECIES_CONFIG.yak;
    expect(classifyLevel(yak.comfortMax - 1, yak)).toBe('comfort');
    expect(classifyLevel(yak.comfortMax + 1, yak)).toBe('alert');
    expect(classifyLevel(yak.alertMax + 1, yak)).toBe('danger');
    expect(classifyLevel(yak.extremeFrom + 1, yak)).toBe('extreme');
  });

  it('evaluates a plateau hot-day scenario as higher stress than a cool one', () => {
    const cool = evaluateThi({ species: 'yak', temperature: 8, humidity: 40, altitude: 3200, age: 'adult' });
    const hot = evaluateThi({ species: 'yak', temperature: 26, humidity: 55, altitude: 3200, age: 'adult' });
    expect(hot.effective).toBeGreaterThan(cool.effective);
    expect(cool.level).toBe('comfort');
    expect(['alert', 'danger', 'extreme']).toContain(hot.level);
  });

  it('raises effective stress for young animals and lowers it with altitude', () => {
    const base = evaluateThi({ species: 'sheep', temperature: 30, humidity: 60, altitude: 1000, age: 'adult' });
    const young = evaluateThi({ species: 'sheep', temperature: 30, humidity: 60, altitude: 1000, age: 'young' });
    const highland = evaluateThi({ species: 'sheep', temperature: 30, humidity: 60, altitude: 4500, age: 'adult' });
    expect(young.effective).toBeGreaterThan(base.effective);
    expect(highland.effective).toBeLessThan(base.effective);
    expect(base.ageAdjustment).toBe(0);
    expect(young.ageAdjustment).toBe(1.5);
  });

  it('emits cold, hypoxia and humidity notes at the documented thresholds', () => {
    const result = evaluateThi({ species: 'yak', temperature: -12, humidity: 90, altitude: 4200, age: 'adult' });
    expect(result.notes.some((n) => n.includes('冷应激'))).toBe(true);
    expect(result.notes.some((n) => n.includes('低氧'))).toBe(true);
    expect(result.notes.some((n) => n.includes('蒸发散热'))).toBe(true);
  });

  it('provides advice for every level and labels for every age class', () => {
    for (const level of ['comfort', 'alert', 'danger', 'extreme'] as const) {
      expect(LEVEL_ADVICE[level].length).toBeGreaterThanOrEqual(3);
    }
    expect(Object.keys(AGE_LABELS)).toEqual(['adult', 'young', 'old']);
  });
});
