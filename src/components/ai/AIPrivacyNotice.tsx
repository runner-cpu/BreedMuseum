import { ExternalLink, ShieldAlert } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';
import { publicAsset } from '@/lib/publicAsset';

export default function AIPrivacyNotice() {
  const { t } = useSettings();
  return (
    <details role="note" aria-label={t('ai.privacyTitle')} className="mb-2 group rounded-lg border border-amber-600/30 bg-amber-50/70 px-3 py-1.5 text-xs text-foreground dark:bg-amber-950/20">
      <summary className="flex cursor-pointer list-none items-center gap-2 py-1 text-muted-foreground select-none [&::-webkit-details-marker]:hidden">
        <ShieldAlert className="h-3.5 w-3.5 shrink-0 text-amber-700" aria-hidden="true" />
        <span className="font-medium">{t('ai.privacyTitle')}</span>
        <span className="ml-auto text-[10px] opacity-70 group-open:hidden">{t('ai.privacyExpand')}</span>
      </summary>
      <p className="px-0 pb-2 pt-1 leading-relaxed">
        {t('ai.privacyBody')}{' '}
        <a className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2" href={publicAsset('privacy.html')} target="_blank" rel="noreferrer">
          {t('ai.privacyLink')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>
    </details>
  );
}
