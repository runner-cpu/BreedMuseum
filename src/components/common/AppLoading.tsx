import { BrandLogo } from '@/components/brand/BrandLogo';
export default function AppLoading() {
  return <div role="status" aria-label="正在加载页面" className="flex min-h-[50vh] flex-col items-center justify-center gap-4 p-6">
    <BrandLogo compact /><p className="text-sm text-muted-foreground">正在加载页面…</p>
  </div>;
}
