import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { WifiOff } from 'lucide-react';
import IntersectObserver from '@/components/common/IntersectObserver';
import ErrorBoundary from '@/components/common/ErrorBoundary';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/layouts/Layout';
import { MuseumProvider, useMuseum } from '@/contexts/MuseumContext';
import { SettingsProvider, useSettings } from '@/contexts/AppSettings';
import { useNetworkStatus } from '@/hooks/useNetworkStatus';

import { routes } from './routes';

/** 断网提示横幅 */
const OfflineBanner: React.FC = () => {
  const isOnline = useNetworkStatus();
  const { t } = useSettings();
  if (isOnline) return null;
  return (
    <div className="fixed top-0 left-0 right-0 z-[100] bg-destructive text-destructive-foreground text-center text-xs py-2 px-4 flex items-center justify-center gap-1.5">
      <WifiOff className="w-3.5 h-3.5" />
      {t('common.offline')}
    </div>
  );
};

const AppContent: React.FC = () => {
  const { selectedCategory, setSelectedCategory, searchValue, setSearchValue } = useMuseum();

  return (
    <Layout
      selectedCategory={selectedCategory}
      onSelectCategory={setSelectedCategory}
      searchValue={searchValue}
      onSearchChange={setSearchValue}
    >
      <OfflineBanner />
      <ErrorBoundary>
      <Routes>
        {routes.map((route, index) => (
          <Route
            key={index}
            path={route.path}
            element={route.element}
          />
        ))}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      </ErrorBoundary>
    </Layout>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <SettingsProvider>
        <MuseumProvider>
          <IntersectObserver />
          <AppContent />
          <Toaster />
        </MuseumProvider>
      </SettingsProvider>
    </Router>
  );
};

export default App;
