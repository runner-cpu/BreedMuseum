import { ArrowRight, BookOpen, Database, ExternalLink, FileCheck2, Map, Search, ShieldCheck, Sparkles } from 'lucide-react';
import { type CSSProperties, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { breedSources } from '@/data/breedSources';
import { breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY, COLLECTION_VERSION, QUALITY_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest } from '@/lib/geo/lightMapData';

const sectionTitle = (eyebrow: string, title: string, body?: string) => (
  <div className="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
    <div><p className="museum-eyebrow">{eyebrow}</p><h2 className="mt-2 font-serif text-2xl tracking-[-0.025em] text-[var(--museum-fg)] sm:text-3xl">{title}</h2></div>
    {body && <p className="max-w-xl text-sm leading-6 text-[var(--museum-muted)] sm:text-right">{body}</p>}
  </div>
);

const featureCards = [
  { icon: Map, label: '01', title: '品种地图探索', body: '在中国地图上查看地方品种的分布、类别与保护状态。', action: '打开地图', to: '/explore', tone: 'blue' },
  { icon: BookOpen, label: '02', title: '品种百科', body: '按名称、别名、类别或省份查找 1,186 条品种档案。', action: '查找品种', to: '/encyclopedia', tone: 'green' },
  { icon: Database, label: '03', title: '数据看板', body: '用图表理解类别构成、区域密度与保护名录匹配。', action: '查看数据', to: '/dashboard', tone: 'gold' },
  { icon: Sparkles, label: '04', title: '互动展厅', body: '用轻量互动认识品种与土地之间的关系。', action: '进入互动厅', to: '/arcade', tone: 'red' },
  { icon: ShieldCheck, label: '05', title: '保护名录', body: '查看国家级保护匹配和濒危状态，了解守护边界。', action: '查看保护数据', to: '/dashboard', tone: 'purple' },
  { icon: FileCheck2, label: '06', title: '数据来源链', body: '沿着来源链查看名录、字段核验和图片覆盖说明。', action: '查看馆史与库房', to: '/about', tone: 'slate' },
] as const;

const toneStyles: Record<(typeof featureCards)[number]['tone'], CSSProperties> = {
  blue: { borderColor: 'rgb(83 111 217 / .55)', backgroundColor: 'rgb(29 43 93 / .8)' }, green: { borderColor: 'rgb(61 158 125 / .55)', backgroundColor: 'rgb(23 61 60 / .8)' }, gold: { borderColor: 'rgb(199 156 78 / .6)', backgroundColor: 'rgb(67 51 25 / .8)' }, red: { borderColor: 'rgb(193 106 106 / .55)', backgroundColor: 'rgb(68 38 45 / .8)' }, purple: { borderColor: 'rgb(141 118 201 / .55)', backgroundColor: 'rgb(48 38 79 / .8)' }, slate: { borderColor: 'rgb(100 117 144 / .55)', backgroundColor: 'rgb(36 48 70 / .8)' },
};

/** 首页：按原始站点的产品节奏组织内容，首屏聚焦、下方以卡片和数据引导继续探索。 */
export default function LightMapPage() {
  const navigate = useNavigate();
  const digest = useMemo(() => buildDigest(), []);
  const categoryTally = useMemo(() => categories.map((category) => ({ category, count: digest.byCategory.get(category) ?? 0 })).filter((item) => item.count > 0), [digest]);
  const maxCategoryCount = Math.max(1, ...categoryTally.map((item) => item.count));
  const latestBreeds = useMemo(() => breeds.filter((breed) => breed.image !== '/brand/breed-placeholder.svg').slice(0, 6), []);
  const searchFromHero = (value: string) => { const query = value.trim(); navigate(query ? `/encyclopedia?search=${encodeURIComponent(query)}` : '/encyclopedia'); };
  const kpis = [
    { value: COLLECTION_SUMMARY.total, label: '收录品种', detail: '名录归一化记录', border: '#536fd9', background: '#1d2b5d' },
    { value: COLLECTION_SUMMARY.provinces, label: '覆盖省份', detail: '已核验省级行政区', border: '#3d9e7d', background: '#173d3c' },
    { value: COLLECTION_SUMMARY.categories, label: '畜禽类别', detail: '按名录分组', border: '#c79c4e', background: '#433319' },
    { value: COLLECTION_SUMMARY.nationalProtectedMatches, label: '保护品种', detail: '940 号公告匹配', border: '#c16a6a', background: '#44262d' },
  ];

  return (
    <div className="museum-home min-h-full text-[var(--museum-fg)]">
      <SpotlightHero titleTop="中国地方畜禽" titleBottom="品种数字博物馆" badge="守护中华农业文明基因" cta="开始探索" searchPh="搜索品种名称，如 河田鸡、秦川牛..." searchBtn="搜索百科" descLeft="一座以土地为展柜的数字博物馆，收录地方畜禽品种的名称、产区与故事。" descRight="从地图、数据或百科开始，找到你关心的那一份档案。" onExplore={() => navigate('/explore')} onSearch={searchFromHero} />

      <div className="museum-home-inner">
        <section id="overview" aria-labelledby="overview-title" className="museum-section scroll-mt-8">
          {sectionTitle('馆藏概览', '用四个数字认识这座馆', '数据来自当前 2026-09-27 版馆藏快照，可继续下钻到地图、百科和看板。')}
          <h2 id="overview-title" className="sr-only">馆藏核心数据</h2>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {kpis.map((item) => <button key={item.label} type="button" onClick={() => navigate(item.label === '覆盖省份' ? '/explore' : '/dashboard')} style={{ borderColor: item.border, backgroundColor: item.background }} className="group relative min-h-36 overflow-hidden rounded-xl border p-4 text-left transition duration-200 hover:-translate-y-1 sm:min-h-40 sm:p-6"><span className="absolute -right-8 -top-8 h-28 w-28 rounded-full bg-[rgba(255,255,255,0.1)] blur-2xl transition group-hover:bg-[rgba(255,255,255,0.2)]" /><span className="relative block font-serif text-3xl font-bold tracking-tight text-white sm:text-4xl">{item.value.toLocaleString('zh-CN')}</span>{item.label === '收录品种' && <span className="sr-only">1186</span>}<span className="relative mt-3 block text-sm font-medium text-white/90">{item.label}</span><span className="relative mt-1 block text-xs text-white/55">{item.detail}</span></button>)}
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-[var(--museum-muted)]"><span>数据版本 {COLLECTION_VERSION}</span><span>·</span><span>{COLLECTION_SUMMARY.mappable} 条可落点记录</span><span>·</span><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验</span></div>
        </section>

        <section id="categories" aria-labelledby="categories-title" className="museum-section scroll-mt-8 pt-2 sm:pt-4">
          {sectionTitle('类别速览', '从畜种开始浏览', '点击类别即可进入地图，先看它们在土地上的分布。')}
          <h2 id="categories-title" className="sr-only">品种类别速览</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-5 lg:grid-cols-8">{categoryTally.map((item) => <button key={item.category} type="button" onClick={() => navigate(`/explore?category=${encodeURIComponent(item.category)}`)} className="museum-panel group min-h-24 px-3 py-4 text-left transition hover:-translate-y-0.5 hover:border-[#d4a853]/80"><span className="mb-3 block h-1.5 w-8 rounded-full transition-all group-hover:w-12" style={{ backgroundColor: categoryColors[item.category] }} /><span className="block text-sm font-medium text-[var(--museum-fg)]">{item.category}</span><span className="mt-1 block font-mono text-xs text-[var(--museum-muted)]">{item.count} 种</span><span className="sr-only">占比 {Math.round((item.count / maxCategoryCount) * 100)}%</span></button>)}</div>
        </section>

        <section id="journey" aria-labelledby="journey-title" aria-label="参观路线" className="museum-section scroll-mt-8 pt-2 sm:pt-4">
          {sectionTitle('核心功能', '选择你的参观方式', '地图、百科与数据看板各自独立，也可以从任意页面继续跳转。')}
          <h2 id="journey-title" className="sr-only">参观路线</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{featureCards.map(({ icon: Icon, label, title, body, action, to, tone }) => <button key={title} type="button" onClick={() => navigate(to)} style={toneStyles[tone]} className="group relative flex min-h-44 flex-col overflow-hidden rounded-xl border p-5 text-left transition duration-200 hover:-translate-y-1 hover:border-[#d4a853]"><div className="flex items-center justify-between"><span className="font-mono text-xs text-white/45">{label}</span><span className="flex h-9 w-9 items-center justify-center rounded-lg border border-[rgba(255,255,255,0.15)] bg-[rgba(255,255,255,0.1)] text-[#e1bb6b]"><Icon className="h-4 w-4" /></span></div><h3 className="mt-5 font-serif text-xl text-white">{title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-white/65">{body}</p><span className="mt-3 inline-flex items-center gap-1.5 text-xs font-semibold text-[#e5c374]">{action}<ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" /></span></button>)}</div>
        </section>

        <section id="latest" aria-labelledby="latest-title" className="museum-section scroll-mt-8 pt-2 sm:pt-4">
          {sectionTitle('最新收录', '从一张品种卡开始', '精选有图片记录的档案，点击后可查看完整卷宗。')}
          <h2 id="latest-title" className="sr-only">最新收录品种</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">{latestBreeds.map((breed) => <button key={breed.id} type="button" onClick={() => navigate(`/breed/${breed.id}`)} className="group overflow-hidden rounded-xl border border-[var(--museum-line)] bg-[var(--museum-panel)] text-left transition hover:-translate-y-1 hover:border-[#d4a853]/70"><div className="relative aspect-[4/3] overflow-hidden bg-[#202a43]"><img src={breed.image} alt="" loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" onError={(event) => { event.currentTarget.src = '/brand/breed-placeholder.svg'; }} /><span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 text-[10px] text-white/80">{breed.category}</span></div><div className="p-3"><h3 className="truncate text-sm font-medium text-[var(--museum-fg)]">{breed.name}</h3><p className="mt-1 truncate text-xs text-[var(--museum-muted)]">{breed.province} · 查看档案</p></div></button>)}</div>
          <div className="mt-4 text-center"><button type="button" onClick={() => navigate('/encyclopedia')} className="museum-link mx-auto">浏览全部 1,186 条档案 <ArrowRight className="h-4 w-4" /></button></div>
        </section>

        <section id="intro" aria-labelledby="intro-title" className="museum-section scroll-mt-8 pt-2 sm:pt-4">
          {sectionTitle('关于这座馆', '把名录里的名字，重新放回土地', '馆史保留在独立页面，首页只留下理解项目所需的一段介绍。')}
          <div className="museum-panel grid gap-6 p-6 sm:p-8 lg:grid-cols-[1.3fr_.7fr] lg:items-center"><div><p className="text-xs tracking-[0.2em] text-[#d4a853]">A DIGITAL MUSEUM OF LIVING HERITAGE</p><h2 id="intro-title" className="mt-3 font-serif text-2xl leading-tight text-[var(--museum-fg)] sm:text-3xl">一张地图，三种进入方式</h2><p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--museum-muted)]">畜种光图把官方名录、产区和保护信息整理成一座可以浏览的数字博物馆。你可以浏览分布、比较结构、查阅卷宗；无法确认的坐标和字段会被明确标注，数据来源与核验边界始终跟随记录展示。</p><div className="mt-5 flex flex-wrap gap-3"><button type="button" onClick={() => navigate('/explore')} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#d4a853] px-4 text-sm font-semibold text-[#182033] hover:bg-[#e3bd6f]">进入地图探索 <ArrowRight className="h-4 w-4" /></button><button type="button" onClick={() => navigate('/about')} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-[var(--museum-line)] px-4 text-sm text-[var(--museum-fg)] hover:border-[#d4a853]">查看完整馆史 <ExternalLink className="h-4 w-4" /></button></div></div><div className="grid grid-cols-3 gap-2 lg:grid-cols-1">{[['来源清楚', '官方名录与数据来源链'], ['空间可读', `${COLLECTION_SUMMARY.mappable} 条记录可落点`], ['边界诚实', '待核验字段保留说明']].map(([title, body]) => <div key={title} className="rounded-lg border border-[var(--museum-line)] bg-[var(--museum-panel-raised)] p-3"><p className="text-sm font-medium text-[var(--museum-fg)]">{title}</p><p className="mt-1 text-xs leading-5 text-[var(--museum-muted)]">{body}</p></div>)}</div></div>
        </section>

        <section id="sources" aria-labelledby="sources-title" className="museum-section pt-2 sm:pt-4"><div className="museum-panel flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"><div><p className="museum-eyebrow">来源与方法</p><h2 id="sources-title" className="mt-2 font-serif text-xl text-[var(--museum-fg)]">每个数字，都有可查的出处</h2><p className="mt-1 text-xs leading-5 text-[var(--museum-muted)]">{QUALITY_SUMMARY.unitTests} 项自动检查 · {COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验 · 图片覆盖情况在百科与档案中单独标注。</p></div><div className="flex shrink-0 flex-wrap gap-3"><button type="button" onClick={() => navigate('/about')} className="museum-link">馆史与库房 <ArrowRight className="h-4 w-4" /></button><a href={breedSources['nahs-catalog-2024'].url} target="_blank" rel="noreferrer" className="museum-link">官方名录 <ExternalLink className="h-3.5 w-3.5" /></a></div></div><div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--museum-muted)]"><VerificationLegend /><span>·</span><span>图片、坐标与编辑资料分别标注核验边界</span><span className="inline-flex items-center gap-1.5 sm:ml-auto"><Search className="h-3.5 w-3.5 text-[#d4a853]" aria-hidden="true" />无需登录，数据在浏览器本地运行</span></div></section>
      </div>
    </div>
  );
}
