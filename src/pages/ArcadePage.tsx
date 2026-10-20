import { Link } from 'react-router-dom';
import { Gamepad2, Info } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';
import { ARCADE_GAMES } from '@/lib/arcade/games';
import { ExhibitCard } from '@/components/home/ExhibitCard';

export default function ArcadePage() {
  const { t } = useSettings();

  return (
    <div className="min-h-full bg-stage px-4 py-8 text-stage-fg">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-3">
          <p className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-stage-gold">
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            {t('arcade.eyebrow')}
          </p>
          <h1 className="font-serif text-3xl">{t('arcade.title')}</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-stage-muted">{t('arcade.intro')}</p>
        </header>

        <ul className="grid gap-4 md:grid-cols-3">
          {ARCADE_GAMES.map((game) => (
            <li key={game.id}>
              <ExhibitCard game={game} />
            </li>
          ))}
        </ul>

        <section
          aria-label={t('arcade.redLineTitle')}
          className="flex flex-wrap items-start gap-2 rounded-2xl border border-stage-border bg-stage-panel p-4 text-xs text-stage-muted"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stage-gold" aria-hidden="true" />
          <p className="max-w-4xl leading-relaxed">
            <span className="text-stage-fg">{t('arcade.redLineTitle')}：</span>
            {t('arcade.redLine')}
          </p>
        </section>

        <nav aria-label={t('arcade.relatedPages')} className="flex flex-wrap gap-4 text-sm">
          <Link className="underline underline-offset-4 hover:text-stage-gold" to="/">
            {t('arcade.backHome')}
          </Link>
          <Link className="underline underline-offset-4 hover:text-stage-gold" to="/dashboard">
            {t('arcade.openDashboard')}
          </Link>
        </nav>
      </div>
    </div>
  );
}
