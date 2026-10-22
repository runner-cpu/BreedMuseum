import { ArrowRight, Gamepad2, MapPinned, ScanEye, Trophy } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ArcadeGame } from '@/lib/arcade/games';
import { GamePreview } from '@/components/arcade/GamePreview';
import { useSettings } from '@/contexts/AppSettings';
import { cn } from '@/lib/utils';

const GAME_ICON = {
  'find-home': MapPinned,
  identify: ScanEye,
  quiz: Trophy,
} as const;

interface ExhibitCardProps {
  game: ArcadeGame;
  className?: string;
  compact?: boolean;
}

/**
 * 首页与互动厅总览共用的装置卡。
 *
 * 2026-10 重做：封面从"一条 80px 高的剪影带"改成 16:10 的整幅预览图，
 * 三台装置各画各的界面（地图 / 照片取景 / 选项），卡片高度随之拉开，
 * 在宽屏上不再是一条窄条浮在大量留白里。
 */
export function ExhibitCard({ game, className, compact = false }: ExhibitCardProps) {
  const { t, language } = useSettings();
  const Icon = GAME_ICON[game.id] ?? Gamepad2;

  return (
    <Link
      to={`/arcade/${game.id}`}
      className={cn(
        'group relative flex h-full flex-col overflow-hidden rounded-2xl border border-stage-border bg-stage-panel shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-stage-gold/65 hover:shadow-xl focus-visible:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold',
        className,
      )}
    >
      {/* 封面：整幅 16:10 预览，不再压在卡片内部的小横条里 */}
      <div className="relative aspect-[16/10] w-full overflow-hidden border-b border-stage-border/70">
        <GamePreview gameId={game.id} />
        <span className="pointer-events-none absolute right-3 top-3 rounded-full border border-white/20 bg-[#0a0a1a]/55 px-2.5 py-1 text-[11px] font-medium text-[#f5f0e8] backdrop-blur">
          {t(game.roundsKey)}
        </span>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-[linear-gradient(180deg,transparent,rgb(10_10_26/0.38))]" />
      </div>

      <div className={cn('flex flex-1 flex-col px-5 pb-5 pt-4', compact && 'px-4 pb-4 pt-3')}>
        <div className="flex items-center gap-2">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-stage-gold/15 text-stage-gold ring-1 ring-stage-gold/25">
            <Icon className="h-4 w-4" aria-hidden="true" />
          </span>
          <p className="text-[11px] font-medium tracking-[0.14em] text-stage-gold">{t(game.skillKey)}</p>
        </div>

        <h3 className="mt-2.5 font-serif text-2xl text-stage-fg">{t(game.titleKey)}</h3>
        <p className="mt-1.5 text-sm leading-relaxed text-stage-muted">{t(game.summaryKey)}</p>

        <span className="mt-auto inline-flex items-center gap-1.5 pt-5 text-sm font-semibold text-stage-gold">
          {t('arcade.enter')}
          <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
      <span className="sr-only">{language}</span>
    </Link>
  );
}
