import { useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Info } from 'lucide-react';
import { ARCADE_GAMES, arcadeGameById } from '@/lib/arcade/games';
import { ARCADE_GAME_COMPONENTS } from '@/components/arcade/ArcadeGames';
import { cn } from '@/lib/utils';

/**
 * 互动厅子页面（`/arcade/:game`）。
 *
 * 三台装置各自成页、互不挤占：顶部是「装置切换器」，随时换台而不必退回总览；
 * 未知装置名重定向回总览，避免出现空页面。
 */

export default function ArcadeGamePage() {
  const { game } = useParams<{ game: string }>();
  const navigate = useNavigate();
  const active = arcadeGameById(game);

  useEffect(() => {
    if (!active) navigate('/arcade', { replace: true });
  }, [active, navigate]);

  if (!active) return null;

  const Game = ARCADE_GAME_COMPONENTS[active.id];

  return (
    <div className="min-h-full bg-stage px-4 py-8 text-stage-fg">
      <div className="mx-auto w-full max-w-4xl space-y-6">
        <header className="space-y-3">
          <Link className="inline-flex items-center gap-1.5 text-xs text-stage-muted hover:text-stage-gold" to="/arcade">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            互动厅总览
          </Link>
          <h1 className="font-serif text-3xl">{active.title}</h1>
          <p className="max-w-2xl text-sm leading-relaxed text-stage-muted">
            {active.summary}（{active.rounds}）
          </p>
        </header>

        {/* 装置切换器：三台装置随时互换，不必回到总览 */}
        <nav
          aria-label="切换展教装置"
          className="flex flex-wrap gap-2 rounded-2xl border border-stage-border bg-stage-panel p-2"
        >
          {ARCADE_GAMES.map((item) => (
            <Link
              key={item.id}
              to={'/arcade/' + item.id}
              aria-current={item.id === active.id ? 'page' : undefined}
              className={cn(
                'inline-flex min-h-11 items-center rounded-xl px-4 text-sm transition-colors',
                item.id === active.id
                  ? 'bg-stage-gold/20 font-semibold text-stage-gold ring-1 ring-stage-gold/50'
                  : 'text-stage-fg/80 hover:bg-stage-soft',
              )}
            >
              {item.title}
            </Link>
          ))}
        </nav>

        <Game />

        <p className="flex items-start gap-2 rounded-2xl border border-stage-border bg-stage-panel p-4 text-xs text-stage-muted">
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stage-gold" aria-hidden="true" />
          <span className="leading-relaxed">
            出题红线：题干与选项只取自已核验字段（类别 / 产区 / 940 号公告保护状态）；产区待核验的记录不出题，
            也不作干扰项。每局结束都能点进档案页，顺着来源链回到官方文件。
          </span>
        </p>
      </div>
    </div>
  );
}
