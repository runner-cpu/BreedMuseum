import { BrandLogo } from '@/components/brand/BrandLogo';
import { useSettings } from '@/contexts/AppSettings';

export default function AppLoading() {
  const { t } = useSettings();
  return <div role="status" aria-label={t('common.loadingPage')} className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
    <BrandLogo compact /><p className="text-sm text-muted-foreground">{t('common.loadingPage')}</p>
  </div>;
}
