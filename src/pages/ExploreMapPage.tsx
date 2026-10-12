import { ArrowRight, Check, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChinaMap, type LensId } from '@/components/ChinaMap';
import { BreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { useSettings } from '@/contexts/AppSettings';
import { useMuseum } from '@/contexts/MuseumContext';
import { getBreedById } from '@/data/breedLookup';
import { type Breed, breeds } from '@/data/breeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildSiteClusters, clustersForLens, type SiteCluster } from '@/lib/geo/clusterSites';
import { buildDigest, lightMapSummary } from '@/lib/geo/lightMapData';

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
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(params.get('breed_id') || params.get('province')));

  // 首页的类别/省份排行通过 query 直达探索页；同步 URL 变化，
  // 也让浏览器前进/后退保持与筛选状态一致。
  useEffect(() => {
    const requestedCategory = categoryFromParams(params);
    setCategory(requestedCategory);
    setLens(requestedCategory ? 'category' : 'all');
    setProvince(params.get('province'));
  }, [params]);
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
      <div className="museum-home-inner museum-map-stage px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
        <h1 className="sr-only">地图探索</h1>

        <div className="museum-map-workbench museum-map-workbench--focus">
          <section className="museum-map-card museum-map-card--focus" aria-labelledby="explore-map-title">
            <h2 id="explore-map-title" className="sr-only">全国品种分布地图</h2>
            <div className="museum-map-filterbar" role="toolbar" aria-label="地图筛选">
              <div className="museum-map-category-tabs" role="tablist" aria-label="按畜种筛选">
                <button type="button" role="tab" aria-selected={lens === 'all'} onClick={() => { setLens('all'); setCategory(null); }} className={`museum-map-filter ${lens === 'all' ? 'is-active' : ''}`}>全部</button>
                {categories.map((item) => <button key={item} type="button" role="tab" aria-selected={lens === 'category' && category === item} onClick={() => { setCategory(item); setLens('category'); }} className={`museum-map-filter ${lens === 'category' && category === item ? 'is-active' : ''}`}>{item}</button>)}
              </div>
              <span className="museum-map-filter-count" aria-live="polite">{summary.mappable.toLocaleString()} 条落点</span>
            </div>
            <div className="museum-map-canvas"><ChinaMap breeds={breeds} selectedProvince={province} selectedBreed={selectedBreed} pulseId={selectedBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} darkSurface={isDark} showProvinceLabels={false} onProvinceClick={handleProvinceClick} onBreedClick={openBreed} onClusterClick={handleCluster} onClearSelection={() => { setProvince(null); setSelectedBreed(null); setMobileDetailOpen(false); }} /></div>
          </section>

          <aside className={`museum-detail museum-detail--compact ${mobileDetailOpen ? 'is-open' : ''}`} aria-label="当前品种详情">
            <button type="button" className="museum-detail-close" onClick={() => setMobileDetailOpen(false)} aria-label="收起详情">收起</button>
            {previewBreed ? <>
              <BreedImage src={previewBreed.image} alt={previewBreed.name} category={previewBreed.category} breedName={previewBreed.name} className="h-28 rounded-lg border border-[var(--museum-line)]" />
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

        <footer className="sr-only"><VerificationLegend /><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span><Link to="/dashboard">数据口径</Link></footer>
      </div>
    </div>
  );
}
