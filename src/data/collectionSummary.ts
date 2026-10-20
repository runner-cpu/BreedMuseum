/**
 * Small, audited facts used by the shell and the landing page. Keeping these
 * facts independent of the 1186-record module prevents the first paint from
 * importing the complete collection just to render a footer statistic.
 *
 * 落点口径：`mappable` = 运行时记录中同时具备已核验省份与已核验坐标的数量；
 * 2D 光图只渲染这些记录，哨兵坐标（0,0）与“待核验”省份不落点。
 */
export const COLLECTION_VERSION = '2026-09-27';

export const COLLECTION_SUMMARY = {
  total: 1186,
  /**
   * 访客可浏览的馆藏：指向真实图片、且未被占位图过滤掉的记录。
   * 地图、百科、看板与页脚都只统计这一口径，避免把“未经图片核验的条目”
   * 包装成已可浏览的展品（与 `visibleBreeds.ts` 同一判定）。
   * 由 `collectionSummary.test.ts` 与运行时 `visibleBreeds` 逐项比对，防止漂移。
   */
  visibleTotal: 667,
  /** 可浏览记录覆盖的省级行政区数（全馆藏为 31，含仅有名录条目的省份） */
  visibleProvinces: 30,
  /** 可浏览记录覆盖的类别数（全馆藏为 15，蜂暂无可用图片） */
  visibleCategories: 14,
  /**
   * 地图实际渲染的落点：可浏览记录全部都有已核验坐标，
   * 按 0.22 半径聚合后得到的产区簇数量。
   * 全馆藏口径是 1062 条 / 161 簇，但地图只画带图记录，文案不能再用那个数。
   */
  visibleMappable: 667,
  visibleClusters: 154,
  provinces: 31,
  categories: 15,
  /** 青藏高原口径：青海 + 西藏 */
  plateau: 66,
  /** 青海地方品种数 */
  qinghai: 28,
  /** 西藏地方品种数 */
  xizang: 38,
  /** 青藏高原口径下收录于农业农村部第940号公告的品种数（青海7 + 西藏6） */
  plateauNationalProtected: 13,
  editorialEndangered: 82,
  nationalProtectedMatches: 271,
  /** 光图可落点记录数（省份与坐标均已核验） */
  mappable: 1062,
  /** 产区待核验、暂不落点也不参与省份统计的记录数 */
  unverifiedProvince: 124,
} as const;

/**
 * 工程质量仪表盘常量（/about 页与文档共用）。
 *
 * 这些是**人工维护的里程碑快照**，由里程碑收口时按实测结果更新，
 * `collectionSummary.test.ts` 只保证它们是非负整数、不会悄悄变成小数或负数。
 * 测试数量不参与数据审计，也不阻止别人在本地跑更多测试；它们只用来向观众说明
 * 「这个项目有自动化测试体系」，不是每次提交的实时计数。
 */
export const QUALITY_SUMMARY = {
  /** Vitest 用例数（`npx vitest run` 的实际总数） */
  unitTests: 155,
  /** Playwright 用例数；每个用例在桌面/移动两个 project 各跑一次，合计 70 项运行 */
  e2eTests: 35,
  auditChecks: 11,
  workflows: 2,
  dataVersion: COLLECTION_VERSION,
} as const;
