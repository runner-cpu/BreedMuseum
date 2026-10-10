import { Link, useLocation } from 'react-router-dom';
import PageMeta from '@/components/common/PageMeta';
import { BrandLogo } from '@/components/brand/BrandLogo';
import { useSettings } from '@/contexts/AppSettings';

export default function NotFound() {
  const { pathname } = useLocation();
  const { t } = useSettings();
  const title = t('nf.title');
  return <section className="mx-auto flex min-h-[65vh] max-w-xl flex-col items-center justify-center gap-5 p-6 text-center">
    <PageMeta title={title} description={t('nf.metaDesc')} canonicalPath={pathname} />
    <BrandLogo compact className="h-16 w-16" />
    <p className="font-mono text-5xl text-primary">404</p>
    <h1 className="font-serif text-2xl font-semibold">{title}</h1>
    <p className="text-muted-foreground">{t('nf.body')}</p>
    <code className="max-w-full break-all rounded bg-muted px-3 py-2 text-sm">{pathname}</code>
    <div className="flex flex-wrap justify-center gap-3">
      <Link to="/" className="inline-flex min-h-11 items-center rounded-lg bg-primary px-5 text-primary-foreground">{t('nf.backHome')}</Link>
      <Link to="/arcade" className="inline-flex min-h-11 items-center rounded-lg border px-5">{t('nf.browseEnc')}</Link>
    </div>
  </section>;
}
