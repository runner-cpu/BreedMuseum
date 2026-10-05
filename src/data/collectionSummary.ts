/**
 * Small, audited facts used by the shell and the landing page. Keeping these
 * facts independent of the 1088-record module prevents the first paint from
 * importing the complete collection just to render a footer statistic.
 */
export const COLLECTION_VERSION = '2026-09-27';

export const COLLECTION_SUMMARY = {
  total: 1088,
  provinces: 31,
  categories: 11,
  editorialEndangered: 82,
  nationalProtectedMatches: 271,
} as const;
