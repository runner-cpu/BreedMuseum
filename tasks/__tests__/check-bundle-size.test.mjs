import { expect, test } from 'vitest';
import { evaluateAggregate, evaluateEntry, evaluateCss, evaluateLazyChunk, collectStaticChunks } from '../check-bundle-size.mjs';
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
test('first-load css must stay within the css budget', () => {
  expect(evaluateCss({ rawBytes: 80 * 1024, gzipBytes: 15 * 1024 })).toEqual({ ok: true, reasons: [] });
  expect(evaluateCss({ rawBytes: 120 * 1024, gzipBytes: 10 * 1024 }).ok).toBe(false);
  expect(evaluateCss({ rawBytes: 10 * 1024, gzipBytes: 20 * 1024 }).ok).toBe(false);
});
test('lazy route chunks must stay within the lazy chunk budget', () => {
  expect(evaluateLazyChunk('breeds.js', { rawBytes: 700 * 1024, gzipBytes: 170 * 1024 })).toEqual({ ok: true, reasons: [] });
  expect(evaluateLazyChunk('breeds.js', { rawBytes: 800 * 1024, gzipBytes: 170 * 1024 }).ok).toBe(false);
  expect(evaluateLazyChunk('breeds.js', { rawBytes: 700 * 1024, gzipBytes: 200 * 1024 }).ok).toBe(false);
});
