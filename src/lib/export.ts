import type { Breed } from '@/data/breeds';

/**
 * 将品种列表导出为 CSV 文件并触发下载。
 * 兼容 Excel 打开（带 UTF-8 BOM，避免中文乱码）。
 */
export function exportBreedsToCSV(breeds: Breed[], filename = '中国地方畜禽品种.csv'): void {
  const headers = ['品种名称', '英文名称', '类别', '所属省份', '濒危等级', '体貌特征', '生产性能', '文化故事'];
  const rows = breeds.map((b) => [
    b.name,
    b.englishName,
    b.category,
    b.province,
    b.endangered,
    b.appearance,
    b.performance,
    b.story,
  ]);
  const escape = (val: string) => {
    const s = String(val ?? '');
    if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n');
  const blob = new Blob(['\﻿' + csv], { type: 'text/csv;charset=utf-8;' });
  triggerDownload(blob, filename);
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}