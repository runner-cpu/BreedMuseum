import { Link } from 'react-router-dom';
import { Gamepad2, Info } from 'lucide-react';
import { FindHomeGame, IdentifyGame, QuizGame, silhouetteCoverage } from '@/components/arcade/ArcadeGames';
import { SILHOUETTE_CATEGORIES } from '@/components/arcade/CategorySilhouette';

/**
 * 互动厅（`/arcade`）：三台展教装置。
 *
 * 每台装置玩的都是已核验字段，每局结束都强链档案页；页面底部写明出题红线，
 * 便于评委在无现场答辩时自行判断“游戏化”背后的数据纪律。
 */

export default function ArcadePage() {
  return (
    <div className="min-h-full bg-[#080b09] px-4 py-6 text-museum-paper">
      <div className="mx-auto w-full max-w-6xl space-y-5">
        <header className="space-y-2">
          <p className="flex items-center gap-2 text-xs tracking-[0.2em] text-museum-gold/90">
            <Gamepad2 className="h-4 w-4" aria-hidden="true" />
            INTERACTIVE HALL
          </p>
          <h1 className="font-serif text-2xl">互动厅 · 三台展教装置</h1>
          <p className="max-w-3xl text-sm text-museum-paper/75">
            找家挑战练地理、识图挑战练类别、知识问答练名录常识。所有题目都由馆藏数据自动生成，
            只使用已核验字段；每局结束都能点进档案页核对官方来源。
          </p>
        </header>

        <div className="grid gap-4 lg:grid-cols-3">
          <FindHomeGame />
          <IdentifyGame />
          <QuizGame />
        </div>

        <section
          aria-label="出题红线"
          className="flex flex-wrap items-start gap-2 rounded-xl border border-white/12 bg-[#0b0f0d] p-4 text-xs text-museum-paper/75"
        >
          <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <p className="max-w-4xl leading-relaxed">
            出题红线：题目与选项只来自已核验字段（类别 / 产区 / 940 号公告保护状态），
            产区待核验的记录不出题、也不作干扰项；找家挑战的距离提示基于真实产区坐标计算。
            剪影覆盖 {SILHOUETTE_CATEGORIES.length} 个类别
            （{silhouetteCoverage ? '全部覆盖' : '部分覆盖'}）；照片认品种模式需要已核验授权图片，
            当前本地已核验图片为 0 张，因此在图片池建立前不启用该模式——
            历史上未经核验的外链图片不会被用于游戏。
          </p>
        </section>

        <nav aria-label="相关页面" className="flex flex-wrap gap-3 text-sm">
          <Link className="underline underline-offset-4 hover:text-white" to="/">
            回到光图
          </Link>
          <Link className="underline underline-offset-4 hover:text-white" to="/about">
            数据来源与披露
          </Link>
        </nav>
      </div>
    </div>
  );
}
