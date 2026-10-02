import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
export function summarizeBreeds(items, resolveMetadata = () => ({ protectionStatus: 'unverified' })) {
  const count = field => items.reduce((counts, item) => { counts[item[field]] = (counts[item[field]] ?? 0) + 1; return counts; }, {});
  return { total: items.length, uniqueIds: new Set(items.map(b => b.id)).size, uniqueNames: new Set(items.map(b => b.name)).size,
    provinceCount: new Set(items.map(b => b.province)).size, categoryCounts: count('category'), endangeredCounts: count('endangered'), provinceCounts: count('province'),
    nationalProtectionCount: items.filter(b => resolveMetadata(b).protectionStatus === 'national-list').length,
    placeholderCount: items.filter(b => b.image === '/brand/breed-placeholder.svg').length };
}
export function replaceGeneratedSection(text, name, replacement) {
  const start = '<!-- ' + name + ':start -->'; const end = '<!-- ' + name + ':end -->';
  if (text.split(start).length !== 2 || text.split(end).length !== 2 || text.indexOf(end) < text.indexOf(start)) throw new Error('Missing or ambiguous markers: ' + name);
  // Keep the checked-out file's newline convention (LF on CI, CRLF on
  // Windows with core.autocrlf). Some existing documents are mixed, so use
  // the newline immediately after this generated block's start marker.
  const startIndex = text.indexOf(start);
  const blockEol = text.slice(startIndex + start.length).match(/^(\r?\n)/)?.[1];
  const eol = blockEol ?? (text.includes('\r\n') ? '\r\n' : '\n');
  const normalized = replacement.trim().replace(/\r?\n/g, eol);
  return text.slice(0, startIndex + start.length) + eol + normalized + eol + text.slice(text.indexOf(end));
}
export function buildImageIndexRows(items, resolveMetadata) {
  return [
    ['品种ID', '品种名称', '类别', '图片URL', '来源状态', '作者', '授权', '是否AI生成'],
    ...items.map((breed) => {
      const metadata = resolveMetadata(breed);
      const isProjectSvg = metadata.imageRights === 'project-svg';
      return [
        breed.id,
        breed.name,
        breed.category,
        breed.image,
        isProjectSvg ? '项目 SVG 占位' : '历史外链；来源权利待核验',
        isProjectSvg ? '本项目' : '',
        isProjectSvg ? '项目原生 SVG' : '',
        isProjectSvg ? '否（矢量代码）' : '未核验',
      ];
    }),
  ];
}
export function formatImageIndexCsv(rows, eol = '\r\n', withBom = true) {
  const csvCell = value => '"' + String(value ?? '').replace(/"/g, '""') + '"';
  return (withBom ? '\uFEFF' : '') + rows.map(row => row.map(csvCell).join(',')).join(eol) + eol;
}
function summaryMarkdown(s) {
  const rows = Object.entries(s.categoryCounts).sort((a,b) => b[1]-a[1]).map(([key, count]) => '| ' + key + ' | ' + count + ' |').join('\n');
  return ['数据版本：2026-09-27；统计日期：2026-10-02；口径：运行时归一化后的 breeds 数组。', '',
    '| 指标 | 实测值 |', '| --- | --- |', '| 馆藏条目 | ' + s.total + ' |', '| 唯一 ID / 名称 | ' + s.uniqueIds + ' / ' + s.uniqueNames + ' |',
    '| 覆盖省份 | ' + s.provinceCount + ' |', '| 分类 | ' + Object.keys(s.categoryCounts).length + ' |', '| 第 940 号公告畜禽名称匹配 | ' + s.nationalProtectionCount + ' / 271 |',
    '| 项目 SVG 占位图 | ' + s.placeholderCount + ' |', '', '| 类别 | 条目数 |', '| --- | --- |', rows, '',
    '编辑濒危标签统计（非权威保护结论）：' + Object.entries(s.endangeredCounts).map(([k,v]) => k + ' ' + v).join('；') + '。'].join('\n');
}
export async function syncDataDocs(check = false) {
  const { withBreedData } = await import('./data-runtime.mjs');
  return withBreedData(async ({ breeds, getBreedMetadata, protectedNames, auditBreedDataset }) => {
    const issues = auditBreedDataset(breeds, { resolveMetadata: getBreedMetadata });
    const missing = protectedNames.filter(name => !breeds.some(b => getBreedMetadata(b).officialName === name));
    if (issues.length || missing.length) throw new Error(JSON.stringify({ issues, missing }));
    const summary = summarizeBreeds(breeds, getBreedMetadata);
    const pending = [];
    for (const file of ['README.md', 'docs/网站说明书.md', 'docs/品种数据手册.md']) {
      const old = await readFile(file, 'utf8');
      pending.push([file, old, replaceGeneratedSection(old, 'data-summary', summaryMarkdown(summary))]);
    }
    const imageRows = buildImageIndexRows(breeds, getBreedMetadata);
    const file = 'docs/品种图片索引.csv';
    const oldCsv = await readFile(file, 'utf8');
    const csvEol = oldCsv.includes('\r\n') ? '\r\n' : '\n';
    const hasBom = oldCsv.charCodeAt(0) === 0xfeff;
    pending.push([file, oldCsv, formatImageIndexCsv(imageRows, csvEol, hasBom)]);
    const changed = pending.filter(([,old,next]) => old !== next);
    if (check && changed.length) throw new Error('Documents need synchronization: ' + changed.map(([p])=>p).join(', '));
    if (!check) for (const [p,,next] of changed) await writeFile(p, next, 'utf8');
    console.log(JSON.stringify({ ...summary, missingProtectedNames: missing, auditIssues: issues.length, changedFiles: changed.map(([p])=>p) }, null, 2));
    return summary;
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) await syncDataDocs(process.argv.includes('--check'));
