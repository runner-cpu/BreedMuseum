import { expect, test } from 'vitest';
import { buildImageIndexRows, formatImageIndexCsv, summarizeBreeds, replaceGeneratedSection } from '../sync-data-docs.mjs';
test('summary uses only supplied records', () => {
  expect(summarizeBreeds([{id:'a', name:'A', category:'牛', province:'云南', endangered:'普通', image:'x'}, {id:'b', name:'B', category:'牛', province:'四川', endangered:'易危', image:'x'}])).toMatchObject({total:2, uniqueIds:2, categoryCounts:{牛:2}, provinceCount:2, nationalProtectionCount:0});
});
test('replaces only one named generated block and rejects ambiguity', () => {
  expect(replaceGeneratedSection('before\n<!-- data-summary:start -->\nold\n<!-- data-summary:end -->\nafter', 'data-summary', 'new')).toBe('before\n<!-- data-summary:start -->\nnew\n<!-- data-summary:end -->\nafter');
  expect(replaceGeneratedSection('before\r\n<!-- data-summary:start -->\r\nold\r\n<!-- data-summary:end -->\r\nafter', 'data-summary', 'line 1\nline 2')).toBe('before\r\n<!-- data-summary:start -->\r\nline 1\r\nline 2\r\n<!-- data-summary:end -->\r\nafter');
  expect(replaceGeneratedSection('before\r\n<!-- data-summary:start -->\nold\n<!-- data-summary:end -->\r\nafter', 'data-summary', 'line 1\nline 2')).toBe('before\r\n<!-- data-summary:start -->\nline 1\nline 2\n<!-- data-summary:end -->\r\nafter');
  expect(() => replaceGeneratedSection('no markers', 'data-summary', 'new')).toThrow();
  expect(() => replaceGeneratedSection('<!-- data-summary:start --><!-- data-summary:start --><!-- data-summary:end -->','data-summary','new')).toThrow();
});
test('image index uses explicit placeholder and unverified-rights statuses', () => {
  const rows = buildImageIndexRows(
    [
      { id: 'a', name: 'A', category: '牛', image: '/brand/breed-placeholder.svg' },
      { id: 'b', name: 'B', category: '羊', image: 'https://example.test/b.jpg' },
    ],
    (breed) => ({ imageRights: breed.id === 'a' ? 'project-svg' : 'unverified' }),
  );

  expect(rows[1][4]).toBe('项目 SVG 占位');
  expect(rows[2][4]).toBe('历史外链；来源权利待核验');
});
test('image index CSV preserves the requested newline and BOM convention', () => {
  const rows = [['列1', '列2'], ['a', 'b']];
  expect(formatImageIndexCsv(rows, '\n', true)).toBe('\uFEFF"列1","列2"\n"a","b"\n');
  expect(formatImageIndexCsv(rows, '\r\n', false)).toBe('"列1","列2"\r\n"a","b"\r\n');
});
