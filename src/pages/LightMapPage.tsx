import { useMemo, useState } from 'react';
import { ArrowDown, ArrowRight, Search, ShieldCheck, Sparkles, X } from 'lucide-react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { breeds, type Breed } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildDigest, lightMapSummary } from '@/lib/geo/lightMapData';
import { buildSiteClusters, clustersForLens, type LensId, type SiteCluster } from '@/lib/geo/clusterSites';
import { matchesBreedQuery } from '@/data/breedSearch';
import { getBreedById } from '@/data/breedLookup';
import { categoryColors } from '@/lib/categoryIcons';
import { ChinaMap } from '@/components/ChinaMap';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { ExhibitCard } from '@/components/home/ExhibitCard';
import { ProvinceQuickStrip } from '@/components/home/ProvinceQuickStrip';
import { ARCADE_GAMES } from '@/lib/arcade/games';

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
  const activeProvince = useMemo(() => province ? digest.provinces.find((item) => item.province === province) ?? null : null, [digest, province]);
  const searchHits = useMemo(() => query.trim().length < 2 ? [] : breeds.filter((breed) => matchesBreedQuery(breed, query.trim())).slice(0, 7), [query]);
  const handleBreed = (breed: Breed) => { setSelectedBreed(breed); navigate(`/breed/${breed.id}`); };
  const handleCluster = (cluster: SiteCluster) => { setProvince(cluster.province); if (cluster.members.length === 1) { const breed = breeds.find((item) => item.id === cluster.members[0].id); if (breed) setSelectedBreed(breed); } };

  return (
    <div className="min-h-full bg-stage text-stage-fg">
      <div className="mx-auto w-full max-w-[1440px]">
        <section className="relative overflow-hidden border-b border-stage-border px-4 pb-12 pt-10 sm:px-8 lg:px-12 lg:pb-14 lg:pt-14">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:radial-gradient(circle_at_80%_20%,rgba(212,168,83,0.16),transparent_28%),linear-gradient(120deg,transparent_0%,rgba(29,58,45,0.06)_42%,transparent_72%)]" />
          <div className="relative grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div className="max-w-3xl space-y-5">
              <p className="flex items-center gap-2 text-xs font-medium tracking-[0.24em] text-stage-gold"><Sparkles className="h-4 w-4" aria-hidden="true" />一座把来源摊开给观众看的数字博物馆</p>
              <h1 className="max-w-3xl font-serif text-4xl leading-[1.05] tracking-[-0.03em] sm:text-5xl lg:text-6xl">1186 个地方品种，<span className="text-stage-gold">你家的省份</span>亮了几个？</h1>
              <p className="max-w-2xl text-base leading-relaxed text-stage-muted sm:text-lg">看真实产区，玩一局由核验字段生成的互动题，再回到卷宗查官方来源。每一步都知道下一步去哪里。</p>
              <div className="flex flex-wrap items-center gap-3"><a href="#map" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-stage-fg px-5 text-sm font-semibold text-stage shadow-sm transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold">看分布 <ArrowDown className="h-4 w-4" aria-hidden="true" /></a><a href="#play" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-stage-border px-5 text-sm font-semibold transition-colors hover:bg-stage-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stage-gold">去互动 <ArrowRight className="h-4 w-4" aria-hidden="true" /></a></div>
            </div>
            <dl className="grid grid-cols-3 gap-2 sm:max-w-lg lg:ml-auto lg:w-full">{[{ value: COLLECTION_SUMMARY.total, label: '收录记录' }, { value: COLLECTION_SUMMARY.provinces, label: '省级行政区' }, { value: COLLECTION_SUMMARY.nationalProtectedMatches, label: '国家级保护' }].map((stat) => <div key={stat.label} className="rounded-2xl border border-stage-border bg-stage-panel/80 p-3 backdrop-blur sm:p-4"><dd className="font-mono text-2xl font-semibold tabular-nums text-stage-gold sm:text-3xl">{stat.value}</dd><dt className="mt-1 text-xs text-stage-muted">{stat.label}</dt></div>)}</dl>
          </div>
        </section>

        <section id="map" aria-labelledby="map-title" className="scroll-mt-8 border-b border-stage-border px-4 py-10 sm:px-8 lg:px-12 lg:py-14">
          <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between"><div className="space-y-2"><p className="text-xs font-medium tracking-[0.2em] text-stage-gold">看 · 数据可视化</p><h2 id="map-title" className="font-serif text-3xl tracking-[-0.02em] sm:text-4xl">一张地图，四个看法</h2><p className="max-w-2xl text-sm leading-relaxed text-stage-muted">{LENS_CONCLUSION[lens]}{lens === 'all' && `。另有 ${COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点。`}</p></div><div className="flex flex-wrap gap-1 rounded-full border border-stage-border bg-stage-panel p-1" role="tablist" aria-label="光图镜头">{LENSES.map((item) => <button key={item.id} type="button" role="tab" title={item.hint} aria-selected={lens === item.id} onClick={() => { setLens(item.id); if (item.id !== 'category') setCategory(null); }} className={`min-h-9 rounded-full px-3 text-xs transition-colors sm:text-sm ${lens === item.id ? 'bg-stage-gold/20 font-semibold text-stage-gold' : 'text-stage-muted hover:bg-stage-soft hover:text-stage-fg'}`}>{item.label}</button>)}</div></div>
          {lens === 'category' && <div className="mb-4 flex flex-wrap gap-1.5" aria-label="类别筛选">{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(category === item ? null : item)} className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 text-xs transition-colors ${category === item ? 'border-stage-gold bg-stage-gold/15 text-stage-gold' : 'border-stage-border text-stage-muted hover:bg-stage-soft'}`}><span className="h-2 w-2 rounded-full" style={{ background: categoryColors[item] ?? '#8d9a92' }} aria-hidden="true" />{item}</button>)}</div>}
          <div data-lens={lens} className="overflow-hidden rounded-3xl border border-stage-border bg-stage-panel shadow-sm"><div className="min-h-[540px] p-2 sm:p-4 lg:min-h-[620px]"><ChinaMap breeds={breeds} selectedProvince={province} selectedBreed={selectedBreed} pulseId={selectedBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} onProvinceClick={(name) => setProvince(name === province ? null : name)} onBreedClick={handleBreed} onClusterClick={handleCluster} onClearSelection={() => setProvince(null)} /></div><div className="flex flex-wrap items-center justify-between gap-3 border-t border-stage-border px-4 py-3 text-xs text-stage-muted sm:px-6"><span>{summary.provinces} 个省 · {summary.clusters} 个产区簇 · {summary.mappable} 条当前镜头记录</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-stage-gold" />金环 = 国家级保护匹配</span></div></div>
          <ProvinceQuickStrip province={activeProvince} breeds={breeds} onBreedClick={handleBreed} onClose={() => setProvince(null)} className="mt-4" />
        </section>

        <section id="play" aria-labelledby="play-title" className="scroll-mt-8 border-b border-stage-border px-4 py-10 sm:px-8 lg:px-12 lg:py-14"><div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-xs font-medium tracking-[0.2em] text-stage-gold">玩 · 互动体验</p><h2 id="play-title" className="mt-2 font-serif text-3xl tracking-[-0.02em] sm:text-4xl">三台装置，动手认识一条记录</h2></div><a href="#archive" className="inline-flex items-center gap-1 text-sm text-stage-gold underline-offset-4 hover:underline">先去查卷宗 <ArrowRight className="h-4 w-4" aria-hidden="true" /></a></div><div className="grid gap-4 md:grid-cols-3">{ARCADE_GAMES.map((game) => <ExhibitCard key={game.id} game={game} />)}</div></section>

        <section id="archive" aria-labelledby="archive-title" className="scroll-mt-8 px-4 py-10 sm:px-8 lg:px-12 lg:py-14"><div className="grid gap-6 lg:grid-cols-[1fr_0.9fr] lg:items-start"><div className="space-y-3"><p className="text-xs font-medium tracking-[0.2em] text-stage-gold">查 · 数据档案</p><h2 id="archive-title" className="font-serif text-3xl tracking-[-0.02em]">每一条记录，都能追回来源</h2><p className="max-w-xl text-sm leading-relaxed text-stage-muted">输入品种名、别名或类别，直接进入卷宗。图片、保护状态和编辑资料都会标明自己的核验边界。</p><div className="flex flex-wrap items-center gap-2 text-xs text-stage-muted"><VerificationLegend /><span>·</span><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span></div></div><div className="relative"><div className="flex items-center gap-2 rounded-2xl border border-stage-border bg-stage-panel px-3 shadow-sm focus-within:border-stage-gold/70 focus-within:ring-2 focus-within:ring-stage-gold/20"><Search className="h-4 w-4 text-stage-muted" aria-hidden="true" /><input type="search" aria-label="检索品种档案" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="检索品种，例如：河田鸡" className="min-h-12 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-stage-muted/70" />{query && <button type="button" aria-label="清空检索" onClick={() => setQuery('')} className="rounded-full p-1 text-stage-muted hover:bg-stage-soft"><X className="h-4 w-4" /></button>}</div>{searchHits.length > 0 && <ul className="absolute inset-x-0 top-full z-20 mt-2 max-h-64 overflow-auto rounded-2xl border border-stage-border bg-stage-panel p-1 shadow-xl">{searchHits.map((breed) => <li key={breed.id}><button type="button" onClick={() => handleBreed(breed)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-xl px-3 text-left text-sm hover:bg-stage-soft"><span>{breed.name}</span><span className="text-xs text-stage-muted">{breed.province} · {breed.category}</span></button></li>)}</ul>}</div></div><details className="mt-8 rounded-2xl border border-stage-border bg-stage-panel p-4 text-sm"><summary className="cursor-pointer font-medium">光图数据摘要</summary><div className="mt-4 overflow-auto"><table className="w-full min-w-[560px] text-left text-xs"><thead><tr className="border-b border-stage-border text-stage-muted"><th className="p-2">指标</th><th className="p-2">数值</th><th className="p-2">口径</th></tr></thead><tbody><tr className="border-b border-stage-border/50"><th className="p-2 font-normal">馆藏记录</th><td className="p-2 font-mono">{COLLECTION_SUMMARY.total}</td><td className="p-2 text-stage-muted">运行时归一化</td></tr><tr className="border-b border-stage-border/50"><th className="p-2 font-normal">当前落点</th><td className="p-2 font-mono">{COLLECTION_SUMMARY.mappable}</td><td className="p-2 text-stage-muted">坐标已核验</td></tr><tr><th className="p-2 font-normal">国家级保护</th><td className="p-2 font-mono">{COLLECTION_SUMMARY.nationalProtectedMatches}</td><td className="p-2 text-stage-muted">940 号公告匹配</td></tr></tbody></table></div></details><div className="mt-8 flex flex-wrap items-center gap-4 text-sm"><a href="/about" className="inline-flex items-center gap-1.5 font-medium text-stage-gold hover:underline">看馆史与库房 <ArrowRight className="h-4 w-4" aria-hidden="true" /></a><span className="inline-flex items-center gap-1.5 text-stage-muted"><ShieldCheck className="h-4 w-4 text-stage-gold" aria-hidden="true" />免登录，数据在浏览器本地运行</span></div></section>
      </div>
    </div>
  );
}
