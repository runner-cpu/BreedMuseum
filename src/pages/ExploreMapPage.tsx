import { ArrowLeft, ArrowRight, Check, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChinaMap, type LensId } from '@/components/ChinaMap';
import { BreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { useSettings } from '@/contexts/AppSettings';
import { useMuseum } from '@/contexts/MuseumContext';
import { getBreedById } from '@/data/breedLookup';
import { matchesBreedQuery } from '@/data/breedSearch';
import { type Breed, breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildSiteClusters, clustersForLens, type SiteCluster } from '@/lib/geo/clusterSites';
import { buildDigest, lightMapSummary } from '@/lib/geo/lightMapData';

const LENSES: Array<{ id: LensId; label: string; hint: string }> = [
  { id: 'all', label: '全部分布', hint: '所有已核验落点记录' },
  { id: 'category', label: '类别构成', hint: '比较不同类别在产区的分量' },
  { id: 'protect', label: '国家级保护', hint: '只看 940 号公告匹配记录' },
  { id: 'risk', label: '濒危之窗', hint: '编辑口径濒危记录，非权威结论' },
];

const categoryFromParams = (params: URLSearchParams) => {
  const requested = params.get('category');
  return categories.find((category) => category === requested) ?? null;
};

/**
 * 地图探索页：把地图作为唯一主角，给首页的介绍内容留出呼吸空间。
 * 所有点位均链接到馆藏卷宗，镜头只改变筛选口径，不改变原始记录。
 */
export default function ExploreMapPage() {
  const { isDark } = useSettings();
  const { isInCompare, toggleCompare } = useMuseum();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [lens, setLens] = useState<LensId>(() => categoryFromParams(params) ? 'category' : 'all');
  const [category, setCategory] = useState<string | null>(() => categoryFromParams(params));
  const [province, setProvince] = useState<string | null>(() => params.get('province'));
  const [query, setQuery] = useState(params.get('search') ?? '');
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(params.get('breed_id') || params.get('province')));
  const queryString = params.toString();

  // 首页的类别/省份排行通过 query 直达探索页；同步 URL 变化，
  // 也让浏览器前进/后退保持与筛选状态一致。
  useEffect(() => {
    const requestedCategory = categoryFromParams(params);
    setCategory(requestedCategory);
    setLens(requestedCategory ? 'category' : 'all');
    setProvince(params.get('province'));
    setQuery(params.get('search') ?? '');
  }, [params, queryString]);
  // 参考原站，桌面右侧详情卡首屏就有一条代表性记录；用户仍可点击任意点位切换。
  // 带查询参数时优先展示参数指定的记录，避免刷新后丢失上下文。
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(() => getBreedById(params.get('breed_id')) ?? breeds[0] ?? null);
  const digest = useMemo(() => buildDigest(), []);
  const clusters = useMemo(() => buildSiteClusters(breeds), []);
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
  const previewBreed = selectedBreed
    ?? (province ? breeds.find((breed) => breed.province === province) ?? null : null);

  const openBreed = (breed: Breed) => {
    setSelectedBreed(breed);
    setMobileDetailOpen(true);
  };
  const handleCluster = (cluster: SiteCluster) => {
    setMobileDetailOpen(true);
    setProvince(cluster.province);
    // 产区簇可能包含多个品种；用簇内第一条记录作为详情预览，避免点击地图后右侧仍停留在旧省份。
    const breed = breeds.find((item) => item.id === cluster.members[0]?.id);
    if (breed) setSelectedBreed(breed);
  };
  const handleProvinceClick = (name: string) => {
    setMobileDetailOpen(true);
    const nextProvince = name === province ? null : name;
    setProvince(nextProvince);
    if (nextProvince) {
      const breed = breeds.find((item) => item.province === nextProvince);
      if (breed) setSelectedBreed(breed);
    } else {
      setSelectedBreed(null);
    }
  };

  return (
    <div className="museum-home museum-explore-page min-h-full text-[var(--museum-fg)]">
      <div className="museum-home-inner px-3 py-3 sm:px-5 sm:py-4 lg:px-6">
        <header className="mb-3 flex flex-wrap items-center gap-3 border-b border-[var(--museum-line)] pb-3">
          <Link to="/" className="museum-link inline-flex" aria-label="返回首页"><ArrowLeft className="h-4 w-4" />返回首页</Link>
          <div className="min-w-0 flex-1">
            <p className="museum-eyebrow">EXPLORE · 光图观测站</p>
            <h1 className="mt-1 truncate font-serif text-xl tracking-[-0.02em] text-[var(--museum-fg)] sm:text-2xl">地图探索</h1>
          </div>
          <div className="relative w-full sm:w-[min(20rem,42vw)]">
            <label htmlFor="explore-search" className="sr-only">检索品种档案</label>
            <div className="relative flex items-center gap-2 rounded-lg border border-[var(--museum-line)] bg-[var(--museum-panel)] px-3 focus-within:border-[#d4a853] focus-within:ring-2 focus-within:ring-[#d4a853]/20">
              <Search className="h-4 w-4 shrink-0 text-[var(--museum-muted)]" aria-hidden="true" />
              <input id="explore-search" type="search" aria-label="检索品种档案" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索品种、产区……" className="min-h-10 min-w-0 flex-1 bg-transparent text-sm text-[var(--museum-fg)] outline-none placeholder:text-[var(--museum-muted)]" />
              {query && <button type="button" aria-label="清空检索" onClick={() => setQuery('')} className="rounded-md px-2 py-1 text-xs text-[var(--museum-muted)] hover:bg-[var(--museum-panel-raised)]">清除</button>}
              {searchHits.length > 0 && <ul className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-[var(--museum-line)] bg-[var(--museum-panel)] p-1 shadow-2xl">{searchHits.map((breed) => <li key={breed.id}><button type="button" onClick={() => openBreed(breed)} className="flex min-h-11 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm text-[var(--museum-fg)] hover:bg-[var(--museum-panel-raised)]"><span>{breed.name}</span><span className="text-xs text-[var(--museum-muted)]">{breed.province} · {breed.category}</span></button></li>)}</ul>}
            </div>
          </div>
        </header>

        <div className="museum-map-workbench museum-map-workbench--focus">
          <section className="museum-map-card museum-map-card--focus" aria-labelledby="explore-map-title">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--museum-line)] bg-[var(--museum-panel)] px-3 py-2">
              <div className="flex items-center gap-3"><h2 id="explore-map-title" className="font-serif text-base text-[var(--museum-fg)] sm:text-lg">全国品种分布</h2><span className="font-mono text-xs text-[var(--museum-muted)]">{summary.mappable.toLocaleString()} 条 · {summary.provinces} 省</span></div>
              <div className="flex flex-wrap items-center justify-end gap-1.5" role="tablist" aria-label="地图镜头">
                {LENSES.filter((item) => item.id !== 'category').map((item) => <button key={item.id} type="button" role="tab" title={item.hint} aria-selected={lens === item.id} onClick={() => { setLens(item.id); setCategory(null); }} className={`min-h-8 rounded-md px-2.5 text-xs transition-colors sm:px-3 ${lens === item.id ? 'bg-[#d4a853] font-semibold text-[#1a2032]' : 'museum-ghost-hover text-[var(--museum-muted)]'}`}>{item.label}</button>)}
                <label className="sr-only" htmlFor="map-category-filter">按类别筛选地图</label>
                <select id="map-category-filter" aria-label="按类别筛选地图" value={lens === 'category' ? (category ?? '') : ''} onChange={(event) => { const next = event.target.value; setCategory(next || null); setLens(next ? 'category' : 'all'); }} className="min-h-8 max-w-[8.5rem] rounded-md border border-[var(--museum-line)] bg-transparent px-2 text-xs text-[var(--museum-fg)] outline-none focus:border-[#d4a853]">
                  <option value="">类别</option>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </div>
            </div>
            <div className="museum-map-canvas"><ChinaMap breeds={breeds} selectedProvince={province} selectedBreed={selectedBreed} pulseId={selectedBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} darkSurface={isDark} showProvinceLabels={false} onProvinceClick={handleProvinceClick} onBreedClick={openBreed} onClusterClick={handleCluster} onClearSelection={() => { setProvince(null); setSelectedBreed(null); setMobileDetailOpen(false); }} /></div>
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[var(--museum-line)] px-3 py-2 text-[11px] text-[var(--museum-muted)]"><span>{summary.clusters} 个产区簇 · {summary.mappable} 条落点记录</span><span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#d4a853]" />点击圆点查看品种</span></div>
          </section>

          <aside className={`museum-detail museum-detail--compact ${mobileDetailOpen ? 'is-open' : ''}`} aria-label="当前品种详情">
            <button type="button" className="museum-detail-close" onClick={() => setMobileDetailOpen(false)} aria-label="收起详情">收起</button>
            {previewBreed ? <>
              <BreedImage src={previewBreed.image} alt={previewBreed.name} className="h-28 rounded-lg border border-[var(--museum-line)]" />
              <div className="mt-3 flex items-start justify-between gap-2"><div><h2 className="font-serif text-xl text-[var(--museum-fg)]">{previewBreed.name}</h2><p className="mt-0.5 text-[11px] text-[var(--museum-muted)]">{previewBreed.englishName}</p></div><span className="museum-status">{previewBreed.endangered}</span></div>
              <dl className="mt-3 grid grid-cols-2 gap-2 text-[11px]"><div><dt className="text-[var(--museum-muted)]">产区</dt><dd className="mt-0.5 text-[var(--museum-fg)]">{previewBreed.province}</dd></div><div><dt className="text-[var(--museum-muted)]">类别</dt><dd className="mt-0.5 text-[var(--museum-fg)]">{previewBreed.category}</dd></div></dl>
              <p className="mt-3 line-clamp-3 text-xs leading-5 text-[var(--museum-muted)]">{previewBreed.story}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => navigate(`/encyclopedia?breed=${encodeURIComponent(previewBreed.id)}`)} className="museum-link text-xs">在百科查看 <ArrowRight className="h-3.5 w-3.5" /></button>
                <button type="button" onClick={() => toggleCompare(previewBreed.id)} className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2.5 text-[11px] transition-colors ${isInCompare(previewBreed.id) ? 'border-[#d4a853] bg-[#d4a853]/15 text-[#e7c67d]' : 'border-[var(--museum-line)] text-[var(--museum-muted)] hover:border-[#d4a853] hover:text-[var(--museum-fg)]'}`} aria-pressed={isInCompare(previewBreed.id)}>{isInCompare(previewBreed.id) && <Check className="h-3.5 w-3.5" aria-hidden="true" />} {isInCompare(previewBreed.id) ? '已加入对比' : '加入对比'}</button>
              </div>
            </> : <div className="flex min-h-[220px] flex-col items-center justify-center text-center"><Sparkles className="h-6 w-6 text-[#d4a853]" /><p className="mt-3 text-sm text-[var(--museum-fg)]">点击地图点位查看详情</p></div>}
            {activeProvince && <div role="region" aria-label={`${activeProvince.province}省份速览`} className="mt-4 border-t border-[var(--museum-line)] pt-3"><p className="text-[11px] text-[var(--museum-muted)]">省份速览</p><p className="mt-1 text-base text-[var(--museum-fg)]">{activeProvince.province} <span className="font-mono text-xs text-[#d4a853]">{activeProvince.total} 条</span></p><p className="mt-1 text-[11px] text-[var(--museum-muted)]">落点 {activeProvince.mappable} · 保护 {activeProvince.nationalProtected}</p></div>}
          </aside>
        </div>

        <footer className="mt-2 flex flex-wrap items-center justify-between gap-2 border-t border-[var(--museum-line)] pt-2 text-[11px] text-[var(--museum-muted)]"><div className="flex flex-wrap items-center gap-2"><VerificationLegend /><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span></div><Link to="/dashboard" className="museum-link text-xs">数据口径 <ArrowRight className="h-3.5 w-3.5" /></Link></footer>
      </div>
    </div>
  );
}
