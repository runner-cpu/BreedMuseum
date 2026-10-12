import { type ComponentType, type LazyExoticComponent, lazy } from 'react';

interface MetaText { title: string; description: string }
export interface RouteConfig {
  path: string;
  Component: LazyExoticComponent<ComponentType>;
  meta: { zh: MetaText; en: MetaText };
}

/**
 * 页面清单：
 *   `/`             序厅首页（项目介绍、馆藏概览、参观路线与档案入口）
 *   `/explore`      地图探索（类别、保护与濒危镜头）
 *   `/map`          地图探索兼容入口（旧外链别名）
 *   `/encyclopedia` 品种百科（检索、筛选与图片卡片）
 *   `/arcade`       互动厅总览（三台装置入口）
 *   `/arcade/:game` 互动厅子页面（找家 / 识图 / 问答，各自成页）
 *   `/dashboard`    馆藏数据中枢（类别、产区与保护概览）
 *   `/compare`      品种对比（最多 4 条记录）
 *
 * 旧路由（/pasture /recommend /ai /home）
 * 由 `App.tsx` 里的 `<Navigate replace>` 统一重定向到 `/`，避免已发布外链 404。
 * 顺序有意义：`/arcade/:game` 必须排在 `/arcade` 之后以免被通配吞掉（React Router 按特异性匹配）。
 */
export const routes: RouteConfig[] = [
  { path: '/', Component: lazy(() => import('./pages/LightMapPage')), meta: {
    zh: { title: '首页序厅 · 中国地方畜禽品种数字博物馆', description: '认识中国地方畜禽品种数字博物馆的馆藏、来源与参观路线，再进入地图探索 1,186 条可追溯记录。' },
    en: { title: 'Museum Foyer · China Local Livestock Digital Museum', description: 'Meet the collection, sources, and visitor route of the China Local Livestock Digital Museum, then explore 1,186 traceable records on the map.' },
  } },
  { path: '/explore', Component: lazy(() => import('./pages/ExploreMapPage')), meta: {
    zh: { title: '地图探索 · 中国地方畜禽品种数字博物馆', description: '沿着省份、产区与类别，探索 1,186 条地方畜禽品种馆藏记录。' },
    en: { title: 'Explore the Map · China Local Livestock Digital Museum', description: 'Explore 1,186 local livestock records by province, production site, category, and conservation lens.' },
  } },
  { path: '/map', Component: lazy(() => import('./pages/ExploreMapPage')), meta: {
    zh: { title: '地图探索 · 中国地方畜禽品种数字博物馆', description: '沿着省份、产区与类别，探索 1,186 条地方畜禽品种馆藏记录。' },
    en: { title: 'Explore the Map · China Local Livestock Digital Museum', description: 'Explore 1,186 local livestock records by province, production site, category, and conservation lens.' },
  } },
  { path: '/encyclopedia', Component: lazy(() => import('./pages/EncyclopediaPage')), meta: {
    zh: { title: '品种百科 · 中国地方畜禽品种数字博物馆', description: '按名称、类别、省份与濒危等级检索 1,186 条地方畜禽品种馆藏记录。' },
    en: { title: 'Breed Encyclopedia · China Local Livestock Digital Museum', description: 'Search 1,186 local livestock records by name, category, province, and conservation level.' },
  } },
  { path: '/arcade', Component: lazy(() => import('./pages/ArcadePage')), meta: {
    zh: { title: '互动厅 · 三台展教装置', description: '找家挑战、识图挑战与知识问答：三台装置各自成页，题目全部由已核验的馆藏数据生成，每局结束可进入档案页核对官方来源。' },
    en: { title: 'Interactive Hall · Three Exhibits', description: 'Find-the-home, silhouette and quiz games generated from verified collection fields, each linking back to official sources.' },
  } },
  { path: '/arcade/:game', Component: lazy(() => import('./pages/ArcadeGamePage')), meta: {
    zh: { title: '展教装置 · 互动厅', description: '互动厅单台装置：一次只玩一台，可随时切换到另外两台，题目只取自已核验字段并附官方来源入口。' },
    en: { title: 'Exhibit · Interactive Hall', description: 'One interactive exhibit at a time, switchable at any moment; every question comes from verified fields.' },
  } },
  { path: '/dashboard', Component: lazy(() => import('./pages/DashboardPage')), meta: {
    zh: { title: '馆藏数据中枢 · 中国地方畜禽品种数字博物馆', description: '从类别构成、产区密度与保护状态阅读 1,186 条地方畜禽品种馆藏记录。' },
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
