import { ExternalLink, ShieldAlert } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';
import { publicAsset } from '@/lib/publicAsset';

export default function AIPrivacyNotice() {
  const { t } = useSettings();
  return (
    <aside role="note" aria-label={t('ai.privacyTitle')} className="mb-3 flex items-start gap-3 rounded-lg border border-amber-600/30 bg-amber-50/70 px-3 py-2.5 text-xs text-foreground dark:bg-amber-950/20">
      <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" aria-hidden="true" />
      <p className="leading-relaxed">
        <strong className="font-semibold">{t('ai.privacyTitle')}</strong>{' '}
        {t('ai.privacyBody')}{' '}
        <a className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2" href={publicAsset('privacy.html')} target="_blank" rel="noreferrer">
          {t('ai.privacyLink')} <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </a>
      </p>
    </aside>
  );
}
