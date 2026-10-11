import { WifiOff } from 'lucide-react';
import { MotionConfig } from 'motion/react';
import React from 'react';
import { Navigate, Route, HashRouter as Router, Routes, useLocation } from 'react-router-dom';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import Layout from '@/components/layouts/Layout';
import { RouteView } from '@/components/routing/RouteView';
import { Toaster } from '@/components/ui/sonner';
import { SettingsProvider, useSettings } from '@/contexts/AppSettings';
import { MuseumProvider, useMuseum } from '@/contexts/MuseumContext';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';
import NotFound from '@/pages/NotFound';
import { LEGACY_ROUTES, routes } from './routes';

/** 断网提示横幅 */
const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStatus();
  const { t } = useSettings();
  if (isOnline) return null;
  return (
    <div role="status" aria-label="当前处于离线状态" aria-live="polite" className="bg-destructive text-destructive-foreground text-center text-xs py-2 px-4 flex items-center justify-center gap-1.5">
      <WifiOff className="w-3.5 h-3.5" />
      {t('common.offline')}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { pathname } = useLocation();
  const { selectedCategory, setSelectedCategory, searchValue, setSearchValue } = useMuseum();

  return (
    <Layout
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
    >
      <OfflineBanner />
      <ErrorBoundary key={pathname}>
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={<RouteView route={route} />}
          />
        ))}
        {/* 旧页面路径统一回到首页序厅；/map 作为地图探索兼容入口保留在 routes 中。 */}
        {LEGACY_ROUTES.map((path) => (
          <Route key={path} path={path} element={<Navigate to="/" replace />} />
        ))}
        <Route path="*" element={<NotFound />} />
      </Routes>
      </ErrorBoundary>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <SettingsProvider>
        <MotionConfig reducedMotion="user">
        <MuseumProvider>
          <AppContent />
          <Toaster />
        </MuseumProvider>
        </MotionConfig>
      </SettingsProvider>
    </Router>
  );
};

export default App;
