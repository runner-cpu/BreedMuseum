import { Link } from 'react-router-dom';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useSettings } from '@/contexts/AppSettings';

export function BackendUnavailable() {
  const { language } = useSettings();
  const zh = language === 'zh';
  return <section className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center gap-5 px-6 py-12 text-center">
    <BrandLogo compact className="h-16 w-16" />
    <h1 className="font-serif text-2xl font-semibold">{zh ? 'AI 服务尚未配置' : 'AI service is not configured'}</h1>
    <p className="text-muted-foreground leading-relaxed">{zh ? '本站的 AI 问答与识别服务暂未启用。您仍可浏览全部品种资料、地图、数据看板和品种对比。' : 'AI chat and recognition are unavailable. The encyclopedia, map, dashboard and comparison remain available.'}</p>
    <Link className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-primary-foreground" to="/encyclopedia">{zh ? '浏览品种百科' : 'Browse breeds'}</Link>
  </section>;
}
