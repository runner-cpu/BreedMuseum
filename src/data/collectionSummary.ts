/**
 * Small, audited facts used by the shell and the landing page. Keeping these
 * facts independent of the 1186-record module prevents the first paint from
 * importing the complete collection just to render a footer statistic.
 */
export const COLLECTION_VERSION = '2026-09-27';

export const COLLECTION_SUMMARY = {
  total: 1186,
  provinces: 31,
  categories: 11,
  /** 青藏高原口径：青海 + 西藏 */
  plateau: 66,
  editorialEndangered: 82,
  nationalProtectedMatches: 271,
} as const;
