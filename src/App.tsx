import React from 'react';
import { HashRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/layouts/Layout';
import { MuseumProvider, useMuseum } from '@/contexts/MuseumContext';
import { SettingsProvider, useSettings } from '@/contexts/AppSettings';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { routes } from './routes';
import { RouteView } from '@/components/routing/RouteView';
import NotFound from '@/pages/NotFound';
import { MotionConfig } from 'motion/react';

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
