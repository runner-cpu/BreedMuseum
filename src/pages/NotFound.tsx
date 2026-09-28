import { Link, useLocation } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useSettings } from '@/contexts/AppSettings';

export default function NotFound() {
  const { pathname } = useLocation();
  const { language } = useSettings();
  const zh = language === 'zh';
  const title = zh ? '页面未找到' : 'Page not found';
  return <section className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center gap-5 p-6 text-center">
    <PageMeta title={title} description="地址未找到，返回博物馆或浏览品种百科。" canonicalPath={pathname} />
    <BrandLogo compact className="h-16 w-16" />
    <p className="font-mono text-5xl text-primary">404</p>
    <h1 className="font-serif text-2xl font-semibold">{title}</h1>
    <p className="text-muted-foreground">{zh ? '这个地址没有对应的馆藏页面。' : 'This address does not match a museum page.'}</p>
    <code className="max-w-full break-all rounded bg-muted px-3 py-2 text-sm">{pathname}</code>
    <div className="flex flex-wrap justify-center gap-3">
      <Link to="/" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-primary-foreground">{zh ? '返回首页' : 'Home'}</Link>
      <Link to="/encyclopedia" className="inline-flex min-h-11 items-center rounded-lg border px-5">{zh ? '浏览品种百科' : 'Browse breeds'}</Link>
    </div>
  </section>;
}
