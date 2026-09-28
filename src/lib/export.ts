import type { Breed } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
export function serializeCsv(rows: (string | number)[][]): string {
  return rows.map(row => row.map(value => {
    let text = String(value ?? '');
    if (typeof value === 'string' && /^[=+@\-\t\r]/.test(text)) text = "'" + text;
    return /[",\r\n]/.test(text) ? '"' + text.replace(/"/g, '""') + '"' : text;
  }).join(',')).join('\r\n');
}
export function downloadCsv(rows: (string | number)[][], filename: string): void {
  const blob = new Blob(['\uFEFF' + serializeCsv(rows)], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename;
  document.body.appendChild(anchor); anchor.click(); anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function exportBreedsToCSV(breeds: Breed[], filename = '中国地方畜禽品种.csv'): void {
  const headers = ['品种名称', '英文名称', '类别', '所属省份', '编辑濒危标签', '体貌特征', '生产性能', '文化故事', '官方名录状态', '核对日期', '来源ID', '指标口径'];
  downloadCsv([headers, ...breeds.map(b => {
    const meta = getBreedMetadata(b);
    return [b.name, b.englishName, b.category, b.province, b.endangered, b.appearance, b.performance, b.story,
      meta.protectionStatus === 'national-list' ? '国家级保护名录' : '尚未核实', meta.verifiedAt,
      meta.sourceIds.join(';'), '编辑归一化指标（0–100），非实测性能'];
  })], filename);
}
