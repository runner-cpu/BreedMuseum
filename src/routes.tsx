import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

interface MetaText { title: string; description: string }
export interface RouteConfig {
  path: string;
  Component: LazyExoticComponent<ComponentType>;
  meta: { zh: MetaText; en: MetaText };
}

/**
 * 页面清单：
 *   `/`             光图主展项（四镜头 + 省份聚焦 + 检索）
 *   `/arcade`       互动厅总览（三台装置入口）
 *   `/arcade/:game` 互动厅子页面（找家 / 识图 / 问答，各自成页）
 *   `/breed/:id`    单卷档案（可分享）
 *   `/about`        馆史与库房（数据来源、诚实映射表、AI 披露、质量仪表盘）
 *
 * 旧路由（/map /encyclopedia /dashboard /compare /pasture /recommend /ai /home）
 * 由 `App.tsx` 里的 `<Navigate replace>` 统一重定向到 `/`，避免已发布外链 404。
 * 顺序有意义：`/arcade/:game` 必须排在 `/arcade` 之后以免被通配吞掉（React Router 按特异性匹配）。
 */
export const routes: RouteConfig[] = [
  { path: '/', Component: lazy(() => import('./pages/LightMapPage')), meta: {
    zh: { title: '畜种光图 · 中国地方畜禽品种数字博物馆', description: '1186 份官方核验档案落在真实产区坐标上：四个镜头看全国分布、国家级保护与濒危现状，点任意一束光查看品种档案与官方来源。' },
    en: { title: 'Breed Light Map · China Local Livestock Digital Museum', description: '1,186 verified records placed on real production coordinates. Four lenses cover national distribution, protected breeds and endangered records.' },
  } },
  { path: '/arcade', Component: lazy(() => import('./pages/ArcadePage')), meta: {
    zh: { title: '互动厅 · 三台展教装置', description: '找家挑战、识图挑战与知识问答：三台装置各自成页，题目全部由已核验的馆藏数据生成，每局结束可进入档案页核对官方来源。' },
    en: { title: 'Interactive Hall · Three Exhibits', description: 'Find-the-home, silhouette and quiz games generated from verified collection fields, each linking back to official sources.' },
  } },
  { path: '/arcade/:game', Component: lazy(() => import('./pages/ArcadeGamePage')), meta: {
    zh: { title: '展教装置 · 互动厅', description: '互动厅单台装置：一次只玩一台，可随时切换到另外两台，题目只取自已核验字段并附官方来源入口。' },
    en: { title: 'Exhibit · Interactive Hall', description: 'One interactive exhibit at a time, switchable at any moment; every question comes from verified fields.' },
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

/** 旧页面路径 → 一律回到光图（保留外链可用性）。 */
export const LEGACY_ROUTES = [
  '/map',
  '/encyclopedia',
  '/dashboard',
  '/compare',
  '/pasture',
  '/recommend',
  '/ai',
  '/home',
] as const;
