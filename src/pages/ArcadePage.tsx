import { Link } from 'react-router-dom';
import { Gamepad2, Info } from 'lucide-react';
import { categories } from '@/data/catalog';
import { SILHOUETTE_CATEGORIES, silhouetteCoverage } from '@/components/arcade/CategorySilhouette';
import { ExhibitCard } from '@/components/home/ExhibitCard';
import { ARCADE_GAMES } from '@/lib/arcade/games';

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
            每局结束都能回到百科详情卡核对馆藏字段。
          </p>
        </header>

        <ul className="grid gap-4 md:grid-cols-3">
          {ARCADE_GAMES.map((game) => (
            <li key={game.id}>
              <ExhibitCard game={game} />
            </li>
          ))}
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
          <Link className="underline underline-offset-4 hover:text-stage-gold" to="/dashboard">
            数据口径与看板
          </Link>
        </nav>
      </div>
    </div>
  );
}
