import { HelmetProvider, Helmet } from "react-helmet-async";
import { TooltipProvider } from "@/components/ui/tooltip";

const PageMeta = ({
  title,
  description,
  canonicalPath = '/',
}: {
  title: string;
  description: string;
  canonicalPath?: string;
}) => (
  <Helmet>
    <title>{title}</title>
    <meta name="description" content={description} />
    <link rel="canonical" href={`${window.location.origin}${window.location.pathname}#${canonicalPath}`} />
    <meta property="og:type" content="website" />
    <meta property="og:title" content={title} />
    <meta property="og:description" content={description} />
    <meta property="og:url" content={`${window.location.origin}${window.location.pathname}#${canonicalPath}`} />
    <meta property="og:image" content={new URL('brand/museum-mark.svg', window.location.href).href} />
  </Helmet>
);

export const AppWrapper = ({ children }: { children: React.ReactNode }) => (
  <HelmetProvider>
    <TooltipProvider>
      {children}
    </TooltipProvider>
  </HelmetProvider>
);

export default PageMeta;
