import {
  ArrowRight,
  BookOpen,
  BookOpenCheck,
  Database,
  Download,
  ExternalLink,
  FileCheck2,
  Layers3,
  Map,
  Search,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import ChromaGrid from '@/components/effects/ChromaGrid';
import MagicBento from '@/components/effects/MagicBento';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { matchesBreedQuery } from '@/data/breedSearch';
import { breedSources } from '@/data/breedSources';
import { type Breed, breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY, COLLECTION_VERSION, QUALITY_SUMMARY } from '@/data/collectionSummary';
import { ARCADE_GAMES } from '@/lib/arcade/games';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest } from '@/lib/geo/lightMapData';

const sectionTitle = (eyebrow: string, title: string, body?: string) => (
  <div className="mb-7 max-w-3xl">
    <p className="museum-eyebrow">{eyebrow}</p>
    <h2 className="mt-2 font-serif text-3xl tracking-[-0.025em] text-white sm:text-4xl">{title}</h2>
    {body && <p className="mt-3 max-w-2xl text-sm leading-7 text-[#aab5c9] sm:text-base">{body}</p>}
  </div>
);

/** 首页是博物馆的序厅：回答「这里是什么、为什么可信、下一步去哪儿」。 */
export default function LightMapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [query, setQuery] = useState(params.get('search') ?? '');
  const digest = useMemo(() => buildDigest(), []);
  const categoryTally = useMemo(
    () => categories.map((category) => ({ category, count: digest.byCategory.get(category) ?? 0 })).filter((item) => item.count > 0),
    [digest],
  );
  const maxCategoryCount = useMemo(() => Math.max(0, ...categoryTally.map((item) => item.count)), [categoryTally]);
  const provinceTally = useMemo(() => digest.provinces.filter((item) => item.province !== '待核验').slice(0, 8), [digest]);
  const searchHits = useMemo(
    () => (query.trim().length < 2 ? [] : breeds.filter((breed) => matchesBreedQuery(breed, query.trim())).slice(0, 7)),
    [query],
  );
  const latestBreeds = useMemo(() => breeds.filter((breed) => breed.image).slice(0, 8), []);
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const searchFromHero = (value: string) => { setQuery(value); scrollTo('archive'); };
  const openBreed = (breed: Breed) => navigate(`/breed/${breed.id}`);

  const kpis = [
    { title: String(COLLECTION_SUMMARY.total), subtitle: '已收录品种', handle: '名录归一化记录', borderColor: '#5064d8', gradient: 'linear-gradient(135deg,#1c2c66,#17203f)', url: '/explore' },
    { title: String(COLLECTION_SUMMARY.provinces), subtitle: '覆盖省份', handle: '省级行政区', borderColor: '#22b883', gradient: 'linear-gradient(135deg,#113f38,#162d35)', url: '/explore' },
    { title: String(COLLECTION_SUMMARY.categories), subtitle: '畜禽类别', handle: '按名录分组', borderColor: '#d4a853', gradient: 'linear-gradient(135deg,#4a3715,#2b251a)', url: '/dashboard' },
    { title: String(COLLECTION_SUMMARY.nationalProtectedMatches), subtitle: '保护品种', handle: '940 号公告匹配', borderColor: '#e87472', gradient: 'linear-gradient(135deg,#542522,#2e1d29)', url: '/dashboard' },
  ];
  const featureCards = [
    { icon: <Map className="h-5 w-5" />, label: 'EXPLORE', title: '品种地图探索', description: '把全国馆藏放回它们的土地，在四种镜头之间切换产区、类别与保护状态。', to: '/explore' },
    { icon: <Database className="h-5 w-5" />, label: 'READ DATA', title: '数据看板', description: '用类别构成、省份排行和保护状态读懂馆藏结构。', to: '/dashboard' },
    { icon: <BookOpen className="h-5 w-5" />, label: 'ARCHIVE', title: '品种百科', description: '从名称、别名与产地进入一份可追溯卷宗。', to: '#archive' },
    { icon: <BookOpenCheck className="h-5 w-5" />, label: 'PLAY', title: '互动展厅', description: '用找家、识图和问答，把一条记录变成一次亲手完成的探索。', to: '/arcade' },
    { icon: <ShieldCheck className="h-5 w-5" />, label: 'SOURCES', title: '馆史与来源', description: '查看完整的馆史、映射口径、质量仪表盘和 AI 使用披露。', to: '/about' },
    { icon: <Download className="h-5 w-5" />, label: 'VISIT', title: '参观路线', description: '从土地到数据，再回到一份可追溯的品种卷宗。', to: '#journey' },
  ];

  return (
    <div className="museum-home min-h-full text-[#edf2fb]">
      <SpotlightHero
        titleTop="中国地方畜禽"
        titleBottom="品种数字博物馆"
        badge="守护中华农业文明基因"
        cta="进入地图探索"
        searchPh="搜索品种名称，如 河田鸡、秦川牛..."
        searchBtn="搜索档案"
        descLeft="一座以土地为展柜的数字博物馆。每一个名字，都有自己的产区、来源与故事。"
        descRight="先认识这座馆，再进入光图探索全国分布，最后回到一份可追溯的品种卷宗。"
        onExplore={() => navigate('/explore')}
        onSearch={searchFromHero}
      />

      <div className="museum-home-inner">
        <section id="intro" aria-labelledby="intro-title" className="museum-section scroll-mt-8">
          {sectionTitle('关于这座馆', '把散落在名录里的名字，重新放回土地', '「畜种光图」是一座纯前端数字博物馆：用地图、数据和故事，展示中国地方畜禽遗传资源的地域性。它不是一份冷冰冰的名单，而是一条从官方名录到地方记忆的参观路线。')}
          <div className="grid gap-4 lg:grid-cols-[1.15fr_.85fr]">
            <article className="museum-panel relative overflow-hidden p-6 sm:p-8">
              <div aria-hidden="true" className="absolute right-[-3rem] top-[-3rem] h-40 w-40 rounded-full bg-[#d4a853]/10 blur-3xl" />
              <div className="relative">
                <p className="text-xs tracking-[0.2em] text-[#d4a853]">A SMALL MUSEUM, A LARGE LANDSCAPE</p>
                <h3 id="intro-title" className="mt-3 max-w-xl font-serif text-2xl leading-tight text-white sm:text-3xl">从一份名录开始，走进中国地方品种的生活史</h3>
                <p className="mt-4 max-w-xl text-sm leading-7 text-[#c0cadb]">我们逐页核对官方文件，统一异名和类别，把可定位的产区放回省域地图；仍待核验的记录则明确留白。你可以沿着一张地图浏览，也可以打开任何一条卷宗追溯它的证据链。</p>
                <div className="mt-6 flex flex-wrap gap-3">
                  <button type="button" onClick={() => navigate('/explore')} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#d4a853] px-4 text-sm font-semibold text-[#182033] transition-colors hover:bg-[#e3bd6f]">从地图开始 <ArrowRight className="h-4 w-4" /></button>
                  <button type="button" onClick={() => scrollTo('sources')} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-[#53617e] px-4 text-sm text-[#d7dfef] transition-colors hover:border-[#d4a853] hover:text-white">了解数据来源</button>
                </div>
              </div>
            </article>
            <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
              {[
                { icon: <BookOpenCheck className="h-5 w-5" />, title: '看见地域', body: '品种不是孤立的名字，产区就是它的第一条注释。' },
                { icon: <FileCheck2 className="h-5 w-5" />, title: '查到来源', body: '每个字段都有核验边界，官方名录与公告公开可查。' },
                { icon: <ShieldCheck className="h-5 w-5" />, title: '留出不确定', body: '没有坐标的记录不被伪造成点位，待核验也属于馆藏事实。' },
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
          {sectionTitle('馆藏一览', '先用数字建立一张全景地图', '这些数字来自同一份经过清洗、归一化和来源核验的馆藏记录。点击卡片可以继续进入地图或数据看板。')}
          <h2 id="overview-title" className="sr-only">馆藏核心数据</h2>
          <ChromaGrid items={kpis} columns={4} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="museum-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-[#aab5c9]">类别构成</p><h3 className="mt-1 font-serif text-xl text-white">地方遗传资源的多样面貌</h3></div><Layers3 className="h-5 w-5 text-[#d4a853]" aria-hidden="true" /></div>
              <div className="mt-6 space-y-3">{categoryTally.slice(0, 8).map((item) => { const width = Math.max(8, maxCategoryCount > 0 ? (item.count / maxCategoryCount) * 100 : 8); return <button key={item.category} type="button" className="group flex min-h-8 w-full items-center gap-3 text-left" onClick={() => navigate(`/explore?category=${encodeURIComponent(item.category)}`)}><span className="w-14 shrink-0 text-xs text-[#aab5c9]">{item.category}</span><span className="museum-subtle-track h-2 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full transition-all duration-500 group-hover:brightness-125" style={{ width: `${width}%`, backgroundColor: categoryColors[item.category] }} /></span><span className="w-10 text-right font-mono text-xs text-white">{item.count}</span></button>; })}</div>
            </div>
            <div className="museum-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-[#aab5c9]">省份排行</p><h3 className="mt-1 font-serif text-xl text-white">记录最密集的区域</h3></div><span className="font-mono text-xs text-[#d4a853]">TOP 8</span></div>
              <div className="mt-6 space-y-3">{provinceTally.map((item, index) => { const maxTotal = provinceTally[0]?.total ?? item.total; const width = Math.max(8, maxTotal > 0 ? (item.total / maxTotal) * 100 : 8); return <button type="button" key={item.province} className="group flex min-h-7 w-full items-center gap-3 text-left" onClick={() => navigate(`/explore?province=${encodeURIComponent(item.province)}`)}><span className="w-5 font-mono text-xs text-[#74819a]">{String(index + 1).padStart(2, '0')}</span><span className="w-14 shrink-0 text-xs text-[#d5dbea]">{item.province}</span><span className="museum-subtle-track h-1.5 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full bg-[#7a9a6b] transition-all group-hover:bg-[#9bbc85]" style={{ width: `${width}%` }} /></span><span className="font-mono text-xs text-white">{item.total}</span></button>; })}</div>
            </div>
          </div>
        </section>

        <section id="journey" aria-labelledby="journey-title" className="museum-section scroll-mt-8">
          {sectionTitle('参观路线', '三步，读懂一份地方品种档案', '把复杂的信息拆成清晰的参观路径：先看分布，再看数据，最后进入一份可核验的记录。')}
          <h2 id="journey-title" className="sr-only">参观路线</h2>
          <ol className="grid gap-4 md:grid-cols-3">
            {[
              { index: '01', title: '从土地开始', body: '在探索地图里点亮省份与产区，观察类别、保护状态与地域之间的关系。', action: '进入地图探索', to: '/explore', icon: <Map className="h-5 w-5" /> },
              { index: '02', title: '用数据理解', body: '在数据看板里比较类别构成和省份密度，发现馆藏背后的结构。', action: '打开数据看板', to: '/dashboard', icon: <Database className="h-5 w-5" /> },
              { index: '03', title: '回到一条记录', body: '打开单个品种卷宗，阅读别名、产区、体貌和来源，留下可追溯的结论。', action: '检索档案', to: '#archive', icon: <BookOpen className="h-5 w-5" /> },
            ].map((step) => (
              <li key={step.index} className="museum-panel group flex flex-col p-5 sm:p-6">
                <div className="flex items-center justify-between"><span className="font-mono text-sm text-[#d4a853]">{step.index}</span><span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#425270] bg-[#202b46] text-[#d4a853]">{step.icon}</span></div>
                <h3 className="mt-5 font-serif text-xl text-white">{step.title}</h3><p className="mt-2 flex-1 text-sm leading-6 text-[#aab5c9]">{step.body}</p>
                <button type="button" onClick={() => step.to.startsWith('#') ? scrollTo(step.to.slice(1)) : navigate(step.to)} className="museum-link mt-5">{step.action} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" /></button>
              </li>
            ))}
          </ol>
        </section>

        <section id="play" aria-labelledby="play-title" className="museum-section scroll-mt-8">
          {sectionTitle('互动展厅', '把一条记录变成一次亲手完成的探索', '三台展教装置从馆藏字段出发，让观众在地图、剪影和问答之间建立自己的记忆。')}
          <h2 id="play-title" className="sr-only">互动展厅</h2>
          <div className="grid gap-4 md:grid-cols-3">{ARCADE_GAMES.map((game) => <div key={game.id} className="museum-panel p-5"><p className="text-xs text-[#d4a853]">{game.skill} · {game.rounds}</p><h3 className="mt-2 font-serif text-xl text-white">{game.title}</h3><p className="mt-2 text-sm leading-6 text-[#aab5c9]">{game.summary}</p><button type="button" onClick={() => navigate(`/arcade/${game.id}`)} className="museum-link mt-5">进场 <ArrowRight className="h-4 w-4" /></button></div>)}</div>
        </section>

        <section id="features" className="museum-section">{sectionTitle('探索入口', '一座馆，不止一张地图', '无论你是第一次来访的观众、正在备课的老师，还是需要核对来源的研究者，都能从这里找到下一步。')}<MagicBento cards={featureCards} onNavigate={(to) => to.startsWith('#') ? scrollTo(to.slice(1)) : navigate(to)} className="md:grid-cols-3" enableStars={false} /></section>

        <section id="latest" aria-labelledby="latest-title" className="museum-section">{sectionTitle('最新收录', '最近进入展柜的品种', '从北方草原到南方水乡，新的记录持续补全这张遗传资源地图。')}<h2 id="latest-title" className="sr-only">最近收录品种</h2><div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{latestBreeds.map((breed) => <button key={breed.id} type="button" onClick={() => openBreed(breed)} className="group overflow-hidden rounded-xl border border-[#34425f] bg-[#11182c] text-left transition-transform duration-300 hover:-translate-y-1 hover:border-[#d4a853]/70"><BreedImage src={breed.image} alt={breed.name} className="aspect-[4/3]" imgClassName="transition-transform duration-500 group-hover:scale-105" /><div className="p-3"><p className="truncate text-sm font-medium text-white">{breed.name}</p><p className="mt-1 truncate text-xs text-[#9aa8bf]">{breed.province} · {breed.category}</p></div></button>)}</div></section>

        <section id="archive" aria-labelledby="archive-title" className="museum-section scroll-mt-8">
          {sectionTitle('数据档案', '每一条记录，都能追回来源', '输入品种名、别名或类别，直接进入卷宗。图片、保护状态和编辑资料都会标明自己的核验边界。')}
          <h2 id="archive-title" className="sr-only">数据档案检索</h2>
          <div className="relative max-w-2xl"><div className="flex items-center gap-3 rounded-xl border border-[#53617e] bg-[#11182c] px-4 shadow-[0_0_0_1px_rgba(212,168,83,.05)] focus-within:border-[#d4a853] focus-within:ring-2 focus-within:ring-[#d4a853]/20"><Search className="h-4 w-4 text-[#9aa8bf]" aria-hidden="true" /><input type="search" aria-label="检索品种档案" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索品种，例如：河田鸡" className="min-h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7f8ca4]" />{query && <button type="button" aria-label="清空检索" onClick={() => setQuery('')} className="rounded-lg p-2 text-[#9aa8bf] museum-ghost-hover"><X className="h-4 w-4" /></button>}<button type="button" className="hidden min-h-10 rounded-lg bg-[#d4a853] px-4 text-sm font-semibold text-[#1a2032] sm:block" onClick={() => scrollTo('archive')}>搜索</button></div>{searchHits.length > 0 && <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-xl border border-[#53617e] bg-[#11182c] p-1 shadow-xl">{searchHits.map((breed) => <li key={breed.id}><button type="button" onClick={() => openBreed(breed)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm text-white museum-ghost-hover"><span>{breed.name}</span><span className="text-xs text-[#9aa8bf]">{breed.province} · {breed.category}</span></button></li>)}</ul>}</div>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#aab5c9]"><VerificationLegend /><span>·</span><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span></div>
          <details className="mt-8 max-w-3xl rounded-xl border border-[#34425f] bg-[#11182c] p-4 text-sm"><summary className="cursor-pointer font-medium text-white">光图数据摘要</summary><div className="mt-4 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-[#34425f] text-[#9aa8bf]"><th className="p-2">指标</th><th className="p-2">数值</th><th className="p-2">口径</th></tr></thead><tbody><tr className="border-b border-[#34425f]/70"><th className="p-2 font-normal text-white">馆藏记录</th><td className="p-2 font-mono text-[#d4a853]">{COLLECTION_SUMMARY.total}</td><td className="p-2 text-[#9aa8bf]">运行时归一化</td></tr><tr className="border-b border-[#34425f]/70"><th className="p-2 font-normal text-white">当前落点</th><td className="p-2 font-mono text-[#d4a853]">{COLLECTION_SUMMARY.mappable}</td><td className="p-2 text-[#9aa8bf]">坐标已核验</td></tr><tr><th className="p-2 font-normal text-white">国家级保护</th><td className="p-2 font-mono text-[#d4a853]">{COLLECTION_SUMMARY.nationalProtectedMatches}</td><td className="p-2 text-[#9aa8bf]">940 号公告匹配</td></tr></tbody></table></div></details>
          <div className="mt-7 flex flex-wrap items-center gap-4 text-sm"><Link to="/about" className="museum-link">看完整馆史与库房 <ArrowRight className="h-4 w-4" /></Link><span className="inline-flex items-center gap-1.5 text-xs text-[#aab5c9]"><ShieldCheck className="h-4 w-4 text-[#d4a853]" aria-hidden="true" />免登录，数据在浏览器本地运行</span></div>
        </section>

        <section id="sources" aria-labelledby="sources-title" className="museum-section scroll-mt-8">
          {sectionTitle('来源与方法', '这座馆如何把资料变成展览', '首页只保留参观者需要知道的核心方法；完整的诚实映射表、质量仪表盘和 AI 披露仍可在馆史与库房中查阅。')}
          <h2 id="sources-title" className="sr-only">数据来源与方法</h2>
          <div className="grid gap-4 lg:grid-cols-3">
            <article className="museum-panel p-5"><p className="text-xs tracking-[0.18em] text-[#d4a853]">01 · 官方名录</p><h3 className="mt-3 font-serif text-xl text-white">先从原始文件开始</h3><p className="mt-2 text-sm leading-6 text-[#aab5c9]">主要依据《国家畜禽遗传资源品种名录（2024 年版）》逐页核对名称、物种和类别。</p><a href={breedSources['nahs-catalog-2024'].url} target="_blank" rel="noreferrer" className="museum-link mt-4">查看官方页面 <ExternalLink className="h-3.5 w-3.5" /></a></article>
            <article className="museum-panel p-5"><p className="text-xs tracking-[0.18em] text-[#d4a853]">02 · 人工核验</p><h3 className="mt-3 font-serif text-xl text-white">让每个字段有边界</h3><p className="mt-2 text-sm leading-6 text-[#aab5c9]">异名归一化、坐标核验和国家级保护匹配均保留口径，无法确认的内容明确标注。</p><Link to="/about" className="museum-link mt-4">阅读核验说明 <ArrowRight className="h-3.5 w-3.5" /></Link></article>
            <article className="museum-panel p-5"><p className="text-xs tracking-[0.18em] text-[#d4a853]">03 · 本地运行</p><h3 className="mt-3 font-serif text-xl text-white">开放、轻量、可复核</h3><p className="mt-2 text-sm leading-6 text-[#aab5c9]">页面无需登录，数据和计算在浏览器本地完成；版本 {COLLECTION_VERSION}，质量检查 {QUALITY_SUMMARY.unitTests} 项。</p><Link to="/about" className="museum-link mt-4">查看完整披露 <ArrowRight className="h-3.5 w-3.5" /></Link></article>
          </div>
        </section>
      </div>
    </div>
  );
}
