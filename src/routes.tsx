import HomePage from './pages/HomePage';
import MapPage from './pages/MapPage';
import DashboardPage from './pages/DashboardPage';
import EncyclopediaPage from './pages/EncyclopediaPage';
import AIAssistantPage from './pages/AIAssistantPage';
import ComparePage from './pages/ComparePage';
import type { ReactNode } from 'react';

export interface RouteConfig {
  name: string;
  path: string;
  element: ReactNode;
  visible?: boolean;
}

export const routes: RouteConfig[] = [
  {
    name: '首页',
    path: '/',
    element: <HomePage />,
  },
  {
    name: '品种地图',
    path: '/map',
    element: <MapPage />,
  },
  {
    name: '数据看板',
    path: '/dashboard',
    element: <DashboardPage />,
  },
  {
    name: '品种百科',
    path: '/encyclopedia',
    element: <EncyclopediaPage />,
  },
  {
    name: 'AI助手',
    path: '/ai',
    element: <AIAssistantPage />,
  },
  {
    name: '品种对比',
    path: '/compare',
    element: <ComparePage />,
  },
];
