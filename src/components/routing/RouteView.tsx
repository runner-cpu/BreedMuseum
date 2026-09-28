import { Suspense } from 'react';
import type { RouteConfig } from '@/routes';
import PageMeta from '@/components/common/PageMeta';
import AppLoading from '@/components/common/AppLoading';
import { useSettings } from '@/contexts/AppSettings';
export function RouteView({ route }: { route: RouteConfig }) {
  const { language } = useSettings();
  const { Component } = route;
  return <>
    <PageMeta {...route.meta[language]} canonicalPath={route.path} />
    <Suspense fallback={<AppLoading />}><Component /></Suspense>
  </>;
}
