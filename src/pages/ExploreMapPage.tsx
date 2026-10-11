import { ArrowLeft, ArrowRight, Search, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChinaMap, type LensId } from '@/components/ChinaMap';
import { BreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { getBreedById } from '@/data/breedLookup';
import { matchesBreedQuery } from '@/data/breedSearch';
import { type Breed, breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';
import { renderCategorySvgIcon } from '@/lib/categorySvgIcons';
import { buildSiteClusters, clustersForLens, type SiteCluster } from '@/lib/geo/clusterSites';
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

const categoryFromParams = (params: URLSearchParams) => {
  const requested = params.get('category');
  return categories.find((category) => category === requested) ?? null;
};

/**
 * 地图探索页：把地图作为唯一主角，给首页的介绍内容留出呼吸空间。
 * 所有点位均链接到馆藏卷宗，镜头只改变筛选口径，不改变原始记录。
 */
export default function ExploreMapPage() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [lens, setLens] = useState<LensId>(() => categoryFromParams(params) ? 'category' : 'all');
  const [category, setCategory] = useState<string | null>(() => categoryFromParams(params));
  const [province, setProvince] = useState<string | null>(() => params.get('province'));
  const [query, setQuery] = useState(params.get('search') ?? '');
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
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(() => getBreedById(params.get('breed_id')));
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
  const defaultPreviewBreed = useMemo(
    () => breeds.find((breed) => breed.image && breed.province !== '待核验') ?? breeds[0] ?? null,
    [],
  );
  const previewBreed = selectedBreed
    ?? (province ? breeds.find((breed) => breed.province === province) ?? null : null)
    ?? defaultPreviewBreed;

  const openBreed = (breed: Breed) => {
    setSelectedBreed(breed);
    navigate(`/breed/${breed.id}`);
  };
  const handleCluster = (cluster: SiteCluster) => {
    setProvince(cluster.province);
    // 产区簇可能包含多个品种；用簇内第一条记录作为详情预览，避免点击地图后右侧仍停留在旧省份。
    const breed = breeds.find((item) => item.id === cluster.members[0]?.id);
    if (breed) setSelectedBreed(breed);
  };
  const handleProvinceClick = (name: string) => {
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
    <div className="museum-home min-h-full text-[#edf2fb]">
      <div className="museum-home-inner px-4 py-8 sm:px-6 sm:py-10 lg:px-8">
        <header className="mb-8 flex flex-col gap-5 border-b border-[#34425f] pb-7 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <Link to="/" className="museum-link mb-5 inline-flex" aria-label="返回首页"><ArrowLeft className="h-4 w-4" />返回首页</Link>
            <p className="museum-eyebrow">EXPLORE · 光图观测站</p>
            <h1 className="mt-2 max-w-3xl font-serif text-4xl tracking-[-0.03em] text-white sm:text-5xl">把全国馆藏放回它们的土地</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-[#aab5c9] sm:text-base">
              选择一个镜头，沿着省份、产区与类别阅读 1,186 条地方品种记录。点击地图上的光点，即可回到一份有来源的品种卷宗。
            </p>
          </div>
          <div className="w-full max-w-md">
            <label htmlFor="explore-search" className="mb-2 block text-xs tracking-[0.16em] text-[#8b9ab4]">SEARCH THE COLLECTION</label>
            <div className="relative flex items-center gap-3 rounded-xl border border-[#53617e] bg-[#11182c] px-4 focus-within:border-[#d4a853] focus-within:ring-2 focus-within:ring-[#d4a853]/20">
              <Search className="h-4 w-4 shrink-0 text-[#9aa8bf]" aria-hidden="true" />
              <input id="explore-search" type="search" aria-label="检索品种档案" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索河田鸡、秦川牛……" className="min-h-12 min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-[#7f8ca4]" />
              {query && <button type="button" aria-label="清空检索" onClick={() => setQuery('')} className="rounded-lg px-2 py-1 text-[#9aa8bf] hover:bg-[#25304a]">清除</button>}
              {searchHits.length > 0 && <ul className="absolute inset-x-0 top-full z-30 mt-2 max-h-64 overflow-auto rounded-xl border border-[#53617e] bg-[#11182c] p-1 shadow-2xl">{searchHits.map((breed) => <li key={breed.id}><button type="button" onClick={() => openBreed(breed)} className="flex min-h-12 w-full items-center justify-between gap-3 rounded-lg px-3 text-left text-sm text-white hover:bg-[#25304a]"><span>{breed.name}</span><span className="text-xs text-[#9aa8bf]">{breed.province} · {breed.category}</span></button></li>)}</ul>}
            </div>
          </div>
        </header>

        <div className="mb-6 grid gap-3 sm:grid-cols-3">
          <div className="museum-panel p-4"><p className="text-xs text-[#8998b1]">当前镜头记录</p><p className="mt-1 font-mono text-2xl text-white">{summary.mappable.toLocaleString()}</p><p className="text-xs text-[#9aa8bf]">{summary.provinces} 个省 · {summary.clusters} 个产区簇</p></div>
          <div className="museum-panel p-4"><p className="text-xs text-[#8998b1]">保护匹配</p><p className="mt-1 font-mono text-2xl text-[#d4a853]">{COLLECTION_SUMMARY.nationalProtectedMatches}</p><p className="text-xs text-[#9aa8bf]">金环标出国家级保护</p></div>
          <div className="museum-panel p-4"><p className="text-xs text-[#8998b1]">观测提示</p><p className="mt-1 text-lg text-white">先选镜头，再点光点</p><p className="text-xs text-[#9aa8bf]">地图不会修改馆藏原始记录</p></div>
        </div>

        <div className="museum-map-workbench">
          <aside className="museum-rail" aria-label="类别筛选">
            <p className="px-3 pb-2 text-[10px] tracking-[0.22em] text-[#7e8da8]">FILTER BY CATEGORY</p>
            <button type="button" className={`museum-rail-item ${lens === 'all' ? 'is-active' : ''}`} onClick={() => { setLens('all'); setCategory(null); }}><span className="museum-rail-dot" />全部类别</button>
            {categories.map((item) => <button type="button" key={item} className={`museum-rail-item ${lens === 'category' && category === item ? 'is-active' : ''}`} onClick={() => { setLens('category'); setCategory(item); }}><span className="museum-rail-icon">{renderCategorySvgIcon(item, categoryColors[item], 22)}</span>{item}</button>)}
          </aside>

          <section className="museum-map-card" aria-labelledby="explore-map-title">
            <div className="flex flex-col gap-4 border-b border-[#34425f] p-4 sm:flex-row sm:items-end sm:justify-between">
              <div><p className="text-xs text-[#8896ae]">当前视角</p><h2 id="explore-map-title" className="mt-1 font-serif text-2xl text-white">一张地图，四个看法</h2><p className="mt-2 max-w-xl text-xs leading-6 text-[#aab5c9]">{LENS_CONCLUSION[lens]}{lens === 'all' && `。另有 ${COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点。`}</p></div>
              <div className="flex flex-wrap gap-1 rounded-xl border border-[#34425f] bg-[#11182c] p-1" role="tablist" aria-label="光图镜头">
                {LENSES.map((item) => <button key={item.id} type="button" role="tab" title={item.hint} aria-selected={lens === item.id} onClick={() => { setLens(item.id); if (item.id !== 'category') setCategory(null); }} className={`min-h-9 rounded-lg px-3 text-xs transition-colors sm:text-sm ${lens === item.id ? 'bg-[#d4a853] font-semibold text-[#1a2032]' : 'museum-ghost-hover text-[#aab5c9]'}`}>{item.label}</button>)}
              </div>
            </div>
            <div className="min-h-[480px] p-1 sm:min-h-[650px] sm:p-3"><ChinaMap breeds={breeds} selectedProvince={province} selectedBreed={selectedBreed} pulseId={selectedBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} darkSurface showProvinceLabels={false} onProvinceClick={handleProvinceClick} onBreedClick={openBreed} onClusterClick={handleCluster} onClearSelection={() => { setProvince(null); setSelectedBreed(null); }} /></div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#34425f] px-4 py-3 text-xs text-[#aab5c9]"><span>{summary.provinces} 个省 · {summary.clusters} 个产区簇 · {summary.mappable} 条当前镜头记录</span><span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#d4a853]" />金环 = 国家级保护匹配</span></div>
          </section>

          <aside className="museum-detail" aria-label="当前品种详情">
            {previewBreed ? <>
              <BreedImage src={previewBreed.image} alt={previewBreed.name} className="h-44 rounded-xl border border-[#34425f]" />
              <div className="mt-4 flex items-start justify-between gap-3"><div><h2 className="font-serif text-2xl text-white">{previewBreed.name}</h2><p className="mt-1 text-xs text-[#9aa8bf]">{previewBreed.englishName}</p></div><span className="museum-status">{previewBreed.endangered}</span></div>
              <dl className="mt-5 grid grid-cols-2 gap-3 text-xs"><div><dt className="text-[#7f8ca4]">产区</dt><dd className="mt-1 text-[#e5eaf4]">{previewBreed.province}</dd></div><div><dt className="text-[#7f8ca4]">类别</dt><dd className="mt-1 text-[#e5eaf4]">{previewBreed.category}</dd></div></dl>
              <p className="mt-5 line-clamp-5 text-sm leading-6 text-[#c1c9d8]">{previewBreed.story}</p>
              <button type="button" onClick={() => openBreed(previewBreed)} className="museum-link mt-5">打开完整卷宗 <ArrowRight className="h-4 w-4" /></button>
            </> : <div className="flex h-full min-h-[360px] flex-col items-center justify-center text-center"><Sparkles className="h-8 w-8 text-[#d4a853]" /><h2 className="mt-4 font-serif text-xl text-white">选择一个点位</h2><p className="mt-2 max-w-[220px] text-sm leading-6 text-[#9aa8bf]">地图上的每个点都对应一组产区记录，点击后在这里查看。</p></div>}
            {activeProvince && <div role="region" aria-label={`${activeProvince.province}省份速览`} className="mt-6 border-t border-[#34425f] pt-4"><p className="text-xs text-[#7f8ca4]">省份速览</p><p className="mt-1 text-lg text-white">{activeProvince.province} <span className="font-mono text-sm text-[#d4a853]">{activeProvince.total} 条</span></p><p className="mt-1 text-xs text-[#9aa8bf]">已落点 {activeProvince.mappable} · 保护 {activeProvince.nationalProtected} · 濒危 {activeProvince.endangered}</p></div>}
          </aside>
        </div>

        {lens === 'category' && <div className="mt-4 flex flex-wrap gap-2" aria-label="类别镜头筛选">{categories.map((item) => <button key={item} type="button" aria-pressed={category === item} onClick={() => setCategory(category === item ? null : item)} className={`inline-flex min-h-9 items-center gap-2 rounded-lg border px-3 text-xs transition-colors ${category === item ? 'border-[#d4a853] bg-[#d4a853]/15 text-[#e7c67d]' : 'border-[#34425f] museum-ghost-hover text-[#aab5c9]'}`}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: categoryColors[item] }} />{item}</button>)}</div>}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-[#34425f] pt-5 text-xs text-[#9aa8bf]"><div className="flex flex-wrap items-center gap-2"><VerificationLegend /><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span></div><Link to="/about" className="museum-link">了解数据来源 <ArrowRight className="h-4 w-4" /></Link></footer>
      </div>
    </div>
  );
}
