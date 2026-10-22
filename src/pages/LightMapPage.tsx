import { ArrowRight, BarChart3, BookOpen, GitCompare, Map as MapIcon, Search, Sparkles } from 'lucide-react';
import { useCallback } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import CircularGallery from '@/components/effects/CircularGallery';
import ChromaGrid from '@/components/effects/ChromaGrid';
import Galaxy from '@/components/effects/Galaxy';
import MagicBento, { type BentoCard } from '@/components/effects/MagicBento';
import ScrollFloat from '@/components/effects/ScrollFloat';
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
 * 视觉层：整页固定在黑色夜空中（`Galaxy` WebGL 星场），浅色/深色主题
 * 只影响顶栏与子页面，首页始终保持同一块暗场——粒子的对比度、
 * 卡片的玻璃层明度因此不需要跟随主题重算。标题统一由 `ScrollFloat`
 * 逐字浮现，五种入口用 `MagicBento`，核心数字用 `ChromaGrid`，
 * 精选品种用可拖拽的 `CircularGallery`。
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
      color: '#8FC7AC',
    },
    {
      label: t('home.statVisibleLabel'),
      value: COLLECTION_SUMMARY.visibleTotal,
      note: t('home.statVisibleSub'),
      color: '#D8B26A',
    },
    {
      label: t('home.statProvincesLabel'),
      value: COLLECTION_SUMMARY.visibleProvinces,
      note: t('home.statProvincesSub'),
      color: '#7AB6C6',
    },
    {
      label: t('home.statCategoriesLabel'),
      value: COLLECTION_SUMMARY.visibleCategories,
      note: t('home.statCategoriesSub'),
      color: '#F0A184',
    },
  ];

  const entries = [
    { to: '/explore', icon: MapIcon, title: t('home.startMap'), desc: t('home.startMapDesc') },
    { to: '/encyclopedia', icon: BookOpen, title: t('home.startEnc'), desc: t('home.startEncDesc') },
    { to: '/dashboard', icon: BarChart3, title: t('home.startDash'), desc: t('home.startDashDesc') },
    { to: '/arcade', icon: Sparkles, title: t('home.startArcade'), desc: t('home.startArcadeDesc') },
    { to: '/compare', icon: GitCompare, title: t('home.startCompare'), desc: t('home.startCompareDesc') },
  ];

  const bentoCards: BentoCard[] = entries.map((entry, index) => ({
    icon: <entry.icon className="h-5 w-5" aria-hidden="true" />,
    title: entry.title,
    description: entry.desc,
    to: entry.to,
    label: `0${index + 1} / ENTRANCE`,
    meta:
      index === 0
        ? `${formatNumber(COLLECTION_SUMMARY.visibleClusters, language)} ${t('home.sitesUnit')}`
        : undefined,
    feature: index === 0,
  }));

  const chromaItems = stats.map((stat) => ({
    title: String(stat.value),
    subtitle: stat.label,
    handle: stat.note,
    borderColor: stat.color,
    gradient: 'linear-gradient(150deg, rgba(255,255,255,.09), rgba(8,16,13,.62) 62%)',
    countUp: true,
    format: (value: number) => formatNumber(value, language),
  }));

  const galleryItems = HOME_FEATURED.map((breed) => ({
    image: breed.image,
    alt: breed.name,
    text: language === 'en' ? breed.englishName : breed.name,
    sub: `${categoryLabel(breed.category, language)} · ${provinceLabel(breed.province, language)}`,
    meta: categoryLabel(breed.category, language),
    color: '#173B2C',
  }));

  const openBreed = useCallback(
    (index: number) => {
      const breed = HOME_FEATURED[index];
      if (breed) navigate(`/encyclopedia?breed=${encodeURIComponent(breed.id)}`);
    },
    [navigate],
  );

  const maxCategory = Math.max(...HOME_CATEGORY_COUNTS.map((item) => item.count));

  return (
    <div className="relative isolate min-h-full overflow-hidden bg-[#050A08] text-[#EDF2EC]">
      {/* 固定夜空：首页在任何主题下都是同一块黑场 */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-0">
        <Galaxy
          density={1.75}
          speed={1.45}
          starSpeed={0.85}
          hueShift={140}
          glowIntensity={0.4}
          twinkleIntensity={0.5}
          rotationSpeed={0.14}
        />
        <div className="absolute inset-0 home-night-vignette" />
      </div>

      <div className="relative z-10">
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

        <div className="relative mx-auto w-full max-w-[1440px] px-4 pb-20 sm:px-7 lg:px-10">
          {/* 01 核心数据：色光卡片，数字滚动入场 */}
          <section className="border-t border-white/[0.1] py-16 sm:py-20" aria-labelledby="home-stats-title">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#8FC7AC]">01 / COLLECTION</p>
                <ScrollFloat
                  id="home-stats-title"
                  as="h2"
                  containerClassName="font-serif text-2xl font-semibold tracking-tight text-[#F4F7F1] sm:text-3xl"
                  stagger={0.026}
                >
                  {t('home.statsTitle')}
                </ScrollFloat>
                <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[#B9C8BD]">{t('home.statsIntro')}</p>
              </div>
              <span className="rounded-full border border-white/[0.15] bg-white/[0.05] px-3 py-1.5 font-mono text-[0.62rem] tracking-[0.16em] text-[#A9B8AC]">
                {COLLECTION_VERSION}
              </span>
            </div>

            <ChromaGrid items={chromaItems} columns={4} />

            <p className="mt-4 text-xs leading-6 text-[#93A398]">
              {fill(t('home.statsSummary'), {
                total: formatNumber(COLLECTION_SUMMARY.total, language),
                visible: formatNumber(COLLECTION_SUMMARY.visibleTotal, language),
              })}
              {t('home.statsFootnote')}
            </p>
          </section>

          {/* 02 类别速览：把“有哪些畜种”变成可点击的入口，而不是一排标签 */}
          <section className="border-t border-white/[0.1] py-16 sm:py-20" aria-labelledby="home-category-title">
            <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#8FC7AC]">02 / TAXONOMY</p>
                <ScrollFloat
                  id="home-category-title"
                  as="h2"
                  containerClassName="font-serif text-2xl font-semibold tracking-tight text-[#F4F7F1] sm:text-3xl"
                  stagger={0.026}
                >
                  {t('home.categoryOverview')}
                </ScrollFloat>
                <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[#B9C8BD]">{t('home.categoryIntro')}</p>
              </div>
              <Link
                to="/encyclopedia"
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#E4C384] transition-colors hover:text-[#F6E2B8]"
              >
                {t('home.viewAll')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>

            <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-7" aria-label={t('home.categoryOverview')}>
              {HOME_CATEGORY_COUNTS.map((item) => (
                <li key={item.category}>
                  <Link
                    to={`/encyclopedia?category=${encodeURIComponent(item.category)}`}
                    className="group flex h-full min-h-[6.5rem] flex-col justify-between rounded-xl border border-white/[0.1] bg-white/[0.035] p-3 transition duration-300 hover:-translate-y-0.5 hover:border-[#D8B26A]/55 hover:bg-white/[0.07]"
                  >
                    <span className="text-sm font-medium text-[#EDF2EC]">{categoryLabel(item.category, language)}</span>
                    <span className="mt-1 font-mono text-[0.66rem] text-[#9FAFA5]">
                      {formatNumber(item.count, language)} {t('home.categoryUnit')}
                    </span>
                    <span aria-hidden="true" className="mt-2 block h-1 rounded-full bg-white/[0.1]">
                      <span
                        className="block h-full rounded-full bg-[#D8B26A]"
                        style={{ width: `${Math.max(10, Math.round((item.count / maxCategory) * 100))}%` }}
                      />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          {/* 03 五种入口：MagicBento 便当盒，主入口占两格 */}
          <section className="border-t border-white/[0.1] py-16 sm:py-20" aria-labelledby="home-entries-title">
            <div className="mb-7 max-w-2xl">
              <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#8FC7AC]">03 / ENTRANCES</p>
              <ScrollFloat
                id="home-entries-title"
                as="h2"
                containerClassName="font-serif text-2xl font-semibold tracking-tight text-[#F4F7F1] sm:text-3xl"
                stagger={0.026}
              >
                {t('home.entriesTitle')}
              </ScrollFloat>
              <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[#B9C8BD]">{t('home.entriesIntro')}</p>
            </div>

            <MagicBento cards={bentoCards} tone="dark" onNavigate={navigate} />
          </section>

          {/* 04 精选品种：弧形画廊，拖拽或自动缓慢旋转 */}
          <section className="border-t border-white/[0.1] py-16 sm:py-20" aria-labelledby="home-featured-title">
            <div className="mb-2 flex flex-wrap items-end justify-between gap-4">
              <div className="max-w-2xl">
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#8FC7AC]">04 / HIGHLIGHTS</p>
                <ScrollFloat
                  id="home-featured-title"
                  as="h2"
                  containerClassName="font-serif text-2xl font-semibold tracking-tight text-[#F4F7F1] sm:text-3xl"
                  stagger={0.026}
                >
                  {t('home.featuredTitle')}
                </ScrollFloat>
                <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[#B9C8BD]">{t('home.featuredIntro')}</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/encyclopedia')}
                className="inline-flex min-h-10 items-center gap-1.5 text-sm font-semibold text-[#E4C384] transition-colors hover:text-[#F6E2B8]"
              >
                {t('home.viewAll')}
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            <CircularGallery items={galleryItems} onSelect={openBreed} autoSpeed={8} className="mt-4" />

            <div className="mt-2 flex flex-wrap items-center gap-x-5 gap-y-2 text-[0.7rem] text-[#8FA096]">
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#D8B26A]" />
                {language === 'en'
                  ? 'Drag horizontally · click a card to open the record'
                  : '横向拖拽浏览 · 点击卡片打开馆藏记录'}
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span aria-hidden="true" className="h-1 w-1 rounded-full bg-[#8FC7AC]" />
                {formatNumber(HOME_FEATURED.length, language)} {language === 'en' ? 'featured records' : '条精选记录'}
              </span>
            </div>
          </section>

          {/* 05 关于：数据来源、技术口径与纠错入口 */}
          <section className="border-t border-white/[0.1] pt-16 sm:pt-20" aria-labelledby="home-about-title">
            <div className="grid gap-8 lg:grid-cols-[1.1fr_.9fr]">
              <div>
                <p className="mb-2 font-mono text-[0.62rem] uppercase tracking-[0.24em] text-[#8FC7AC]">05 / ABOUT</p>
                <ScrollFloat
                  id="home-about-title"
                  as="h2"
                  containerClassName="font-serif text-2xl font-semibold tracking-tight text-[#F4F7F1] sm:text-3xl"
                  stagger={0.026}
                >
                  {t('home.aboutTitle')}
                </ScrollFloat>
                <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[#B9C8BD]">{t('home.aboutIntroText')}</p>
                <p className="mt-3 max-w-[64ch] text-sm leading-7 text-[#B9C8BD]">{t('home.aboutContactText')}</p>
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
                  <div
                    key={item.term}
                    className="rounded-xl border border-white/[0.1] bg-white/[0.035] p-4 transition-colors hover:border-[#D8B26A]/40"
                  >
                    <dt className="text-xs font-medium text-[#E4C384]">{item.term}</dt>
                    <dd className="mt-1 text-sm leading-6 text-[#B9C8BD]">{item.detail}</dd>
                  </div>
                ))}
              </dl>
            </div>

            <nav
              aria-label={t('layout.mainNav')}
              className="mt-10 flex flex-wrap gap-x-5 gap-y-2 border-t border-white/[0.1] pt-6 text-sm"
            >
              {[
                { to: '/explore', icon: Search, label: t('home.startMap') },
                { to: '/encyclopedia', icon: BookOpen, label: t('home.startEnc') },
                { to: '/dashboard', icon: BarChart3, label: t('home.startDash') },
                { to: '/compare', icon: GitCompare, label: t('home.startCompare') },
              ].map(({ to, icon: Icon, label }) => (
                <Link
                  key={to}
                  to={to}
                  className="inline-flex min-h-10 items-center gap-1.5 text-[#E4C384] transition-colors hover:text-[#F6E2B8]"
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {label}
                </Link>
              ))}
            </nav>
          </section>
        </div>
      </div>
    </div>
  );
}
