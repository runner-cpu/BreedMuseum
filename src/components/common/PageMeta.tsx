import { HelmetProvider, Helmet } from 'react-helmet-async';
import { TooltipProvider } from '@/components/ui/tooltip';

export function buildSiteAssetUrl(assetPath: string, baseHref: string): string {
  const base = baseHref.endsWith('/') ? baseHref : baseHref + '/';
  return new URL(assetPath.replace(/^\/+/, ''), base).href;
}

/** HashRouter fragments are not canonical resources; publish the Pages root. */
export function buildCanonicalUrl(_canonicalPath: string, baseHref: string): string {
  const base = baseHref.endsWith('/') ? baseHref : baseHref + '/';
  return new URL('.', base).href;
}

const PageMeta = ({
  title,
  description,
  canonicalPath = '/',
}: {
  title: string;
  description: string;
  canonicalPath?: string;
}) => {
  const baseHref = new URL(import.meta.env.BASE_URL || './', window.location.href).href;
  const canonicalUrl = buildCanonicalUrl(canonicalPath, baseHref);
  return (
    <Helmet>
      <title>{title}</title>
      <meta name="description" content={description} />
      <link rel="canonical" href={canonicalUrl} />
      <meta property="og:type" content="website" />
      <meta property="og:site_name" content="中国地方畜禽品种数字博物馆" />
      <meta property="og:locale" content="zh_CN" />
      <meta property="og:title" content={title} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={canonicalUrl} />
      <meta property="og:image" content={buildSiteAssetUrl('brand/museum-mark.svg', baseHref)} />
      <meta property="og:image:alt" content="中国地方畜禽品种数字博物馆" />
      <meta name="twitter:card" content="summary" />
    </Helmet>
  );
};

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <TooltipProvider>
      {children}
    </TooltipProvider>
  </HelmetProvider>
);

export default PageMeta;
