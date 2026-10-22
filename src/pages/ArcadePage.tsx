import { Link } from 'react-router-dom';
import { ArrowUpRight, Gamepad2, Info, MapPinned, ScanEye, Trophy } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';
import ScrollFloat from '@/components/effects/ScrollFloat';
import { ARCADE_GAMES } from '@/lib/arcade/games';
import { ExhibitCard } from '@/components/home/ExhibitCard';

const HIGHLIGHTS = [
  { icon: MapPinned, key: 'arcade.hallPointMap' },
  { icon: ScanEye, key: 'arcade.hallPointPhoto' },
  { icon: Trophy, key: 'arcade.hallPointQuiz' },
] as const;

export default function ArcadePage() {
  const { t } = useSettings();

  return (
    <div className="min-h-full bg-stage px-4 py-8 text-stage-fg sm:px-7 lg:px-10 lg:py-10">
      <div className="mx-auto w-full max-w-[1480px] space-y-8">
        {/* 页头：标题与三台装置的一句话清单并排，宽屏下不再把正文挤在中间一小溜 */}
        <header className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-12">
          <div className="max-w-2xl space-y-3">
            <p className="flex items-center gap-2 font-mono text-xs tracking-[0.2em] text-stage-gold">
              <Gamepad2 className="h-4 w-4" aria-hidden="true" />
              {t('arcade.eyebrow')}
            </p>
            <ScrollFloat as="h1" once containerClassName="font-serif text-3xl sm:text-4xl" stagger={0.035} animationDuration={0.8}>
              {t('arcade.title')}
            </ScrollFloat>
            <p className="text-sm leading-relaxed text-stage-muted">{t('arcade.intro')}</p>
          </div>

          <ul className="grid w-full max-w-xl shrink-0 gap-2 sm:grid-cols-3 lg:w-auto lg:max-w-none">
            {HIGHLIGHTS.map(({ icon: Icon, key }) => (
              <li
                key={key}
                className="flex items-start gap-2 rounded-xl border border-stage-border bg-stage-panel px-3 py-2.5 text-xs leading-snug text-stage-muted"
              >
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-stage-gold" aria-hidden="true" />
                {t(key)}
              </li>
            ))}
          </ul>
        </header>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 lg:gap-6">
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
          <p className="max-w-5xl leading-relaxed">
            <span className="text-stage-fg">{t('arcade.redLineTitle')}：</span>
            {t('arcade.redLine')}
          </p>
        </section>

        <nav aria-label={t('arcade.relatedPages')} className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
          <Link className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-stage-gold" to="/">
            {t('arcade.backHome')}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
          <Link className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-stage-gold" to="/dashboard">
            {t('arcade.openDashboard')}
            <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </nav>
      </div>
    </div>
  );
}
