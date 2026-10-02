import { describe, expect, it } from 'vitest';
import {
  type EncyclopediaQueryOptions,
  parseCompareQuery,
  parseEncyclopediaQuery,
  serializeCompareQuery,
  serializeEncyclopediaQuery,
} from '../queryState';

const options: EncyclopediaQueryOptions = {
  provinces: ['江苏', '浙江'],
  categories: ['猪', '牛'],
  endangeredLevels: ['普通', '待核验'],
};

describe('encyclopedia query state', () => {
  it('parses and trims supported filters while ignoring unknown values', () => {
    expect(
      parseEncyclopediaQuery(
        '?search=%20%E6%B2%B3%E7%94%B0%E9%B8%A1%20&province=%E6%B1%9F%E8%8B%8F&category=%E7%8C%AA&endangered=%E6%99%AE%E9%80%9A&unknown=x',
        options,
      ),
    ).toEqual({ search: '河田鸡', province: '江苏', category: '猪', endangered: '普通' });

    expect(parseEncyclopediaQuery('?province=不存在&category=all&endangered=', options)).toEqual({
      search: '',
      province: null,
      category: null,
      endangered: null,
    });
  });

  it('serializes a stable, shareable query and omits empty/default filters', () => {
    expect(
      serializeEncyclopediaQuery({ search: ' 河田鸡 ', province: '江苏', category: 'all', endangered: '' }),
    ).toBe('province=%E6%B1%9F%E8%8B%8F&search=%E6%B2%B3%E7%94%B0%E9%B8%A1');
  });

  it('round-trips URL state without changing the canonical values', () => {
    const state = { search: '河田鸡', province: '江苏', category: '猪', endangered: '待核验' };
    expect(parseEncyclopediaQuery(serializeEncyclopediaQuery(state), options)).toEqual(state);
  });
});

describe('compare query state', () => {
  it('deduplicates ids, drops blanks, and caps shared links at four breeds', () => {
    expect(parseCompareQuery('?compare=a,,b,a,c,d,e')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('accepts the legacy breeds alias when reading shared links', () => {
    expect(parseCompareQuery('?breeds=a,b&compare=c')).toEqual(['a', 'b', 'c']);
  });

  it('serializes ids in a deterministic encoded form and omits an empty selection', () => {
    expect(serializeCompareQuery(['a', 'b', 'a'])).toBe('compare=a%2Cb');
    expect(serializeCompareQuery([])).toBe('');
  });
});
