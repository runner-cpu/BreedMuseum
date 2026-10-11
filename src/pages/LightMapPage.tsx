import { ArrowRight, BookOpen, Database, ExternalLink, FileCheck2, Layers3, Map, Search, ShieldCheck } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import ChromaGrid from '@/components/effects/ChromaGrid';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { breedSources } from '@/data/breedSources';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY, COLLECTION_VERSION, QUALITY_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest } from '@/lib/geo/lightMapData';

const sectionTitle = (eyebrow: string, title: string, body?: string) => (
  <div className="mb-7 max-w-3xl">
    <p className="museum-eyebrow">{eyebrow}</p>
    <h2 className="mt-2 font-serif text-3xl tracking-[-0.025em] text-white sm:text-4xl">{title}</h2>
    {body && <p className="mt-3 max-w-2xl text-sm leading-7 text-[#aab5c9] sm:text-base">{body}</p>}
  </div>
);

/** 首页序厅：只回答三个问题——这是什么、馆藏有多大、下一步如何进入。 */
export default function LightMapPage() {
  const navigate = useNavigate();
  const digest = useMemo(() => buildDigest(), []);
  const categoryTally = useMemo(
    () => categories.map((category) => ({ category, count: digest.byCategory.get(category) ?? 0 })).filter((item) => item.count > 0),
    [digest],
  );
  const maxCategoryCount = useMemo(() => Math.max(0, ...categoryTally.map((item) => item.count)), [categoryTally]);
  const provinceTally = useMemo(() => digest.provinces.filter((item) => item.province !== '待核验').slice(0, 8), [digest]);

  const searchFromHero = (value: string) => {
    const query = value.trim();
    navigate(query ? `/encyclopedia?search=${encodeURIComponent(query)}` : '/encyclopedia');
  };

  const kpis = [
    { title: String(COLLECTION_SUMMARY.total), subtitle: '已收录品种', handle: '名录归一化记录', borderColor: '#5064d8', gradient: 'linear-gradient(135deg,#1c2c66,#17203f)', url: '/encyclopedia' },
    { title: String(COLLECTION_SUMMARY.provinces), subtitle: '覆盖省份', handle: '省级行政区', borderColor: '#22b883', gradient: 'linear-gradient(135deg,#113f38,#162d35)', url: '/explore' },
    { title: String(COLLECTION_SUMMARY.categories), subtitle: '畜禽类别', handle: '按名录分组', borderColor: '#d4a853', gradient: 'linear-gradient(135deg,#4a3715,#2b251a)', url: '/dashboard' },
    { title: String(COLLECTION_SUMMARY.nationalProtectedMatches), subtitle: '保护品种', handle: '940 号公告匹配', borderColor: '#e87472', gradient: 'linear-gradient(135deg,#542522,#2e1d29)', url: '/dashboard' },
  ];

  const routes = [
    { index: '01', title: '从土地开始', body: '点亮省份与产区，观察品种和地域如何彼此关联。', action: '进入地图探索', to: '/explore', icon: <Map className="h-5 w-5" /> },
    { index: '02', title: '用数据理解', body: '比较类别、区域和保护状态，快速建立馆藏全景。', action: '打开数据看板', to: '/dashboard', icon: <Database className="h-5 w-5" /> },
    { index: '03', title: '查一份卷宗', body: '按名称、别名或产地检索，回到一条可追溯的品种记录。', action: '进入品种百科', to: '/encyclopedia', icon: <BookOpen className="h-5 w-5" /> },
  ];

  return (
    <div className="museum-home min-h-full text-[#edf2fb]">
      <SpotlightHero
        titleTop="中国地方畜禽"
        titleBottom="品种数字博物馆"
        badge="守护中华农业文明基因"
        cta="进入地图探索"
        searchPh="搜索品种名称，如 河田鸡、秦川牛..."
        searchBtn="搜索百科"
        descLeft="一座以土地为展柜的数字博物馆。每一个名字，都有自己的产区、来源与故事。"
        descRight="先认识这座馆，再按地图、数据或百科选择你的参观方式。"
        onExplore={() => navigate('/explore')}
        onSearch={searchFromHero}
      />

      <div className="museum-home-inner">
        <section id="intro" aria-labelledby="intro-title" className="museum-section scroll-mt-8">
          {sectionTitle('关于这座馆', '把名录里的名字，重新放回土地', '畜种光图把官方名录、产区和保护信息整理成一座可以浏览的数字博物馆。先看全景，再进入你真正关心的品种。')}
          <div className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
            <article className="museum-panel relative overflow-hidden p-6 sm:p-8">
              <div aria-hidden="true" className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-[#d4a853]/10 blur-3xl" />
              <div className="relative">
                <p className="text-xs tracking-[0.2em] text-[#d4a853]">A DIGITAL MUSEUM OF LIVING HERITAGE</p>
                <h3 id="intro-title" className="mt-3 max-w-xl font-serif text-2xl leading-tight text-white sm:text-3xl">一张地图，三种进入方式</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#c0cadb]">浏览分布、比较结构、查阅卷宗。无法确认的坐标和字段会被明确标注，数据来源与核验边界始终跟随记录展示。</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => navigate('/explore')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#d4a853] px-4 text-sm font-semibold text-[#182033] transition-colors hover:bg-[#e3bd6f]">从地图开始 <ArrowRight className="h-4 w-4" /></button>
                  <button type="button" onClick={() => navigate('/encyclopedia')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#53617e] px-4 text-sm text-[#d7dfef] transition-colors hover:border-[#d4a853] hover:text-white">查找品种 <Search className="h-4 w-4" /></button>
                </div>
              </div>
            </article>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { icon: <FileCheck2 className="h-5 w-5" />, title: '来源清楚', body: '名称与分类对照官方名录。' },
                { icon: <Map className="h-5 w-5" />, title: '空间可读', body: '产区以省域和主要点位呈现。' },
                { icon: <ShieldCheck className="h-5 w-5" />, title: '边界诚实', body: '待核验内容保留原样说明。' },
              ].map((item) => (
                <article key={item.title} className="museum-panel flex gap-4 p-5">
                  <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#425270] bg-[#202b46] text-[#d4a853]">{item.icon}</span>
                  <div><h3 className="font-serif text-lg text-white">{item.title}</h3><p className="mt-1 text-sm leading-6 text-[#aab5c9]">{item.body}</p></div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="overview" aria-labelledby="overview-title" className="museum-section scroll-mt-8">
          {sectionTitle('馆藏一览', '先用数字建立全景', `当前馆藏共 ${COLLECTION_SUMMARY.total} 条记录；点击任意数字或图表即可继续下钻。`)}
          <h2 id="overview-title" className="sr-only">馆藏核心数据</h2>
          <ChromaGrid items={kpis} columns={4} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="museum-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-[#aab5c9]">类别构成</p><h3 className="mt-1 font-serif text-xl text-white">不同物种如何组成馆藏</h3></div><Layers3 className="h-5 w-5 text-[#d4a853]" aria-hidden="true" /></div>
              <div className="mt-6 space-y-3">{categoryTally.slice(0, 8).map((item) => { const width = Math.max(8, maxCategoryCount > 0 ? (item.count / maxCategoryCount) * 100 : 8); return <button key={item.category} type="button" className="group flex min-h-8 w-full items-center gap-3 text-left" onClick={() => navigate(`/explore?category=${encodeURIComponent(item.category)}`)}><span className="w-14 shrink-0 text-xs text-[#aab5c9]">{item.category}</span><span className="museum-subtle-track h-2 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full transition-all duration-500 group-hover:brightness-125" style={{ width: `${width}%`, backgroundColor: categoryColors[item.category] }} /></span><span className="w-10 text-right font-mono text-xs text-white">{item.count}</span></button>; })}</div>
            </div>
            <div className="museum-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-[#aab5c9]">省份排行</p><h3 className="mt-1 font-serif text-xl text-white">记录最密集的区域</h3></div><span className="font-mono text-xs text-[#d4a853]">TOP 8</span></div>
              <div className="mt-6 space-y-3">{provinceTally.map((item, index) => { const maxTotal = provinceTally[0]?.total ?? item.total; const width = Math.max(8, maxTotal > 0 ? (item.total / maxTotal) * 100 : 8); return <button type="button" key={item.province} className="group flex min-h-7 w-full items-center gap-3 text-left" onClick={() => navigate(`/explore?province=${encodeURIComponent(item.province)}`)}><span className="w-5 font-mono text-xs text-[#74819a]">{String(index + 1).padStart(2, '0')}</span><span className="w-14 shrink-0 text-xs text-[#d5dbea]">{item.province}</span><span className="museum-subtle-track h-1.5 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full bg-[#7a9a6b] transition-all group-hover:bg-[#9bbc85]" style={{ width: `${width}%` }} /></span><span className="font-mono text-xs text-white">{item.total}</span></button>; })}</div>
            </div>
          </div>
        </section>

        <section id="journey" aria-labelledby="journey-title" className="museum-section scroll-mt-8">
          {sectionTitle('参观路线', '三步，读懂一份地方品种档案')}
          <h2 id="journey-title" className="sr-only">参观路线</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {routes.map((step) => (
              <li key={step.index} className="museum-panel group flex flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between"><span className="font-mono text-sm text-[#d4a853]">{step.index}</span><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#425270] bg-[#202b46] text-[#d4a853]">{step.icon}</span></div>
                <h3 className="mt-5 font-serif text-xl text-white">{step.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-[#aab5c9]">{step.body}</p>
                <button type="button" onClick={() => navigate(step.to)} className="museum-link mt-5">{step.action} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>
              </li>
            ))}
          </ol>
        </section>

        <section id="sources" aria-labelledby="sources-title" className="museum-section scroll-mt-8">
          <div className="museum-panel flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-7">
            <div><p className="museum-eyebrow">来源与方法</p><h2 id="sources-title" className="mt-2 font-serif text-2xl text-white">每个数字，都有可查的出处</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-[#aab5c9]">版本 {COLLECTION_VERSION} · {QUALITY_SUMMARY.unitTests} 项自动检查 · {COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验。完整馆史、映射口径和图片来源请查看馆史与库房。</p></div>
            <div className="flex shrink-0 flex-wrap gap-3"><LinkLike to="/about">查看完整披露 <ArrowRight className="h-4 w-4" /></LinkLike><a href={breedSources['nahs-catalog-2024'].url} target="_blank" rel="noreferrer" className="museum-link">官方名录 <ExternalLink className="h-3.5 w-3.5" /></a></div>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#aab5c9]"><VerificationLegend /><span>·</span><span>图片、坐标与编辑资料会分别标注核验边界</span><span className="inline-flex items-center gap-1.5 sm:ml-auto"><ShieldCheck className="h-4 w-4 text-[#d4a853]" aria-hidden="true" />无需登录，数据在浏览器本地运行</span></div>
        </section>
      </div>
    </div>
  );
}

function LinkLike({ to, children }: { to: string; children: React.ReactNode }) {
  const navigate = useNavigate();
  return <button type="button" onClick={() => navigate(to)} className="museum-link">{children}</button>;
}
