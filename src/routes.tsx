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
 *   `/arcade`       互动厅总览（三台装置入口）
 *   `/arcade/:game` 互动厅子页面（找家 / 识图 / 问答，各自成页）
 *   `/breed/:id`    单卷档案（可分享）
 *   `/dashboard`    馆藏数据中枢（类别、产区与保护概览）
 *   `/about`        馆史与库房（数据来源、诚实映射表、AI 披露、质量仪表盘）
 *
 * 旧路由（/encyclopedia /compare /pasture /recommend /ai /home）
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
  { path: '/breed/:id', Component: lazy(() => import('./pages/BreedRecordPage')), meta: {
    zh: { title: '品种档案 · 畜种光图', description: '单卷档案件：档案编号、收录批次、三态核验徽章、体貌与生产性能，以及可点击的官方来源链。' },
    en: { title: 'Breed Record · Light Map', description: 'A single archived record with verification badge, editorial profile and links back to official documents.' },
  } },
  { path: '/about', Component: lazy(() => import('./pages/AboutPage')), meta: {
    zh: { title: '馆史与库房 · 数据来源与披露', description: '建馆路线、数据来源链、光图诚实映射表、工程质量仪表盘，以及 AI 使用与第三方资源的逐项披露。' },
    en: { title: 'About · Sources and Disclosure', description: 'Data provenance chain, honest mapping table, quality dashboard, and itemised AI / third-party disclosure.' },
  } },
];

/**
 * 路由访问顺序：`/arcade/xxx` 与 `/arcade` 都进入互动厅，
 * 前者渲染具体装置；未知装置名由页面自身重定向回总览。
 */

/** 旧页面路径 → 一律回到首页序厅（保留外链可用性）。`/map` 是地图探索兼容入口，故不列入此表。 */
export const LEGACY_ROUTES = [
  '/encyclopedia',
  '/compare',
  '/pasture',
  '/recommend',
  '/ai',
  '/home',
] as const;
