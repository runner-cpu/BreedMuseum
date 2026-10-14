import { ArrowRight, BarChart3, BookOpen, Map, Sparkles } from 'lucide-react';
import { motion, useReducedMotion } from 'motion/react';
import { type ReactNode, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY, COLLECTION_VERSION } from '@/data/collectionSummary';
import { buildDigest } from '@/lib/geo/lightMapData';
import '@/styles/light-map-page.css';

const tourStops = [
  { icon: Map, number: '01', title: '地图探索', text: '从一张中国地图开始，沿着产区圆点找到地方品种。', to: '/explore', action: '打开地图' },
  { icon: BookOpen, number: '02', title: '品种百科', text: '搜索名称、类别和产区，在卡片墙里快速定位一条记录。', to: '/encyclopedia', action: '查找品种' },
  { icon: BarChart3, number: '03', title: '数据看板', text: '用图表看见类别结构、区域密度和保护名录匹配。', to: '/dashboard', action: '查看数据' },
] as const;

function Reveal({ children, className = '', delay = 0 }: { children: ReactNode; className?: string; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduceMotion ? undefined : { opacity: 0, y: 28 }}
      whileInView={reduceMotion ? undefined : { opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.18 }}
      transition={{ duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] }}
    >
      {children}
    </motion.div>
  );
}

export default function LightMapPage() {
  const navigate = useNavigate();
  const digest = useMemo(() => buildDigest(), []);
  const categoryTally = useMemo(
    () => categories
      .map((category) => ({ category, count: digest.byCategory.get(category) ?? 0 }))
      .filter((item) => item.count > 0)
      .sort((a, b) => b.count - a.count),
    [digest],
  );
  const featured = useMemo(() => breeds.filter((breed) => breed.name).slice(0, 6), []);
  const kpis = [
    { value: COLLECTION_SUMMARY.total, label: '收录品种', note: '名录归一化记录', to: '/encyclopedia' },
    { value: COLLECTION_SUMMARY.provinces, label: '覆盖省份', note: '已核验省级行政区', to: '/explore' },
    { value: COLLECTION_SUMMARY.categories, label: '畜禽类别', note: '按名录分组', to: '/dashboard' },
    { value: COLLECTION_SUMMARY.nationalProtectedMatches, label: '保护匹配', note: '940 号公告匹配', to: '/dashboard' },
  ];

  return (
    <div className="museum-home min-h-full text-[var(--museum-fg)]">
      <SpotlightHero
        titleTop="中国地方畜禽"
        titleBottom="品种数字博物馆"
        badge="守护中华农业文明基因"
        cta="开始探索"
        searchPh="搜索品种名称，如 河田鸡、秦川牛……"
        searchBtn="搜索百科"
        descLeft="一座以土地为展柜的数字博物馆，收录地方畜禽品种的名称、产区与故事。"
        descRight="从地图、百科或数据开始，找到你关心的那一份记录。"
        onExplore={() => navigate('/explore')}
        onSearch={(value) => navigate(value.trim() ? `/encyclopedia?search=${encodeURIComponent(value.trim())}` : '/encyclopedia')}
      />

      <div className="museum-home-inner">
        <section className="museum-section museum-tour-section" aria-labelledby="features-title">
          <Reveal className="museum-tour-intro">
            <p className="museum-eyebrow">THE VISIT ROUTE</p>
            <h2 id="features-title" className="mt-3 max-w-[12ch] font-serif text-3xl tracking-tight sm:text-5xl">选择一种进入方式</h2>
            <p className="mt-4 max-w-[38rem] text-sm leading-7 text-[var(--museum-muted)]">三条入口共享同一套可追溯馆藏。先看土地，再看记录，最后用数据把全馆连起来。</p>
            <div className="museum-tour-signal mt-8" aria-label="馆藏实时状态">
              <span className="museum-signal-dot" aria-hidden="true" />
              <span className="font-mono text-[0.65rem] uppercase tracking-[0.18em] text-[var(--museum-muted)]">LIVE COLLECTION</span>
              <strong>{COLLECTION_SUMMARY.total.toLocaleString('zh-CN')} 条记录已在本地待命</strong>
            </div>
          </Reveal>

          <div className="museum-tour-rail" aria-label="参观入口">
            {tourStops.map(({ icon: Icon, number, title, text, to, action }, index) => (
              <Reveal key={title} delay={index * 0.08}>
                <motion.button
                  type="button"
                  onClick={() => navigate(to)}
                  whileHover={{ x: 8 }}
                  whileTap={{ scale: 0.985 }}
                  className="museum-tour-item group w-full text-left"
                >
                  <span className="museum-tour-index">{number}</span>
                  <span className="museum-tour-copy">
                    <span className="flex items-center gap-3">
                      <span className="museum-tour-icon" aria-hidden="true"><Icon className="h-5 w-5" /></span>
                      <span className="font-serif text-2xl">{title}</span>
                    </span>
                    <span className="mt-3 block max-w-[34rem] text-sm leading-6 text-[var(--museum-muted)]">{text}</span>
                    <span className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-[#d4a853]">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
                  </span>
                </motion.button>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="museum-section museum-feature-section" aria-labelledby="featured-title">
          <Reveal className="museum-section-heading">
            <div>
              <p className="museum-eyebrow">SELECTED RECORDS</p>
              <h2 id="featured-title" className="mt-3 font-serif text-3xl tracking-tight sm:text-5xl">从一张品种卡开始</h2>
            </div>
            <button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link">查看全部 <ArrowRight className="h-4 w-4" /></button>
          </Reveal>
          <div className="museum-featured-rail" aria-label="精选品种">
            {featured.map((breed, index) => (
              <Reveal key={breed.id} delay={index * 0.05}>
                <motion.button
                  type="button"
                  onClick={() => navigate(`/encyclopedia?breed=${encodeURIComponent(breed.id)}`)}
                  whileHover={{ y: -8 }}
                  whileTap={{ scale: 0.985 }}
                  className="museum-featured-card group overflow-hidden rounded-xl border border-[var(--museum-line)] bg-[var(--museum-panel)] text-left"
                >
                  <BreedImage src={breed.image} alt={`${breed.name}图片`} category={breed.category} breedName={breed.name} className="aspect-[4/3]" imgClassName="transition duration-700 group-hover:scale-105" sizes="(min-width: 1024px) 16vw, 50vw" />
                  <div className="p-3"><span className="text-[10px] text-[#d4a853]">{breed.category}</span><h3 className="mt-1 truncate text-sm font-medium">{breed.name}</h3><p className="mt-1 truncate text-xs text-[var(--museum-muted)]">{breed.province}</p></div>
                </motion.button>
              </Reveal>
            ))}
          </div>
        </section>

        <section className="museum-section museum-overview-section" aria-labelledby="overview-title">
          <Reveal className="museum-section-heading">
            <div>
              <p className="museum-eyebrow">COLLECTION · {COLLECTION_VERSION}</p>
              <h2 id="overview-title" className="mt-3 font-serif text-3xl tracking-tight sm:text-5xl">四个数字，认识这座馆</h2>
            </div>
            <span className="hidden max-w-[15rem] text-right text-xs leading-5 text-[var(--museum-muted)] sm:block">所有统计在浏览器本地计算，来源与核验状态随记录保留。</span>
          </Reveal>
          <div className="museum-overview-grid">
            <Reveal className="museum-overview-lead museum-panel">
              <Sparkles className="h-5 w-5 text-[#d4a853]" aria-hidden="true" />
              <span className="mt-8 block font-mono text-6xl tracking-[-0.08em] text-[var(--museum-fg)] sm:text-8xl">{COLLECTION_SUMMARY.total.toLocaleString('zh-CN')}</span>
              <span className="mt-3 block text-sm font-semibold">条馆藏记录</span>
              <p className="mt-2 max-w-[24rem] text-xs leading-6 text-[var(--museum-muted)]">名称与类别已完成归一化。地图只呈现坐标通过核验的记录。</p>
              <button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link mt-7">进入百科 <ArrowRight className="h-4 w-4" /></button>
            </Reveal>
            <div className="museum-kpi-grid">
              {kpis.slice(1).map((item, index) => (
                <Reveal key={item.label} delay={index * 0.06}>
                  <button type="button" onClick={() => navigate(item.to)} className="museum-kpi-item group">
                    <span className="font-mono text-4xl tracking-[-0.06em] text-[var(--museum-fg)] sm:text-5xl">{item.value.toLocaleString('zh-CN')}</span>
                    <span className="mt-3 block text-sm font-medium">{item.label}</span>
                    <span className="mt-1 block text-xs text-[var(--museum-muted)]">{item.note}</span>
                    <ArrowRight className="mt-6 h-4 w-4 text-[#d4a853] transition-transform group-hover:translate-x-1" aria-hidden="true" />
                  </button>
                </Reveal>
              ))}
            </div>
          </div>
          <p className="mt-4 text-xs text-[var(--museum-muted)]">{COLLECTION_SUMMARY.mappable.toLocaleString('zh-CN')} 条可落点 · {COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验 · 濒危数据为馆内编辑口径</p>
        </section>

        <section className="museum-section museum-category-section museum-section--last" aria-labelledby="categories-title">
          <Reveal className="museum-section-heading">
            <div>
              <p className="museum-eyebrow">BROWSE BY TYPE</p>
              <h2 id="categories-title" className="mt-3 font-serif text-3xl tracking-tight sm:text-5xl">按畜种浏览</h2>
            </div>
            <button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link">浏览全部 <ArrowRight className="h-4 w-4" /></button>
          </Reveal>
          <div className="museum-category-rail" aria-label="畜种类别">
            {categoryTally.slice(0, 15).map((item, index) => (
              <Reveal key={item.category} delay={index * 0.025}>
                <button type="button" onClick={() => navigate(`/encyclopedia?category=${encodeURIComponent(item.category)}`)} className="museum-category-item group" title={`查看${item.category}品种`}>
                  <span className="font-serif text-lg">{item.category}</span>
                  <span className="font-mono text-xs text-[var(--museum-muted)]">{item.count} 种</span>
                  <span className="museum-category-bar"><span style={{ width: `${Math.max(10, Math.round((item.count / Math.max(...categoryTally.map((entry) => entry.count))) * 100))}%` }} /></span>
                </button>
              </Reveal>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
