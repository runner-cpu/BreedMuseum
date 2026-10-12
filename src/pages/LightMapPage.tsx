import { ArrowRight, BarChart3, BookOpen, Map } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { BreedImage } from '@/components/common/BreedImage';
import { breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY, COLLECTION_VERSION } from '@/data/collectionSummary';
import { buildDigest } from '@/lib/geo/lightMapData';

const featureCards = [
  { icon: Map, number: '01', title: '地图探索', text: '从一张中国地图开始，沿着产区圆点找到地方品种。', to: '/explore', action: '打开地图' },
  { icon: BookOpen, number: '02', title: '品种百科', text: '搜索名称、类别和产区，在卡片墙里快速定位一条记录。', to: '/encyclopedia', action: '查找品种' },
  { icon: BarChart3, number: '03', title: '数据看板', text: '用图表看见类别结构、区域密度和保护名录匹配。', to: '/dashboard', action: '查看数据' },
] as const;

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
        <section className="museum-section museum-section--first py-10 sm:py-14" aria-labelledby="features-title">
          <div className="mb-5 max-w-2xl">
            <p className="museum-eyebrow">VISIT THE MUSEUM</p>
            <h2 id="features-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">选择一种进入方式</h2>
            <p className="mt-2 max-w-[62ch] text-sm leading-6 text-[var(--museum-muted)]">先看空间，再看记录；每条入口都会把你带回同一套可追溯的馆藏数据。</p>
          </div>
          <div className="grid gap-3 lg:grid-cols-3">
            {featureCards.map(({ icon: Icon, number, title, text, to, action }) => (
              <button key={title} type="button" onClick={() => navigate(to)} className="museum-panel museum-feature-card group min-h-52 p-5 text-left transition hover:-translate-y-1 hover:border-[#d4a853]">
                <div className="flex items-center justify-between"><span className="font-mono text-xs text-[var(--museum-muted)]">{number}</span><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[var(--museum-line)] text-[#d4a853]"><Icon className="h-5 w-5" /></span></div>
                <h3 className="mt-6 font-serif text-xl">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[var(--museum-muted)]">{text}</p>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-[#d4a853]">{action}<ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="museum-section py-8 sm:py-12" aria-labelledby="featured-title">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="museum-eyebrow">SELECTED RECORDS</p><h2 id="featured-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">从一张品种卡开始</h2></div><button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link">查看全部 <ArrowRight className="h-4 w-4" /></button></div>
          <div className="museum-featured-rail" aria-label="精选品种">
            {featured.map((breed) => (
              <button key={breed.id} type="button" onClick={() => navigate(`/encyclopedia?breed=${encodeURIComponent(breed.id)}`)} className="museum-featured-card group overflow-hidden rounded-xl border border-[var(--museum-line)] bg-[var(--museum-panel)] text-left transition hover:-translate-y-1 hover:border-[#d4a853]">
                <BreedImage src={breed.image} alt={`${breed.name}图片`} category={breed.category} breedName={breed.name} className="aspect-[4/3]" imgClassName="transition duration-500 group-hover:scale-105" sizes="(min-width: 1024px) 16vw, 50vw" />
                <div className="p-3"><span className="text-[10px] text-[#d4a853]">{breed.category}</span><h3 className="mt-1 truncate text-sm font-medium">{breed.name}</h3><p className="mt-1 truncate text-xs text-[var(--museum-muted)]">{breed.province}</p></div>
              </button>
            ))}
          </div>
        </section>

        <section className="museum-section py-8 sm:py-12" aria-labelledby="overview-title">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="museum-eyebrow">COLLECTION · {COLLECTION_VERSION}</p><h2 id="overview-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">四个数字，认识这座馆</h2></div><span className="hidden text-xs text-[var(--museum-muted)] sm:block">数据在浏览器本地运行</span></div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {kpis.map((item) => <button key={item.label} type="button" onClick={() => navigate(item.to)} className="museum-panel group min-h-32 p-4 text-left transition hover:-translate-y-1 hover:border-[#d4a853] sm:min-h-36 sm:p-5"><span className="font-serif text-3xl font-semibold text-[var(--museum-fg)] sm:text-4xl">{item.value.toLocaleString('zh-CN')}</span><span className="mt-3 block text-sm font-medium">{item.label}</span><span className="mt-1 block text-xs text-[var(--museum-muted)]">{item.note}</span></button>)}
          </div>
          <p className="mt-3 text-xs text-[var(--museum-muted)]">{COLLECTION_SUMMARY.mappable} 条可落点 · {COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验 · 濒危数据为馆内编辑口径</p>
        </section>

        <section className="museum-section museum-section--last py-8 sm:py-12" aria-labelledby="categories-title">
          <div className="mb-5 flex items-end justify-between gap-4"><div><p className="museum-eyebrow">BROWSE BY TYPE</p><h2 id="categories-title" className="mt-2 font-serif text-2xl tracking-tight sm:text-3xl">按畜种浏览</h2></div><button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link">浏览全部 <ArrowRight className="h-4 w-4" /></button></div>
          <div className="museum-category-rail" aria-label="畜种类别">
            {categoryTally.slice(0, 15).map((item) => <button key={item.category} type="button" onClick={() => navigate(`/encyclopedia?category=${encodeURIComponent(item.category)}`)} className="museum-panel min-h-20 p-3 text-left transition hover:-translate-y-0.5 hover:border-[#d4a853]" title={`查看${item.category}品种`}><span className="block text-sm font-medium">{item.category}</span><span className="mt-1 block font-mono text-xs text-[var(--museum-muted)]">{item.count} 种</span><span className="mt-2 block h-1 rounded-full bg-[var(--museum-line)]"><span className="block h-full rounded-full bg-[#d4a853]" style={{ width: `${Math.max(10, Math.round((item.count / Math.max(...categoryTally.map((entry) => entry.count))) * 100))}%` }} /></span></button>)}
          </div>
        </section>
      </div>
    </div>
  );
}
