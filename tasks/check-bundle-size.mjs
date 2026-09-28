import { readFile } from 'node:fs/promises';
import { gzipSync } from 'node:zlib';
import { resolve, join } from 'node:path';
import { pathToFileURL } from 'node:url';
export function evaluateEntry({ rawBytes, gzipBytes }) {
  const reasons = [];
  if (rawBytes > 650 * 1024) reasons.push('raw entry exceeds 650 KiB');
  if (gzipBytes > 220 * 1024) reasons.push('gzip entry exceeds 220 KiB');
  return { ok: reasons.length === 0, reasons };
}
export function collectStaticChunks(manifest, entry, visited = new Set()) {
  if (visited.has(entry)) return []; visited.add(entry);
  const item = manifest[entry]; if (!item) throw new Error('Unknown manifest key: ' + entry);
  return [item.file, ...(item.imports ?? []).flatMap(key => collectStaticChunks(manifest, key, visited))];
}
export async function checkBundle(folder = 'dist') {
  const manifest = JSON.parse(await readFile(join(folder, '.vite/manifest.json'), 'utf8'));
  const [key, entry] = Object.entries(manifest).find(([,v])=>v.isEntry) ?? [];
  if (!entry) throw new Error('No entry in Vite manifest');
  const data = await readFile(join(folder, entry.file));
  const sizes = { rawBytes: data.byteLength, gzipBytes: gzipSync(data).byteLength };
  const result = evaluateEntry(sizes);
  const staticFiles = collectStaticChunks(manifest, key);
  const aggregate = { rawBytes: 0, gzipBytes: 0 };
  for (const file of staticFiles) { const bytes = await readFile(join(folder,file)); aggregate.rawBytes += bytes.byteLength; aggregate.gzipBytes += gzipSync(bytes).byteLength; }
  console.log(JSON.stringify({ entry: entry.file, ...sizes, ...result, staticGraph: aggregate, staticFiles, note: 'Entry budgets do not include shared static data and vendor chunks; aggregate sizes are reported separately.' }, null, 2));
  if (!result.ok) throw new Error(result.reasons.join('; '));
  return { ...sizes, staticGraph: aggregate };
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await checkBundle(process.argv[2] ?? 'dist');
