import { expect, test } from 'vitest';
import { buildImageIndexRows, summarizeBreeds, replaceGeneratedSection } from '../sync-data-docs.mjs';
test('summary uses only supplied records', () => {
  expect(summarizeBreeds([{id:'a', name:'A', category:'牛', province:'云南', endangered:'普通', image:'x'}, {id:'b', name:'B', category:'牛', province:'四川', endangered:'易危', image:'x'}])).toMatchObject({total:2, uniqueIds:2, categoryCounts:{牛:2}, provinceCount:2, nationalProtectionCount:0});
});
test('replaces only one named generated block and rejects ambiguity', () => {
  expect(replaceGeneratedSection('before\n<!-- data-summary:start -->\nold\n<!-- data-summary:end -->\nafter', 'data-summary', 'new')).toBe('before\n<!-- data-summary:start -->\nnew\n<!-- data-summary:end -->\nafter');
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
