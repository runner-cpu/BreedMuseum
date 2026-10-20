import { ArrowRight, ArrowUpRight, BarChart3, BookOpen, GitCompare, Map as MapIcon, MapPinned, Search, Sparkles } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { useSettings } from '@/contexts/AppSettings';
import { COLLECTION_SUMMARY, COLLECTION_VERSION } from '@/data/collectionSummary';
import { HOME_CATEGORY_COUNTS, HOME_FEATURED } from '@/data/homeHighlights';
import { categoryLabel, fill, provinceLabel } from '@/lib/displayLabels';
import '@/styles/light-map-page.css';

const formatNumber = (value: number, language: 'zh' | 'en') =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN').format(value);

/**
 * 首页序厅：一张地图开场，之后依次回答四个问题。
 *
 *   1. 这座馆有多少东西（核心数据）
 *   2. 有哪些畜种（类别速览）
 *   3. 我可以从哪进去（五种入口）
 *   4. 先看几条具体的（精选品种）
 *
 * 所有数字读自 `COLLECTION_SUMMARY` 与 `homeHighlights`：前者是审计过的小常量，
 * 后者是首屏专用的轻量摘要（类别计数 + 8 条精选记录），避免首页为了渲染
 * 几行卡片而把 660 kB 的完整品种库拉进首屏静态图。两份数据都由测试与运行时比对。
 */
export default function LightMapPage() {
  const navigate = useNavigate();
  const { t, language } = useSettings();
  const openSearch = (value: string) =>
    navigate(value.trim() ? `/encyclopedia?search=${encodeURIComponent(value.trim())}` : '/encyclopedia');

  const stats = [
    {
      label: t('home.statTotalLabel'),
      value: COLLECTION_SUMMARY.total,
      note: t('home.statTotalSub'),
      tone: 'text-stage-fg',
    },
    {
      label: t('home.statVisibleLabel'),
      value: COLLECTION_SUMMARY.visibleTotal,
      note: t('home.statVisibleSub'),
      tone: 'text-stage-gold',
    },
    {
      label: t('home.statProvincesLabel'),
      value: COLLECTION_SUMMARY.visibleProvinces,
      note: t('home.statProvincesSub'),
      tone: 'text-stage-fg',
    },
    {
      label: t('home.statCategoriesLabel'),
      value: COLLECTION_SUMMARY.visibleCategories,
      note: t('home.statCategoriesSub'),
      tone: 'text-stage-fg',
    },
  ];

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
      <SpotlightHero
        titleTop={t('home.heroTitleTop')}
        titleBottom={t('home.heroTitleBottom')}
        badge={t('home.heroBadge')}
        cta={t('home.startExplore')}
        searchPh={t('home.heroSearchPh')}
        searchBtn={t('home.searchCta')}
        descLeft={t('home.heroDescLeft')}
        descRight={t('home.heroDescRight')}
        onExplore={() => navigate('/explore')}
        onSearch={openSearch}
      />

      <div className="museum-home-inner">
        {/* 01 核心数据：四个数字，先交代馆藏规模与可浏览比例 */}
        <section className="museum-section" aria-labelledby="home-stats-title">
          <div className="mb-6 max-w-2xl">
            <h2 id="home-stats-title" className="font-serif text-2xl tracking-tight sm:text-3xl">
              {t('home.statsTitle')}
            </h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[var(--museum-muted)]">
              {t('home.statsIntro')}
            </p>
          </div>

          <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((item) => (
              <div key={item.label} className="museum-panel min-h-32 p-4 sm:min-h-36 sm:p-5">
                <dt className="text-xs text-[var(--museum-muted)]">{item.label}</dt>
                <dd className={`mt-2 font-mono text-3xl font-semibold tabular-nums sm:text-4xl ${item.tone}`}>
                  {formatNumber(item.value, language)}
                </dd>
                <p className="mt-2 text-[0.68rem] leading-5 text-[var(--museum-muted)]">{item.note}</p>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs leading-6 text-[var(--museum-muted)]">
            {fill(t('home.statsSummary'), {
              total: formatNumber(COLLECTION_SUMMARY.total, language),
              visible: formatNumber(COLLECTION_SUMMARY.visibleTotal, language),
            })}
            {t('home.statsFootnote')}
          </p>
        </section>

        {/* 02 类别速览：把“有哪些畜种”变成可点击的入口，而不是一排标签 */}
        <section className="museum-section" aria-labelledby="home-category-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 id="home-category-title" className="font-serif text-2xl tracking-tight sm:text-3xl">
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

        {/* 03 五种入口：不是三张同构卡片，而是一条主入口 + 四条次级入口 */}
        <section className="museum-section" aria-labelledby="home-entries-title">
          <div className="mb-6 max-w-2xl">
            <h2 id="home-entries-title" className="font-serif text-2xl tracking-tight sm:text-3xl">
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
                  154 {t('home.sitesUnit')}
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

        {/* 04 精选品种：真实带图记录，点开直接进百科详情 */}
        <section className="museum-section" aria-labelledby="home-featured-title">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
            <div className="max-w-2xl">
              <h2 id="home-featured-title" className="font-serif text-2xl tracking-tight sm:text-3xl">
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

        {/* 05 关于：数据来源、技术口径与纠错入口 */}
        <section className="museum-section museum-section--last" aria-labelledby="home-about-title">
          <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <h2 id="home-about-title" className="font-serif text-2xl tracking-tight sm:text-3xl">
                {t('home.aboutTitle')}
              </h2>
              <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[var(--museum-muted)]">
                {t('home.aboutIntroText')}
              </p>
              <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[var(--museum-muted)]">
                {t('home.aboutContactText')}
              </p>
            </div>

            <dl className="space-y-3">
              {[
                { term: t('home.aboutSource'), detail: t('home.aboutSourceText') },
                { term: t('home.aboutTech'), detail: t('home.aboutTechText') },
                {
                  term: t('home.statUpdateLabel'),
                  detail: `${COLLECTION_VERSION} · ${formatNumber(COLLECTION_SUMMARY.visibleClusters, language)} ${t('home.sitesUnit')}`,
                },
              ].map((item) => (
                <div key={item.term} className="border-t border-[var(--museum-line)] pt-3">
                  <dt className="text-xs font-medium text-[var(--stage-gold)]">{item.term}</dt>
                  <dd className="mt-1 text-sm leading-6 text-[var(--museum-muted)]">{item.detail}</dd>
                </div>
              ))}
            </dl>
          </div>

          <nav aria-label={t('layout.mainNav')} className="mt-8 flex flex-wrap gap-x-5 gap-y-2 border-t border-[var(--museum-line)] pt-6 text-sm">
            <Link to="/explore" className="museum-link">
              <Search className="h-4 w-4" aria-hidden="true" />
              {t('home.startMap')}
            </Link>
            <Link to="/encyclopedia" className="museum-link">
              <BookOpen className="h-4 w-4" aria-hidden="true" />
              {t('home.startEnc')}
            </Link>
            <Link to="/dashboard" className="museum-link">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
              {t('home.startDash')}
            </Link>
            <Link to="/compare" className="museum-link">
              <GitCompare className="h-4 w-4" aria-hidden="true" />
              {t('home.startCompare')}
            </Link>
          </nav>
        </section>
      </div>
    </div>
  );
}
