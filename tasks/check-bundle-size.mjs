import { readFile, readdir } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const ENTRY_BUDGET = Object.freeze({ rawBytes: 650 * 1024, gzipBytes: 220 * 1024 });
// The static graph is everything the browser has to fetch for the initial
// route (entry + static imports). It is the more useful guard for regressions
// than an entry-only limit because shared vendor/data chunks are first-load
// costs too.
export const AGGREGATE_BUDGET = Object.freeze({ rawBytes: 1100 * 1024, gzipBytes: 320 * 1024 });
// First-load CSS and the largest lazy chunks are real user-facing costs too:
// CSS blocks first paint, and the breeds data chunk is the shared payload for
// the encyclopedia/map/dashboard routes. Budgets sit above current actuals
// with headroom for normal growth but block step-change regressions.
export const CSS_BUDGET = Object.freeze({ rawBytes: 90 * 1024, gzipBytes: 16 * 1024 });
export const LAZY_CHUNK_BUDGET = Object.freeze({ rawBytes: 750 * 1024, gzipBytes: 180 * 1024 });

export function evaluateCss({ rawBytes, gzipBytes }) {
  const reasons = [];
  if (rawBytes > CSS_BUDGET.rawBytes) reasons.push('css exceeds 90 KiB raw');
  if (gzipBytes > CSS_BUDGET.gzipBytes) reasons.push('gzip css exceeds 16 KiB');
  return { ok: reasons.length === 0, reasons };
}

export function evaluateLazyChunk(file, { rawBytes, gzipBytes }) {
  const reasons = [];
  if (rawBytes > LAZY_CHUNK_BUDGET.rawBytes) reasons.push(file + ' exceeds 750 KiB raw');
  if (gzipBytes > LAZY_CHUNK_BUDGET.gzipBytes) reasons.push('gzip ' + file + ' exceeds 180 KiB');
  return { ok: reasons.length === 0, reasons };
}

export function evaluateEntry({ rawBytes, gzipBytes }) {
  const reasons = [];
  if (rawBytes > ENTRY_BUDGET.rawBytes) reasons.push('raw entry exceeds 650 KiB');
  if (gzipBytes > ENTRY_BUDGET.gzipBytes) reasons.push('gzip entry exceeds 220 KiB');
  return { ok: reasons.length === 0, reasons };
}

export function evaluateAggregate({ rawBytes, gzipBytes }) {
  const reasons = [];
  if (rawBytes > AGGREGATE_BUDGET.rawBytes) reasons.push('static graph exceeds 1100 KiB raw');
  if (gzipBytes > AGGREGATE_BUDGET.gzipBytes) reasons.push('static graph exceeds 320 KiB gzip');
  return { ok: reasons.length === 0, reasons };
}

export function collectStaticChunks(manifest, entry, visited = new Set()) {
  if (visited.has(entry)) return [];
  visited.add(entry);
  const item = manifest[entry];
  if (!item) throw new Error('Unknown manifest key: ' + entry);
  return [item.file, ...(item.imports ?? []).flatMap((key) => collectStaticChunks(manifest, key, visited))];
}

export async function checkBundle(folder = 'dist') {
  const manifest = JSON.parse(await readFile(join(folder, '.vite/manifest.json'), 'utf8'));
  const [key, entry] = Object.entries(manifest).find(([, value]) => value.isEntry) ?? [];
  if (!entry) throw new Error('No entry in Vite manifest');

  const data = await readFile(join(folder, entry.file));
  const sizes = { rawBytes: data.byteLength, gzipBytes: gzipSync(data).byteLength };
  const entryResult = evaluateEntry(sizes);
  const staticFiles = collectStaticChunks(manifest, key);
  const aggregate = { rawBytes: 0, gzipBytes: 0 };
  for (const file of staticFiles) {
    const bytes = await readFile(join(folder, file));
    aggregate.rawBytes += bytes.byteLength;
    aggregate.gzipBytes += gzipSync(bytes).byteLength;
  }
  const aggregateResult = evaluateAggregate(aggregate);
  const entryReasons = [...entryResult.reasons, ...aggregateResult.reasons];

  // CSS 与懒加载 chunk 预算：覆盖首屏样式和最大的路由级数据块
  const cssFiles = await readdir(join(folder, 'assets'));
  const cssReasons = [];
  const cssReport = [];
  for (const file of cssFiles.filter((f) => f.endsWith('.css'))) {
    const bytes = await readFile(join(folder, 'assets', file));
    const sizes = { rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength };
    const result = evaluateCss(sizes);
    cssReport.push({ file, ...sizes, ok: result.ok });
    cssReasons.push(...result.reasons);
  }

  const dynamicKeys = new Set();
  for (const value of Object.values(manifest)) {
    for (const key of value.dynamicImports ?? []) dynamicKeys.add(key);
  }
  const staticFilesSet = new Set(staticFiles);
  const lazyReasons = [];
  const lazyReport = [];
  for (const key of dynamicKeys) {
    const item = manifest[key];
    if (!item || staticFilesSet.has(item.file)) continue;
    const bytes = await readFile(join(folder, item.file));
    const sizes = { rawBytes: bytes.byteLength, gzipBytes: gzipSync(bytes).byteLength };
    const result = evaluateLazyChunk(item.file, sizes);
    lazyReport.push({ file: item.file, ...sizes, ok: result.ok });
    lazyReasons.push(...result.reasons);
  }

  const reasons = [...entryReasons, ...cssReasons, ...lazyReasons];
  console.log(
    JSON.stringify(
      {
        entry: entry.file,
        ...sizes,
        ok: reasons.length === 0,
        reasons,
        entryOk: entryResult.ok,
        entryReasons: entryResult.reasons,
        staticGraph: aggregate,
        staticGraphBudget: AGGREGATE_BUDGET,
        staticGraphOk: aggregateResult.ok,
        staticGraphReasons: aggregateResult.reasons,
        css: { budget: CSS_BUDGET, files: cssReport },
        lazyChunks: { budget: LAZY_CHUNK_BUDGET, files: lazyReport },
        staticFiles,
      },
      null,
      2,
    ),
  );

  if (reasons.length > 0) throw new Error(reasons.join('; '));
  return { ...sizes, staticGraph: aggregate };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href;
if (isMain) {
  try {
    await checkBundle(process.argv[2] ?? 'dist');
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
