import { expect, test } from 'vitest';
import { evaluateAggregate, evaluateEntry, collectStaticChunks } from '../check-bundle-size.mjs';
test('entry must meet both raw and compressed budgets', () => {
  expect(evaluateEntry({rawBytes:700*1024,gzipBytes:200*1024}).ok).toBe(false);
  expect(evaluateEntry({rawBytes:500*1024,gzipBytes:230*1024}).ok).toBe(false);
  expect(evaluateEntry({rawBytes:500*1024,gzipBytes:180*1024})).toEqual({ok:true,reasons:[]});
});
test('static dependency totals deduplicate chunks and exclude lazy imports', () => {
  const manifest = {main:{file:'main.js',imports:['a','b'],dynamicImports:['lazy']},a:{file:'a.js',imports:['b']},b:{file:'b.js'},lazy:{file:'lazy.js'}};
  expect(collectStaticChunks(manifest,'main').sort()).toEqual(['a.js','b.js','main.js']);
});
test('static dependency aggregate must stay within first-load budgets', () => {
  expect(evaluateAggregate({ rawBytes: 1024 * 1024, gzipBytes: 300 * 1024 }).ok).toBe(true);
  expect(evaluateAggregate({ rawBytes: 1200 * 1024, gzipBytes: 300 * 1024 }).ok).toBe(false);
  expect(evaluateAggregate({ rawBytes: 1024 * 1024, gzipBytes: 340 * 1024 }).ok).toBe(false);
});
