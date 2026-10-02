import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readStoredEnum, writeStoredValue } from '../safeStorage';

describe('safe storage helpers', () => {
  beforeEach(() => localStorage.clear());

  it('rejects invalid values and falls back when storage is unavailable', () => {
    localStorage.setItem('museum_lang', 'fr');
    expect(readStoredEnum('museum_lang', ['zh', 'en'] as const, 'zh')).toBe('zh');
    const getItem = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(readStoredEnum('museum_theme', ['light', 'dark', 'system'] as const, 'system')).toBe('system');
    getItem.mockRestore();
  });

  it('swallows write failures instead of breaking settings changes', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => writeStoredValue('museum_lang', 'en')).not.toThrow();
    setItem.mockRestore();
  });
});
