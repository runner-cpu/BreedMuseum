import { describe, expect, it } from 'vitest';
import { breeds, categories } from '@/data/breeds';
import { COLLECTION_SUMMARY, QUALITY_SUMMARY } from '../collectionSummary';

describe('collection summary contract', () => {
  it('matches the audited runtime collection', () => {
    expect(COLLECTION_SUMMARY.total).toBe(breeds.length);
    expect(COLLECTION_SUMMARY.provinces).toBe(new Set(breeds.filter((breed) => breed.province !== '待核验').map((breed) => breed.province)).size);
    expect(COLLECTION_SUMMARY.categories).toBe(categories.length);
    expect(COLLECTION_SUMMARY.plateau).toBe(
      breeds.filter((breed) => breed.province === '青海' || breed.province === '西藏').length,
    );
    expect(COLLECTION_SUMMARY.editorialEndangered).toBe(
      breeds.filter((breed) => breed.endangered === '濒危' || breed.endangered === '极危').length,
    );
  });

  /**
   * 质量仪表盘是人工维护的里程碑快照，不是实时计数——所以这里不比对
   * `vitest run` 的实际用例数（那会让文件数一多就必须改常量）。
   * 但至少要挡住"手滑写成 0、负数、小数或字符串"这一类把 /about 页
   * 数字弄脏的改动。
   */
  it('publishes the quality dashboard as positive whole numbers', () => {
    const displayed = {
      unitTests: QUALITY_SUMMARY.unitTests,
      e2eTests: QUALITY_SUMMARY.e2eTests,
      auditChecks: QUALITY_SUMMARY.auditChecks,
      workflows: QUALITY_SUMMARY.workflows,
    };
    for (const [label, value] of Object.entries(displayed)) {
      expect(Number.isInteger(value), label).toBe(true);
      expect(value, label).toBeGreaterThan(0);
    }
    // 单元测试要多于端到端用例，否则说明两个数字写反了
    expect(QUALITY_SUMMARY.unitTests).toBeGreaterThan(QUALITY_SUMMARY.e2eTests);
    expect(QUALITY_SUMMARY.dataVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
