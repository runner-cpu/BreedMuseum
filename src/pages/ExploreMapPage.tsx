import { ArrowRight, Check, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChinaMap, type LensId } from '@/components/ChinaMap';
import { BreedImage, hasBreedImage } from '@/components/common/BreedImage';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import { useSettings } from '@/contexts/AppSettings';
import { useMuseum } from '@/contexts/MuseumContext';
import { getBreedById } from '@/data/breedLookup';
import { type Breed } from '@/data/breeds';
import { visibleBreeds } from '@/data/visibleBreeds';
import { categories } from '@/data/catalog';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildSiteClusters, clustersForLens, type SiteCluster } from '@/lib/geo/clusterSites';
import { buildDigest, lightMapSummary } from '@/lib/geo/lightMapData';
import '@/styles/explore-map-page.css';

const categoryFromParams = (params: URLSearchParams) => {
  const requested = params.get('category');
  return categories.find((category) => category === requested) ?? null;
};

const cardBreedFor = (breed: Breed | null | undefined): Breed | null => {
  if (breed && hasBreedImage(breed.image)) return breed;
  return null;
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
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(() => cardBreedFor(getBreedById(params.get('breed_id'))) ?? visibleBreeds[0] ?? null);
  const digest = useMemo(() => buildDigest(visibleBreeds), []);
  const clusters = useMemo(() => buildSiteClusters(visibleBreeds), []);
  const visibleClusters = useMemo(() => clustersForLens(clusters, lens, category), [clusters, lens, category]);
  const summary = useMemo(() => lightMapSummary(visibleClusters), [visibleClusters]);
  const activeProvince = useMemo(
    () => (province ? digest.provinces.find((item) => item.province === province) ?? null : null),
    [digest, province],
  );
  const previewBreed = selectedBreed
    ?? (province ? visibleBreeds.find((breed) => breed.province === province) ?? null : null);

  const openBreed = (breed: Breed) => {
    const cardBreed = cardBreedFor(breed) ?? visibleBreeds.find((item) => item.province === breed.province) ?? null;
    if (!cardBreed) {
      setSelectedBreed(null);
      setMobileDetailOpen(false);
      return;
    }
    setSelectedBreed(cardBreed);
    setMobileDetailOpen(true);
  };
  const handleCluster = (cluster: SiteCluster) => {
    setMobileDetailOpen(true);
    setProvince(cluster.province);
    // 产区簇可能包含多个品种；用簇内第一条记录作为详情预览，避免点击地图后右侧仍停留在旧省份。
    const breed = visibleBreeds.find((item) => item.id === cluster.members[0]?.id)
      ?? visibleBreeds.find((item) => item.province === cluster.province);
    if (breed) setSelectedBreed(breed);
    else {
      setSelectedBreed(null);
      setMobileDetailOpen(false);
    }
  };
  const handleProvinceClick = (name: string) => {
    setMobileDetailOpen(true);
    const nextProvince = name === province ? null : name;
    setProvince(nextProvince);
    if (nextProvince) {
      const breed = visibleBreeds.find((item) => item.province === nextProvince);
      if (breed) setSelectedBreed(breed);
      else {
        setSelectedBreed(null);
        setMobileDetailOpen(false);
      }
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
            <div className="museum-map-heading">
              <div>
                <p className="museum-eyebrow">COLLECTION MAP</p>
                <h2 id="explore-map-title" className="font-serif text-xl text-[var(--museum-fg)] sm:text-2xl">全国品种分布地图</h2>
              </div>
              <span className="museum-map-total">{summary.mappable.toLocaleString()} 个品种</span>
            </div>
            <div className="museum-map-filterbar" role="toolbar" aria-label="地图筛选">
              <div className="museum-map-category-tabs" role="tablist" aria-label="按畜种筛选">
                <button type="button" role="tab" aria-selected={lens === 'all'} onClick={() => { setLens('all'); setCategory(null); }} className={`museum-map-filter ${lens === 'all' ? 'is-active' : ''}`}>全部</button>
                {categories.map((item) => <button key={item} type="button" role="tab" aria-selected={lens === 'category' && category === item} onClick={() => { setCategory(item); setLens('category'); }} className={`museum-map-filter ${lens === 'category' && category === item ? 'is-active' : ''}`}>{item}</button>)}
              </div>
              <span className="museum-map-filter-count" aria-live="polite">{summary.mappable.toLocaleString()} 条落点</span>
            </div>
            <div className="museum-map-canvas"><ChinaMap breeds={visibleBreeds} selectedProvince={province} selectedBreed={selectedBreed} pulseId={selectedBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} darkSurface={isDark} showProvinceLabels={false} onProvinceClick={handleProvinceClick} onBreedClick={openBreed} onClusterClick={handleCluster} onClearSelection={() => { setProvince(null); setSelectedBreed(null); setMobileDetailOpen(false); }} /></div>
          </section>

          <aside className={`museum-detail museum-detail--compact ${mobileDetailOpen ? 'is-open' : ''}`} aria-label="当前品种详情">
            <button type="button" className="museum-detail-close" onClick={() => setMobileDetailOpen(false)} aria-label="收起详情">收起</button>
            {previewBreed ? <>
              <div className="museum-detail-media">
                <BreedImage src={previewBreed.image} alt={previewBreed.name} category={previewBreed.category} breedName={previewBreed.name} className="aspect-[1.55] w-full" eager />
                <span className="museum-detail-status">{previewBreed.endangered}</span>
              </div>
              <div className="museum-detail-title"><div><h2 className="font-serif text-2xl text-[var(--museum-fg)]">{previewBreed.name}</h2><p className="mt-1 text-xs text-[var(--museum-muted)]">{previewBreed.englishName}</p></div></div>
              <dl className="museum-detail-meta"><div><dt><MapPin className="h-3.5 w-3.5" />产区</dt><dd>{previewBreed.province}</dd></div><div><dt>类别</dt><dd>{previewBreed.category}</dd></div></dl>
              <div className="museum-detail-actions">
                <button type="button" onClick={() => toggleCompare(previewBreed.id)} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${isInCompare(previewBreed.id) ? 'border-[#d4a853] bg-[#d4a853]/15 text-[#e7c67d]' : 'border-[var(--museum-line)] text-[var(--museum-muted)] hover:border-[#d4a853] hover:text-[var(--museum-fg)]'}`} aria-pressed={isInCompare(previewBreed.id)}>{isInCompare(previewBreed.id) && <Check className="h-3.5 w-3.5" aria-hidden="true" />} {isInCompare(previewBreed.id) ? '已加入对比' : '加入对比'}</button>
                <button type="button" onClick={() => navigate(`/encyclopedia?breed=${encodeURIComponent(previewBreed.id)}`)} className="museum-link inline-flex min-h-9 justify-center border border-transparent px-2 text-xs">在百科查看 <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
              <section className="museum-detail-story" aria-label="品种故事"><p className="museum-detail-label">品种故事</p><p className="mt-2 line-clamp-5 text-sm leading-6 text-[var(--museum-muted)]">{previewBreed.story}</p></section>
            </> : <div className="flex min-h-[220px] flex-col items-center justify-center text-center"><Sparkles className="h-6 w-6 text-[#d4a853]" /><p className="mt-3 text-sm text-[var(--museum-fg)]">点击地图点位查看详情</p></div>}
            {activeProvince && <div role="region" aria-label={`${activeProvince.province}省份速览`} className="mt-4 border-t border-[var(--museum-line)] pt-3"><p className="text-[11px] text-[var(--museum-muted)]">省份速览</p><p className="mt-1 text-base text-[var(--museum-fg)]">{activeProvince.province} <span className="font-mono text-xs text-[#d4a853]">{activeProvince.total} 条</span></p><p className="mt-1 text-[11px] text-[var(--museum-muted)]">落点 {activeProvince.mappable} · 保护 {activeProvince.nationalProtected}</p></div>}
          </aside>
        </div>

        <footer className="sr-only"><VerificationLegend /><span>{COLLECTION_SUMMARY.unverifiedProvince} 条产区待核验，暂不落点</span><Link to="/dashboard">数据口径</Link></footer>
      </div>
    </div>
  );
}
