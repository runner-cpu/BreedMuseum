import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

interface MetaText { title: string; description: string }
export interface RouteConfig {
  path: string;
  Component: LazyExoticComponent<ComponentType>;
  meta: { zh: MetaText; en: MetaText };
}

/**
 * 页面清单：
 *   `/`             序厅首页（项目介绍、搜索、入口与精选品种）
 *   `/explore`      地图探索（类别标签、地图与选中品种卡）
 *   `/map`          地图探索兼容入口（旧外链别名）
 *   `/encyclopedia` 品种百科（检索、筛选与图片卡片）
 *   `/arcade`       互动厅总览（三台装置入口）
 *   `/arcade/:game` 互动厅子页面（找家 / 识图 / 问答，各自成页）
 *   `/dashboard`    馆藏数据中枢（地图、类别、产区、保护与覆盖度图表）
 *   `/compare`      品种对比（最多 4 条记录）
 *
 * 旧路由（/pasture /recommend /ai /home）
 * 由 `App.tsx` 里的 `<Navigate replace>` 统一重定向到 `/`，避免已发布外链 404。
 * 顺序有意义：`/arcade/:game` 必须排在 `/arcade` 之后以免被通配吞掉（React Router 按特异性匹配）。
 */
export const routes: RouteConfig[] = [
  { path: '/', Component: lazy(() => import('./pages/LightMapPage')), meta: {
    zh: { title: '首页序厅 · 中国地方畜禽品种数字博物馆', description: '馆藏 1,186 条地方畜禽品种记录，其中 667 条带图可浏览、1,062 条产区已核验；从序厅进入地图探索、品种百科与数据看板。' },
    en: { title: 'Museum Foyer · China Local Livestock Digital Museum', description: '1,186 local livestock records, 667 with browsable images and 1,062 with verified production sites; enter the map, encyclopedia and dashboard from the foyer.' },
  } },
  { path: '/explore', Component: lazy(() => import('./pages/ExploreMapPage')), meta: {
    zh: { title: '地图探索 · 中国地方畜禽品种数字博物馆', description: '沿着省份、产区与类别浏览 667 条带图馆藏记录，聚成 202 个产区、覆盖 30 个省级行政区。' },
    en: { title: 'Explore the Map · China Local Livestock Digital Museum', description: 'Browse 667 illustrated records by province, production site and category, clustered into 202 sites across 30 provincial regions.' },
  } },
  { path: '/map', Component: lazy(() => import('./pages/ExploreMapPage')), meta: {
    zh: { title: '地图探索 · 中国地方畜禽品种数字博物馆', description: '沿着省份、产区与类别浏览 667 条带图馆藏记录，聚成 202 个产区、覆盖 30 个省级行政区。' },
    en: { title: 'Explore the Map · China Local Livestock Digital Museum', description: 'Browse 667 illustrated records by province, production site and category, clustered into 202 sites across 30 provincial regions.' },
  } },
  { path: '/encyclopedia', Component: lazy(() => import('./pages/EncyclopediaPage')), meta: {
    zh: { title: '品种百科 · 中国地方畜禽品种数字博物馆', description: '按名称、类别、省份与濒危等级检索 667 条带图馆藏记录，逐条标注来源与核验状态。' },
    en: { title: 'Breed Encyclopedia · China Local Livestock Digital Museum', description: 'Search 667 illustrated collection records by name, category, province and conservation level, each with sources and verification status.' },
  } },
  { path: '/arcade', Component: lazy(() => import('./pages/ArcadePage')), meta: {
    zh: { title: '互动厅 · 三台展教装置', description: '找家挑战、识图挑战与知识问答：三台装置各自成页，题目全部由已核验的馆藏数据生成，答题后可打开百科详情。' },
    en: { title: 'Interactive Hall · Three Exhibits', description: 'Find-the-home, silhouette and quiz games generated from verified collection fields, each linking back to an encyclopedia detail drawer.' },
  } },
  { path: '/arcade/:game', Component: lazy(() => import('./pages/ArcadeGamePage')), meta: {
    zh: { title: '展教装置 · 互动厅', description: '互动厅单台装置：一次只玩一台，可随时切换到另外两台，题目只取自已核验字段并可打开百科详情。' },
    en: { title: 'Exhibit · Interactive Hall', description: 'One interactive exhibit at a time, switchable at any moment; every question comes from verified fields and opens an encyclopedia detail drawer.' },
  } },
  { path: '/dashboard', Component: lazy(() => import('./pages/DashboardPage')), meta: {
    zh: { title: '馆藏数据中枢 · 中国地方畜禽品种数字博物馆', description: '从类别构成、产区密度与保护状态阅读 667 条带图记录，并与 1,186 条全馆藏口径对照。' },
    en: { title: 'Collection Intelligence · China Local Livestock Digital Museum', description: 'Read the collection through category composition, regional density, and conservation status.' },
  } },
  { path: '/compare', Component: lazy(() => import('./pages/ComparisonPage')), meta: {
    zh: { title: '品种对比 · 中国地方畜禽品种数字博物馆', description: '并列查看最多四条地方畜禽品种馆藏记录。' },
    en: { title: 'Breed Comparison · China Local Livestock Digital Museum', description: 'Compare up to four local livestock collection records side by side.' },
  } },
];

/**
 * 路由访问顺序：`/arcade/xxx` 与 `/arcade` 都进入互动厅，
 * 前者渲染具体装置；未知装置名由页面自身重定向回总览。
 */

/** 旧页面路径 → 一律回到首页序厅（保留外链可用性）。`/map` 是地图探索兼容入口，故不列入此表。 */
export const LEGACY_ROUTES = [
  '/pasture',
  '/recommend',
  '/ai',
  '/home',
] as const;
