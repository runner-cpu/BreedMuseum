import { ArrowRight, Gamepad2, MapPinned, ScanEye, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ArcadeGame } from '@/lib/arcade/games';
import { CategorySilhouette } from '@/components/arcade/CategorySilhouette';
import { cn } from '@/lib/utils';

const GAME_ICON = {
  'find-home': MapPinned,
  identify: ScanEye,
  quiz: Trophy,
} as const;

const GAME_CATEGORIES = {
  'find-home': ['牛', '羊', '马'],
  identify: ['鸡', '鸭', '鹅'],
  quiz: ['猪', '骆驼', '蜂'],
} as const;

interface ExhibitCardProps {
  game: ArcadeGame;
  className?: string;
  compact?: boolean;
}

/** 首页与互动厅总览共用的装置卡。 */
export function ExhibitCard({ game, className, compact = false }: ExhibitCardProps) {
  const Icon = GAME_ICON[game.id] ?? Gamepad2;
  const categories = GAME_CATEGORIES[game.id] ?? ['其他'];

  return (
    <Link
      to={`/arcade/${game.id}`}
      className={cn(
        'group relative flex h-full min-h-[18rem] flex-col overflow-hidden rounded-2xl border border-stage-border bg-stage-panel p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-stage-gold/65 hover:shadow-lg focus-visible:-translate-y-1',
        compact && 'min-h-[15rem] p-4',
        className,
      )}
    >
      <span className="pointer-events-none absolute -right-6 -top-8 h-32 w-32 rounded-full bg-stage-gold/10 blur-2xl transition-transform duration-500 group-hover:scale-150" aria-hidden="true" />
      <div className="relative flex items-start justify-between gap-3">
        <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-stage-gold/15 text-stage-gold ring-1 ring-stage-gold/20">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="rounded-full border border-stage-border px-2.5 py-1 text-[11px] text-stage-muted">{game.rounds}</span>
      </div>

      <div className="relative mt-3 flex h-20 items-center gap-1 overflow-hidden rounded-xl border border-stage-border/70 bg-stage px-3">
        {categories.map((category, index) => (
          <CategorySilhouette
            key={category}
            category={category}
            label={`${game.title}：${category}`}
            className={cn(
              'h-[4.4rem] w-[4.4rem] shrink-0 text-stage-gold/80 transition-transform duration-300 group-hover:-translate-y-1',
              index === 1 && 'text-stage-fg/65',
              index === 2 && 'text-stage-gold/50',
            )}
          />
        ))}
        <span className="ml-auto self-end pb-2 text-[10px] uppercase tracking-[0.2em] text-stage-muted/80">play</span>
      </div>

      <div className="relative mt-4 space-y-2">
        <p className="text-xs font-medium tracking-[0.12em] text-stage-gold">{game.skill}</p>
        <h3 className="font-serif text-xl text-stage-fg">{game.title}</h3>
        <p className="text-sm leading-relaxed text-stage-muted">{game.summary}</p>
      </div>

      <span className="relative mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-stage-gold">
        进场
        <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
      </span>
    </Link>
  );
}

