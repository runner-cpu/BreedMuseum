import {
  ArrowRight,
  BookOpen,
  Bot,
  Database,
  Download,
  GitCompare,
  Layers3,
  Map,
  Search,
  ShieldCheck,
  Sparkles,
  X,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ChinaMap } from '@/components/ChinaMap';
import { BreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import ChromaGrid from '@/components/effects/ChromaGrid';
import MagicBento from '@/components/effects/MagicBento';
import SpotlightHero from '@/components/effects/SpotlightHero';
import { getBreedById } from '@/data/breedLookup';
import { matchesBreedQuery } from '@/data/breedSearch';
import { type Breed, breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { ARCADE_GAMES } from '@/lib/arcade/games';
import { categoryColors } from '@/lib/categoryIcons';
import { renderCategorySvgIcon } from '@/lib/categorySvgIcons';
import { buildSiteClusters, clustersForLens, type LensId, type SiteCluster } from '@/lib/geo/clusterSites';
import { buildDigest, lightMapSummary } from '@/lib/geo/lightMapData';

const LENSES: Array<{ id: LensId; label: string; hint: string }> = [
  { id: 'all', label: '全部分布', hint: '所有已核验落点记录' },
  { id: 'category', label: '类别构成', hint: '比较不同类别在产区的分量' },
  { id: 'protect', label: '国家级保护', hint: '只看 940 号公告匹配记录' },
  { id: 'risk', label: '濒危之窗', hint: '编辑口径濒危记录，非权威结论' },
];

const LENS_CONCLUSION: Record<LensId, string> = {
  all: `${COLLECTION_SUMMARY.mappable} 条记录落在 ${COLLECTION_SUMMARY.provinces} 个省级行政区的真实产区上`,
  category: '同一类别在不同省份的分量并不平均，这正是地方品种的地域性',
  protect: `${COLLECTION_SUMMARY.nationalProtectedMatches} 个品种拥有国家级身份，来自农业农村部第 940 号公告`,
  risk: `${COLLECTION_SUMMARY.editorialEndangered} 个记录被编辑标注为濒危，属于编辑口径`,
};

const sectionTitle = (eyebrow: string, title: string, body?: string) => (
  <div className="mb-7 max-w-3xl">
    <p className="museum-eyebrow">{eyebrow}</p>
    <h2 className="mt-2 font-serif text-3xl tracking-[-0.025em] text-white sm:text-4xl">{title}</h2>
    {body && <p className="mt-3 max-w-2xl text-sm leading-7 text-[#aab5c9] sm:text-base">{body}</p>}
  </div>
);

export default function LightMapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [lens, setLens] = useState<LensId>('all');
  const [category, setCategory] = useState<string | null>(null);
  const [province, setProvince] = useState<string | null>(null);
  const [query, setQuery] = useState(params.get('search') ?? '');
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(() => getBreedById(params.get('breed_id')));
  const digest = useMemo(() => buildDigest(), []);
  const clusters = useMemo(() => buildSiteClusters(), []);
  const visibleClusters = useMemo(() => clustersForLens(clusters, lens, category), [clusters, lens, category]);
  const summary = useMemo(() => lightMapSummary(visibleClusters), [visibleClusters]);
  const activeProvince = useMemo(
    () => (province ? digest.provinces.find((item) => item.province === province) ?? null : null),
    [digest, province],
  );
  const searchHits = useMemo(
    () => (query.trim().length < 2 ? [] : breeds.filter((breed) => matchesBreedQuery(breed, query.trim())).slice(0, 7)),
    [query],
  );
  const categoryTally = useMemo(
    () => categories
      .map((item) => ({ category: item, count: digest.byCategory.get(item) ?? 0 }))
      .filter((item) => item.count > 0),
    [digest],
  );
  const provinceTally = useMemo(() => digest.provinces.filter((item) => item.province !== '待核验').slice(0, 8), [digest]);
  const latestBreeds = useMemo(() => breeds.filter((breed) => breed.image).slice(0, 8), []);
  const defaultPreviewBreed = useMemo(
    () => breeds.find((breed) => breed.image && breed.province !== '待核验') ?? breeds[0] ?? null,
    [],
  );
  const previewBreed = selectedBreed ?? (province ? breeds.find((breed) => breed.province === province) ?? null : null) ?? defaultPreviewBreed;
  const handleBreed = (breed: Breed) => {
    setSelectedBreed(breed);
    navigate(`/breed/${breed.id}`);
  };
  const handleCluster = (cluster: SiteCluster) => {
    setProvince(cluster.province);
    if (cluster.members.length === 1) {
      const breed = breeds.find((item) => item.id === cluster.members[0].id);
      if (breed) setSelectedBreed(breed);
    }
  };
  const scrollTo = (id: string) => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  const searchFromHero = (value: string) => {
    setQuery(value);
    scrollTo('archive');
  };

  const kpis = [
    { title: String(COLLECTION_SUMMARY.total), subtitle: '已收录品种', handle: '名录归一化记录', borderColor: '#5064d8', gradient: 'linear-gradient(135deg,#1c2c66,#17203f)' },
    { title: String(COLLECTION_SUMMARY.provinces), subtitle: '覆盖省份', handle: '省级行政区', borderColor: '#22b883', gradient: 'linear-gradient(135deg,#113f38,#162d35)' },
    { title: String(COLLECTION_SUMMARY.categories), subtitle: '畜禽类别', handle: '按名录分组', borderColor: '#d4a853', gradient: 'linear-gradient(135deg,#4a3715,#2b251a)' },
    { title: String(COLLECTION_SUMMARY.nationalProtectedMatches), subtitle: '保护品种', handle: '940 号公告匹配', borderColor: '#e87472', gradient: 'linear-gradient(135deg,#542522,#2e1d29)' },
  ];

  const featureCards = [
    { icon: <Map className="h-5 w-5" />, label: 'EXPLORE', title: '品种地图探索', description: '在中国省域轮廓上查看产区、类别与保护状态。', to: '#map' },
    { icon: <Database className="h-5 w-5" />, label: 'READ DATA', title: '数据看板', description: '用省份排行和类别占比读懂馆藏结构。', to: '/dashboard' },
    { icon: <BookOpen className="h-5 w-5" />, label: 'ARCHIVE', title: '品种百科', description: '从名称、别名与产地进入一份可追溯卷宗。', to: '#archive' },
    { icon: <Bot className="h-5 w-5" />, label: 'ASK', title: 'AI 智能助手', description: '把问题拆成可核验的字段，再回到来源。', to: '/ai' },
    { icon: <GitCompare className="h-5 w-5" />, label: 'COMPARE', title: '品种对比', description: '并排查看不同品种的体貌与生产性能。', to: '/compare' },
    { icon: <Download className="h-5 w-5" />, label: 'EXPORT', title: '数据导出', description: '把图表与筛选结果带走，用于教学和研究。', to: '/dashboard' },
  ];

  return (
    <div className="museum-home min-h-full text-[#edf2fb]">
      <SpotlightHero
        titleTop="中国地方畜禽"
        titleBottom="品种数字博物馆"
        badge="守护中华农业文明基因"
        cta="开始探索"
        searchPh="搜索品种名称，如 河田鸡、秦川牛..."
        searchBtn="搜索"
        descLeft="收录全国地方畜禽遗传资源，让每一个名字都能回到它的土地。"
        descRight="从地图开始，经过数据与故事，最后回到一份有来源的档案。"
        onExplore={() => scrollTo('overview')}
        onSearch={searchFromHero}
      />

      <div className="museum-home-inner">
        <section id="overview" className="museum-section scroll-mt-8">
          {sectionTitle('核心数据看板', '一眼看懂这座馆藏的规模', '数字不是装饰，它们来自同一份经过清洗、归一化和来源核验的馆藏记录。')}
          <ChromaGrid items={kpis} columns={4} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.2fr_.8fr]">
            <div className="museum-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-[#aab5c9]">类别构成</p><h3 className="mt-1 font-serif text-xl text-white">15 类地方遗传资源</h3></div><Layers3 className="h-5 w-5 text-[#d4a853]" aria-hidden="true" /></div>
              <div className="mt-6 space-y-3">{categoryTally.slice(0, 8).map((item) => { const width = Math.max(8, (item.count / categoryTally[0].count) * 100); return <button key={item.category} type="button" className="group flex w-full items-center gap-3 text-left" onClick={() => { setLens('category'); setCategory(item.category); scrollTo('map'); }}><span className="w-14 shrink-0 text-xs text-[#aab5c9]">{item.category}</span><span className="museum-subtle-track h-2 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full transition-all duration-500 group-hover:brightness-125" style={{ width: `${width}%`, backgroundColor: categoryColors[item.category] }} /></span><span className="w-10 text-right font-mono text-xs text-white">{item.count}</span></button>; })}</div>
            </div>
            <div className="museum-panel p-5 sm:p-6">
              <div className="flex items-center justify-between gap-4"><div><p className="text-xs text-[#aab5c9]">省份排行</p><h3 className="mt-1 font-serif text-xl text-white">最密集的馆藏区域</h3></div><span className="font-mono text-xs text-[#d4a853]">TOP 8</span></div>
              <div className="mt-6 space-y-3">{provinceTally.map((item, index) => <div key={item.province} className="flex items-center gap-3"><span className="w-5 font-mono text-xs text-[#74819a]">{String(index + 1).padStart(2, '0')}</span><span className="w-14 shrink-0 text-xs text-[#d5dbea]">{item.province}</span><span className="museum-subtle-track h-1.5 flex-1 overflow-hidden rounded-full"><span className="block h-full rounded-full bg-[#7a9a6b]" style={{ width: `${Math.max(8, (item.total / provinceTally[0].total) * 100)}%` }} /></span><span className="font-mono text-xs text-white">{item.total}</span></div>)}</div>
            </div>
          </div>
        </section>

        <section id="map" aria-labelledby="map-title" className="museum-section scroll-mt-8">
          {sectionTitle('品种地图', '把全国馆藏放回它们的土地', '地图是入口，右侧详情是证据。点击省份、产区或类别，观察一张图如何切换成不同的叙事。')}
          <p className="mb-5 font-serif text-2xl text-[#d4a853]">你家的省份亮了几个？</p>
          <div className="museum-map-workbench">
            <aside className="museum-rail" aria-label="类别筛选">
              <p className="px-3 pb-2 text-[10px] tracking-[0.22em] text-[#7e8da8]">FILTER</p>
              <button type="button" className={`museum-rail-item ${lens === 'all' ? 'is-active' : ''}`} onClick={() => { setLens('all'); setCategory(null); }}><span className="museum-rail-dot" />全部</button>
              {categories.map((item) => <button type="button" key={item} className={`museum-rail-item ${lens === 'category' && category === item ? 'is-active' : ''}`} onClick={() => { setLens('category'); setCategory(item); }}><span className="museum-rail-icon">{renderCategorySvgIcon(item, categoryColors[item], 22)}</span>{item}</button>)}
            </aside>
            <div className="museum-map-card">
              <div className="flex flex-col gap-4 border-b border-[#34425f] p-4 sm:flex-row sm:items-end sm:justify-between">
                <div><p className="text-xs text-[#8896ae]">当前视角</p><h3 id="map-title" className="mt-1 font-serif text-2xl text-white">一张地图，四个看法</h3><p className="mt-2 max-w-xl text-xs leading-6 text-[#aab5c9]">{LENS_CONCLUSION[lens]}{lens === 'all' && `。另有 ${COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点。`}</p></div>
                <div className="flex flex-wrap gap-1 rounded-xl border border-[#34425f] bg-[#11182c] p-1" role="tablist" aria-label="光图镜头">{LENSES.map((item) => <button key={item.id} type="button" role="tab" title={item.hint} aria-selected={lens === item.id} onClick={() => { setLens(item.id); if (item.id !== 'category') setCategory(null); }} className={`min-h-9 rounded-lg px-3 text-xs transition-colors sm:text-sm ${lens === item.id ? 'bg-[#d4a853] font-semibold text-[#1a2032]' : 'museum-ghost-hover text-[#aab5c9]'}`}>{item.label}</button>)}</div>
              </div>
              <div className="min-h-[480px] p-1 sm:min-h-[600px] sm:p-3"><ChinaMap breeds={breeds} selectedProvince={province} selectedBreed={selectedBreed} pulseId={selectedBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} darkSurface showProvinceLabels={false} onProvinceClick={(name) => setProvince(name === province ? null : name)} onBreedClick={handleBreed} onClusterClick={handleCluster} onClearSelection={() => setProvince(null)} /></div>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#34425f] px-4 py-3 text-xs text-[#aab5c9]"><span>{summary.provinces} 个省 · {summary.clusters} 个产区簇 · {summary.mappable} 条当前镜头记录</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#d4a853]" />金环 = 国家级保护匹配</span></div>
            </div>
            <aside className="museum-detail" aria-label="当前品种详情">
              {previewBreed ? <><BreedImage src={previewBreed.image} alt={previewBreed.name} className="h-44 rounded-xl border border-[#34425f]" /><div className="mt-4 flex items-start justify-between gap-3"><div><h3 className="font-serif text-2xl text-white">{previewBreed.name}</h3><p className="mt-1 text-xs text-[#9aa8bf]">{previewBreed.englishName}</p></div><span className="museum-status">{previewBreed.endangered}</span></div><dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[#7f8ca4]">产区</dt><dd className="mt-1 text-[#e5eaf4]">{previewBreed.province}</dd></div><div><dt className="text-[#7f8ca4]">类别</dt><dd className="mt-1 text-[#e5eaf4]">{previewBreed.category}</dd></div></dl><p className="mt-5 line-clamp-4 text-sm leading-6 text-[#c1c9d8]">{previewBreed.story}</p><button type="button" onClick={() => handleBreed(previewBreed)} className="museum-link mt-5">打开完整卷宗 <ArrowRight className="h-4 w-4" /></button></> : <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center"><Sparkles className="h-8 w-8 text-[#d4a853]" /><h3 className="mt-4 font-serif text-xl text-white">选择一个点位</h3><p className="mt-2 max-w-[220px] text-sm leading-6 text-[#9aa8bf]">地图上的每个点都对应一组产区记录，点击后在这里查看。</p></div>}
              {activeProvince && <div role="region" aria-label={`${activeProvince.province}省份速览`} className="mt-6 border-t border-[#34425f] pt-4"><p className="text-xs text-[#7f8ca4]">省份速览</p><p className="mt-1 text-lg text-white">{activeProvince.province} <span className="font-mono text-sm text-[#d4a853]">{activeProvince.total} 条</span></p><p className="mt-1 text-xs text-[#9aa8bf]">已落点 {activeProvince.mappable} · 保护 {activeProvince.nationalProtected} · 濒危 {activeProvince.endangered}</p></div>}
            </aside>
          </div>
          <div className="mt-4 flex flex-wrap gap-2" aria-label="地图镜头说明">{lens === 'category' && categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(category === item ? null : item)} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs transition-colors ${category === item ? 'border-[#d4a853] bg-[#d4a853]/15 text-[#e7c67d]' : 'border-[#34425f] museum-ghost-hover text-[#aab5c9]'}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColors[item] }} />{item}</button>)}</div>
        </section>

        <section id="play" aria-labelledby="play-title" className="museum-section scroll-mt-8">{sectionTitle('互动展厅', '把一条记录变成一次亲手完成的探索', '三台展教装置从馆藏字段出发，让观众在地图、剪影和问答之间建立自己的记忆。')}<div className="grid gap-4 md:grid-cols-3">{ARCADE_GAMES.map((game) => <div key={game.id} className="museum-panel p-5"><p className="text-xs text-[#d4a853]">{game.skill} · {game.rounds}</p><h3 className="mt-2 font-serif text-xl text-white">{game.title}</h3><p className="mt-2 text-sm leading-6 text-[#aab5c9]">{game.summary}</p><button type="button" onClick={() => navigate(`/arcade/${game.id}`)} className="museum-link mt-5">进场 <ArrowRight className="h-4 w-4" /></button></div>)}</div></section>

        <section id="features" className="museum-section">{sectionTitle('核心功能', '一座馆，不止一张地图', '让不同类型的观众都能找到下一步：浏览、提问、比较，或者把数据带回课堂。')}<MagicBento cards={featureCards} onNavigate={(to) => to.startsWith('#') ? scrollTo(to.slice(1)) : navigate(to)} className="md:grid-cols-3" enableStars={false} /></section>

        <section id="latest" className="museum-section">{sectionTitle('最新收录', '最近进入展柜的品种', '从北方草原到南方水乡，新的记录持续补全这张遗传资源地图。')}<div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">{latestBreeds.map((breed) => <button key={breed.id} type="button" onClick={() => handleBreed(breed)} className="group overflow-hidden rounded-xl border border-[#34425f] bg-[#11182c] text-left transition-transform duration-300 hover:-translate-y-1 hover:border-[#d4a853]/70"><BreedImage src={breed.image} alt={breed.name} className="aspect-[4/3]" imgClassName="transition-transform duration-500 group-hover:scale-105" /><div className="p-3"><p className="truncate text-sm font-medium text-white">{breed.name}</p><p className="mt-1 truncate text-xs text-[#9aa8bf]">{breed.province} · {breed.category}</p></div></button>)}</div></section>

        <section id="archive" aria-labelledby="archive-title" className="museum-section scroll-mt-8">{sectionTitle('数据档案', '每一条记录，都能追回来源', '输入品种名、别名或类别，直接进入卷宗。图片、保护状态和编辑资料都会标明自己的核验边界。')}<h2 id="archive-title" className="sr-only">数据档案检索</h2><div className="relative max-w-2xl"><div className="flex items-center gap-3 rounded-xl border border-[#53617e] bg-[#11182c] px-4 shadow-[0_0_0_1px_rgba(212,168,83,.05)] focus-within:border-[#d4a853] focus-within:ring-2 focus-within:ring-[#d4a853]/20"><Search className="h-4 w-4 text-[#9aa8bf]" aria-hidden="true" /><input type="search" aria-label="检索品种档案" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索品种，例如：河田鸡" className="min-h-14 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7f8ca4]" />{query && <button type="button" aria-label="清空检索" onClick={() => setQuery('')} className="rounded-lg p-2 text-[#9aa8bf] museum-ghost-hover"><X className="h-4 w-4" /></button>}<button type="button" className="hidden min-h-10 rounded-lg bg-[#d4a853] px-4 text-sm font-semibold text-[#1a2032] sm:block" onClick={() => scrollTo('archive')}>搜索</button></div>{searchHits.length > 0 && <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-xl border border-[#53617e] bg-[#11182c] p-1 shadow-xl">{searchHits.map((breed) => <li key={breed.id}><button type="button" onClick={() => handleBreed(breed)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm text-white museum-ghost-hover"><span>{breed.name}</span><span className="text-xs text-[#9aa8bf]">{breed.province} · {breed.category}</span></button></li>)}</ul>}</div><div className="mt-4 flex flex-wrap items-center gap-2 text-xs text-[#aab5c9]"><VerificationLegend /><span>·</span><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span></div><details className="mt-8 max-w-3xl rounded-xl border border-[#34425f] bg-[#11182c] p-4 text-sm"><summary className="cursor-pointer font-medium text-white">光图数据摘要</summary><div className="mt-4 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-[#34425f] text-[#9aa8bf]"><th className="p-2">指标</th><th className="p-2">数值</th><th className="p-2">口径</th></tr></thead><tbody><tr className="border-b border-[#34425f]/70"><th className="p-2 font-normal text-white">馆藏记录</th><td className="p-2 font-mono text-[#d4a853]">{COLLECTION_SUMMARY.total}</td><td className="p-2 text-[#9aa8bf]">运行时归一化</td></tr><tr className="border-b border-[#34425f]/70"><th className="p-2 font-normal text-white">当前落点</th><td className="p-2 font-mono text-[#d4a853]">{COLLECTION_SUMMARY.mappable}</td><td className="p-2 text-[#9aa8bf]">坐标已核验</td></tr><tr><th className="p-2 font-normal text-white">国家级保护</th><td className="p-2 font-mono text-[#d4a853]">{COLLECTION_SUMMARY.nationalProtectedMatches}</td><td className="p-2 text-[#9aa8bf]">940 号公告匹配</td></tr></tbody></table></div></details><div className="mt-7 flex flex-wrap items-center gap-4 text-sm"><a href="/about" className="museum-link">看馆史与库房 <ArrowRight className="h-4 w-4" /></a><span className="inline-flex items-center gap-1.5 text-xs text-[#aab5c9]"><ShieldCheck className="h-4 w-4 text-[#d4a853]" aria-hidden="true" />免登录，数据在浏览器本地运行</span></div></section>
      </div>
    </div>
  );
}
