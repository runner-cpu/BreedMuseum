import { describe, expect, it } from 'vitest';
import { serializeCsv } from '../export';
describe('CSV export', () => {
  it('escapes quotes and line breaks without losing Chinese text', () => {
    expect(serializeCsv([['名称', '说明'], ['河田鸡', '有"羽毛"\n第二行']])).toBe('名称,说明\r\n河田鸡,"有""羽毛""\n第二行"');
  });
  it('neutralizes formula-like text but preserves numeric values', () => {
    expect(serializeCsv([['=SUM(A1:A2)', '+cmd', '@x', -2]])).toBe("'=SUM(A1:A2),'+cmd,'@x,-2");
  });
});
