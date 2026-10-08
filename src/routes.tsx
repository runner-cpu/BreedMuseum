import { lazy, type ComponentType, type LazyExoticComponent } from 'react';
interface MetaText { title: string; description: string }
export interface RouteConfig {
  path: string;
  Component: LazyExoticComponent<ComponentType>;
  meta: { zh: MetaText; en: MetaText };
}
export const routes: RouteConfig[] = [
  { path: '/', Component: lazy(() => import('./pages/HomePage')), meta: {
    zh: { title: '中国地方畜禽品种数字博物馆', description: '探索中国地方畜禽品种的地理分布、文化故事与遗传资源保护信息。' },
    en: { title: 'China Local Livestock Breed Digital Museum', description: 'Explore Chinese livestock breeds, distribution and conservation records. Breed narratives are in Chinese.' },
  } },
  { path: '/map', Component: lazy(() => import('./pages/MapPage')), meta: {
    zh: { title: '品种分布地图', description: '按省份、畜种或名称查找地方品种，阅读品种详情与数据来源。' },
    en: { title: 'Breed Distribution Map', description: 'Find Chinese breeds by province, category, name and aliases.' },
  } },
  { path: '/pasture', Component: lazy(() => import('./pages/PasturePage')), meta: {
    zh: { title: '高原牧场环境决策台', description: '输入温度、湿度、海拔与畜龄，前端即时计算温湿指数 THI 与热应激等级，输出放牧与补饲管理建议。' },
    en: { title: 'Plateau Pasture Environment Console', description: 'Compute the temperature-humidity index and heat-stress level in the browser and get grazing advice.' },
  } },
  { path: '/recommend', Component: lazy(() => import('./pages/RecommendPage')), meta: {
    zh: { title: '品种智能推荐引擎', description: '按海拔区间、养殖目的与饲养模式，从馆藏高原畜种中匹配适应性评分最高的品种与理由。' },
    en: { title: 'Breed Recommendation Engine', description: 'Match highland breeds by altitude, production goal and husbandry mode with rule-based scores.' },
  } },
  { path: '/dashboard', Component: lazy(() => import('./pages/DashboardPage')), meta: {
    zh: { title: '畜禽品种数据看板', description: '查看站内收录品种的类别、省份和编辑分级统计，以及可读数据表。' },
    en: { title: 'Breed Data Dashboard', description: 'View category and province statistics derived from the museum collection.' },
  } },
  { path: '/encyclopedia', Component: lazy(() => import('./pages/EncyclopediaPage')), meta: {
    zh: { title: '畜禽品种百科', description: '搜索地方畜禽品种的规范名、别名与英文名，按类别和省份筛选资料。' },
    en: { title: 'Breed Encyclopedia', description: 'Search breed names and aliases. Descriptive breed records are currently available in Chinese.' },
  } },
  { path: '/ai', Component: lazy(() => import('./pages/AIAssistantPage')), meta: {
    zh: { title: 'AI 品种助手', description: '辅助了解畜禽品种。AI 服务依部署配置启用，回答与识别结果仅供参考。' },
    en: { title: 'AI Breed Assistant', description: 'An optional educational assistant. AI answers and recognition require independent verification.' },
  } },
  { path: '/compare', Component: lazy(() => import('./pages/ComparePage')), meta: {
    zh: { title: '品种对比', description: '并列比较最多四个畜禽品种的产地、体貌、生产特征和编辑归一化指标。' },
    en: { title: 'Breed Comparison', description: 'Compare up to four breeds and their editorial educational profiles.' },
  } },
];
