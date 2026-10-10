import { Link } from 'react-router-dom';
import { ArrowRight, Gamepad2, Info, MapPinned, ScanEye, Trophy } from 'lucide-react';
import { categories } from '@/data/catalog';
import { SILHOUETTE_CATEGORIES, silhouetteCoverage } from '@/components/arcade/CategorySilhouette';
import { ARCADE_GAMES } from '@/lib/arcade/games';

/**
 * 互动厅（`/arcade`）：装置总览。
 *
 * 三台装置各自是一个独立子页面（`/arcade/:game`）——同一时间只玩一台，
 * 页面给足空间、题面不再挤在一起；总览页负责介绍、讲清玩法与红线，再让人自选进场。
 */

const ICONS = {
  findHome: MapPinned,
  identify: ScanEye,
  quiz: Trophy,
} as const;

export default function ArcadePage() {
  return (
    <div className="min-h-full bg-stage px-4 py-8 text-stage-fg">
      <div className="mx-auto w-full max-w-5xl space-y-8">
        <header className="space-y-3">
          <p className="flex items-center gap-2 text-xs tracking-[0.2em] text-stage-gold">
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            INTERACTIVE HALL
          </p>
          <h1 className="font-serif text-3xl">互动厅 · 三台展教装置</h1>
          <p className="max-w-3xl text-sm leading-relaxed text-stage-muted">
            找家挑战练地理、识图挑战练类别、知识问答练名录常识。三台装置分开进场，
            一次只玩一台——所有题目都由馆藏数据自动生成，只使用已核验字段，
            每局结束都能点进档案页核对官方来源。
          </p>
        </header>

        <ul className="grid gap-4 md:grid-cols-3">
          {ARCADE_GAMES.map((game) => {
            const Icon = ICONS[game.id as keyof typeof ICONS] ?? Gamepad2;
            return (
              <li key={game.id}>
                <Link
                  to={'/arcade/' + game.id}
                  className="flex h-full flex-col gap-3 rounded-2xl border border-stage-border bg-stage-panel p-5 transition-colors hover:border-stage-gold/60 hover:bg-stage-soft"
                >
                  <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-stage-gold/15 text-stage-gold">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="font-serif text-xl">{game.title}</span>
                  <span className="text-xs text-stage-muted">{game.rounds} · {game.skill}</span>
                  <span className="text-sm leading-relaxed text-stage-fg/85">{game.summary}</span>
                  <span className="mt-auto inline-flex items-center gap-1.5 pt-2 text-sm font-medium text-stage-gold">
                    进场
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>

        <section
          aria-label="出题红线"
          className="flex flex-wrap items-start gap-2 rounded-2xl border border-stage-border bg-stage-panel p-4 text-xs text-stage-muted"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stage-gold" aria-hidden="true" />
          <p className="max-w-4xl leading-relaxed">
            出题红线：题目与选项只来自已核验字段（类别 / 产区 / 940 号公告保护状态），
            产区待核验的记录不出题、也不作干扰项；找家挑战的距离提示基于真实产区坐标计算。
            剪影覆盖 {SILHOUETTE_CATEGORIES.length} 个类别
            （{silhouetteCoverage(categories) ? '全部覆盖' : '部分覆盖'}）；照片认品种模式需要已核验授权图片，
            当前本地已核验图片为 0 张，因此在图片池建立前不启用该模式——
            历史上未经核验的外链图片不会被用于游戏。
          </p>
        </section>

        <nav aria-label="相关页面" className="flex flex-wrap gap-4 text-sm">
          <Link className="underline underline-offset-4 hover:text-stage-gold" to="/">
            回到光图
          </Link>
          <Link className="underline underline-offset-4 hover:text-stage-gold" to="/about">
            数据来源与披露
          </Link>
        </nav>
      </div>
    </div>
  );
}
