/**
 * Small, audited facts used by the shell and the landing page. Keeping these
 * facts independent of the 1186-record module prevents the first paint from
 * importing the complete collection just to render a footer statistic.
 *
 * 落点口径：`mappable` = 运行时记录中同时具备已核验省份与已核验坐标的数量；
 * 3D 光图与 2D 地图只渲染这些记录，哨兵坐标（0,0）与“待核验”省份不落点。
 */
export const COLLECTION_VERSION = '2026-09-27';

export const COLLECTION_SUMMARY = {
  total: 1186,
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
 * 测试数量在里程碑收口时更新；数值由 collectionSummary 契约测试保证为整数。
 */
export const QUALITY_SUMMARY = {
  unitTests: 128,
  e2eTests: 36,
  auditChecks: 11,
  workflows: 2,
  dataVersion: COLLECTION_VERSION,
} as const;
