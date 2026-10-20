import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, GitCompare, Map as MapIcon, MapPinned, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { HomeAtlas } from '@/components/home/HomeAtlas';
import { useSettings } from '@/contexts/AppSettings';
import { COLLECTION_SUMMARY, COLLECTION_VERSION } from '@/data/collectionSummary';
import { HOME_CATEGORY_COUNTS, HOME_FEATURED } from '@/data/homeHighlights';
import { categoryLabel, fill, provinceLabel } from '@/lib/displayLabels';
import '@/styles/light-map-page.css';

const formatNumber = (value: number, language: 'zh' | 'en') =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN').format(value);

/**
 * 首页序厅：五个板块依次回答观众的问题。
 *
 *   1. 看 · 分布：一张真正承载数据的中国地图（省块色阶 + 154 个已核验产区 + 镜头）
 *   2. 有哪些畜种：十四类可点击的类别入口
 *   3. 从哪里进去：地图为主入口，百科 / 看板 / 互动厅 / 对比为次级入口
 *   4. 先看几条具体的：八条带真实馆藏照片的精选记录
 *   5. 凭什么可信：三级核验徽章、两个统计口径、可下载的审计报告
 *
 * 首屏图集读自 `homeAtlas.ts`，类别与精选读自 `homeHighlights.ts`：
 * 两份轻量常量都由测试与运行时馆藏逐项比对，首页不会为了渲染几张卡片
 * 把 660 kB 的完整品种库拉进首屏静态图。
 */
export default function LightMapPage() {
  const navigate = useNavigate();
  const { t, language } = useSettings();

  const entries = [
    { to: '/explore', icon: MapIcon, title: t('home.startMap'), desc: t('home.startMapDesc') },
    { to: '/encyclopedia', icon: BookOpen, title: t('home.startEnc'), desc: t('home.startEncDesc') },
    { to: '/dashboard', icon: BarChart3, title: t('home.startDash'), desc: t('home.startDashDesc') },
    { to: '/arcade', icon: Sparkles, title: t('home.startArcade'), desc: t('home.startArcadeDesc') },
    { to: '/compare', icon: GitCompare, title: t('home.startCompare'), desc: t('home.startCompareDesc') },
  ];

  const maxCategory = Math.max(...HOME_CATEGORY_COUNTS.map((item) => item.count));

  return (
    <div className="museum-home min-h-full text-[var(--museum-fg)]">
      {/* 01 看 · 分布 */}
      <HomeAtlas />

      <div className="museum-home-inner">
        {/* 02 品种类别速览 */}
        <section className="museum-section" aria-labelledby="home-category-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="museum-eyebrow">{t('home.categoryEyebrow')}</p>
              <h2 id="home-category-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">
                {t('home.categoryOverview')}
              </h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[var(--museum-muted)]">
                {t('home.categoryIntro')}
              </p>
            </div>
            <Link to="/encyclopedia" className="museum-link">
              {t('home.viewAll')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>

          <ul className="museum-category-rail" aria-label={t('home.categoryOverview')}>
            {HOME_CATEGORY_COUNTS.map((item) => (
              <li key={item.category}>
                <Link
                  to={`/encyclopedia?category=${encodeURIComponent(item.category)}`}
                  className="museum-panel group flex min-h-24 flex-col justify-between p-3 transition hover:-translate-y-0.5 hover:border-[var(--stage-gold)]"
                >
                  <span className="text-sm font-medium">{categoryLabel(item.category, language)}</span>
                  <span className="mt-1 font-mono text-xs text-[var(--museum-muted)]">
                    {formatNumber(item.count, language)} {t('home.categoryUnit')}
                  </span>
                  <span
                    aria-hidden="true"
                    className="mt-2 block h-1 rounded-full bg-[var(--museum-line)]"
                  >
                    <span
                      className="block h-full rounded-full bg-[var(--stage-gold)]"
                      style={{ width: `${Math.max(12, Math.round((item.count / maxCategory) * 100))}%` }}
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 03 五种进入方式 */}
        <section className="museum-section" aria-labelledby="home-entries-title">
          <div className="mb-6 max-w-2xl">
            <p className="museum-eyebrow">{t('home.entriesEyebrow')}</p>
            <h2 id="home-entries-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">
              {t('home.entriesTitle')}
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[var(--museum-muted)]">
              {t('home.entriesIntro')}
            </p>
          </div>

          <div className="grid gap-3 lg:grid-cols-[1.15fr_.85fr]">
            <Link
              to="/explore"
              className="museum-panel group relative flex min-h-56 flex-col justify-between overflow-hidden p-6 transition hover:border-[var(--stage-gold)]"
            >
              <div className="flex items-start justify-between gap-4">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-[var(--museum-line)] text-[var(--stage-gold)]">
                  <MapPinned className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="font-mono text-[0.65rem] tracking-[0.2em] text-[var(--museum-muted)]">
                  {formatNumber(COLLECTION_SUMMARY.visibleClusters, language)} {t('home.sitesUnit')}
                </span>
              </div>
              <div>
                <h3 className="font-serif text-2xl">{t('home.startMap')}</h3>
                <p className="mt-2 max-w-[46ch] text-sm leading-6 text-[var(--museum-muted)]">
                  {t('home.startMapDesc')}
                </p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--stage-gold)]">
                  {t('home.startExplore')}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </span>
              </div>
            </Link>

            <div className="grid gap-3 sm:grid-cols-2">
              {entries.slice(1).map(({ to, icon: Icon, title, desc }) => (
                <Link
                  key={to}
                  to={to}
                  className="museum-panel group flex flex-col justify-between p-4 transition hover:-translate-y-0.5 hover:border-[var(--stage-gold)]"
                >
                  <Icon className="h-5 w-5 text-[var(--stage-gold)]" aria-hidden="true" />
                  <div className="mt-6">
                    <h3 className="text-sm font-medium">{title}</h3>
                    <p className="mt-1 text-xs leading-5 text-[var(--museum-muted)]">{desc}</p>
                  </div>
                  <ArrowUpRight
                    className="mt-3 h-4 w-4 text-[var(--museum-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 04 精选品种 */}
        <section className="museum-section" aria-labelledby="home-featured-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <p className="museum-eyebrow">{t('home.featuredTitle')}</p>
              <h2 id="home-featured-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">
                {t('home.featuredTitle')}
              </h2>
              <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[var(--museum-muted)]">
                {t('home.featuredIntro')}
              </p>
            </div>
            <button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link">
              {t('home.viewAll')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <ul className="museum-featured-rail" aria-label={t('home.featuredTitle')}>
            {HOME_FEATURED.map((breed) => (
              <li key={breed.id}>
                <Link
                  to={`/encyclopedia?breed=${encodeURIComponent(breed.id)}`}
                  className="museum-featured-card group block overflow-hidden rounded-xl border border-[var(--museum-line)] bg-[var(--museum-panel)] transition hover:-translate-y-1 hover:border-[var(--stage-gold)]"
                >
                  <BreedImage
                    src={breed.image}
                    alt={breed.name}
                    category={breed.category}
                    breedName={breed.name}
                    className="aspect-[4/3] w-full"
                    imgClassName="transition duration-500 group-hover:scale-105"
                    sizes="(min-width: 1024px) 16vw, 50vw"
                  />
                  <div className="p-3">
                    <span className="text-[0.65rem] text-[var(--stage-gold)]">
                      {categoryLabel(breed.category, language)}
                    </span>
                    <h3 className="mt-1 truncate text-sm font-medium">
                      {language === 'en' ? breed.englishName : breed.name}
                    </h3>
                    <p className="mt-1 flex items-center gap-1 truncate text-xs text-[var(--museum-muted)]">
                      <MapIcon className="h-3 w-3" aria-hidden="true" />
                      {provinceLabel(breed.province, language)}
                    </p>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* 05 数据可信：把「诚实」从附录提成首页可见的一段 */}
        <section className="museum-section" aria-labelledby="home-trust-title">
          <div className="grid gap-8 lg:grid-cols-[1fr_1fr]">
            <div>
              <p className="museum-eyebrow">{t('home.atlasEyebrow')}</p>
              <h2 id="home-trust-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">
                {t('home.trustTitle')}
              </h2>
              <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[var(--museum-muted)]">
                {t('home.trustIntro')}
              </p>
              <div className="mt-5">
                <VerificationLegend />
              </div>
              <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                {[
                  {
                    term: t('home.trustTotal'),
                    detail: formatNumber(COLLECTION_SUMMARY.total, language),
                    note: t('home.trustTotalNote'),
                  },
                  {
                    term: t('home.trustVisible'),
                    detail: formatNumber(COLLECTION_SUMMARY.visibleTotal, language),
                    note: t('home.trustVisibleNote'),
                  },
                  {
                    term: t('home.trustPending'),
                    detail: formatNumber(COLLECTION_SUMMARY.unverifiedProvince, language),
                    note: t('home.trustPendingNote'),
                  },
                ].map((item) => (
                  <div key={item.term} className="rounded-xl border border-[var(--museum-line)] p-3">
                    <dt className="text-[0.68rem] text-[var(--museum-muted)]">{item.term}</dt>
                    <dd className="mt-1 font-mono text-xl text-[var(--stage-gold)]">{item.detail}</dd>
                    <p className="mt-1 text-[0.66rem] leading-4 text-[var(--museum-muted)]">{item.note}</p>
                  </div>
                ))}
              </dl>
            </div>

            <dl className="space-y-3">
              {[
                { term: t('home.aboutSource'), detail: t('home.aboutSourceText') },
                { term: t('home.aboutTech'), detail: t('home.aboutTechText') },
                {
                  term: t('home.statUpdateLabel'),
                  detail: `${COLLECTION_VERSION} · ${formatNumber(COLLECTION_SUMMARY.visibleClusters, language)} ${t('home.sitesUnit')}`,
                },
                {
                  term: t('home.trustAudit'),
                  detail: t('home.trustAuditText'),
                },
              ].map((item) => (
                <div key={item.term} className="border-t border-[var(--museum-line)] pt-3">
                  <dt className="text-xs font-medium text-[var(--stage-gold)]">{item.term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-[var(--museum-muted)]">{item.detail}</dd>
                </div>
              ))}
              <div className="flex flex-wrap gap-4 border-t border-[var(--museum-line)] pt-4 text-sm">
                <Link to="/dashboard" className="museum-link">
                  {t('home.atlasScopeLink')}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link to="/arcade" className="museum-link">
                  {t('home.startArcade')}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </div>
            </dl>
          </div>
        </section>

        {/* 06 关于 */}
        <section className="museum-section museum-section--last" aria-labelledby="home-about-title">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <p className="museum-eyebrow">{t('home.aboutEyebrow')}</p>
              <h2 id="home-about-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">
                {t('home.aboutTitle')}
              </h2>
              <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[var(--museum-muted)]">
                {t('home.aboutIntroText')}
              </p>
              <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[var(--museum-muted)]">
                {fill(t('home.statsSummary'), {
                  total: formatNumber(COLLECTION_SUMMARY.total, language),
                  visible: formatNumber(COLLECTION_SUMMARY.visibleTotal, language),
                })}
                {t('home.statsFootnote')}
              </p>
            </div>

            <nav aria-label={t('layout.mainNav')} className="flex flex-col gap-2 text-sm">
              {entries.map(({ to, icon: Icon, title, desc }) => (
                <Link
                  key={to}
                  to={to}
                  className="museum-panel group flex items-start gap-3 p-3 transition hover:border-[var(--stage-gold)]"
                >
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-[var(--stage-gold)]" aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium text-[var(--museum-fg)]">{title}</span>
                    <span className="mt-0.5 block text-xs leading-5 text-[var(--museum-muted)]">{desc}</span>
                  </span>
                  <ArrowUpRight
                    className="ml-auto mt-1 h-4 w-4 shrink-0 text-[var(--museum-muted)] transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </Link>
              ))}
            </nav>
          </div>
        </section>
      </div>
    </div>
  );
}
