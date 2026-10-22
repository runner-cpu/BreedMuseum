import { ArrowRight, Check, MapPin, Sparkles } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChinaMap, type LensId } from '@/components/ChinaMap';
import { BreedImage, hasBreedImage } from '@/components/common/BreedImage';
import { CategorySidebar } from '@/components/common/CategorySidebar';
import { VerificationLegend } from '@/components/common/VerificationBadge';
import ScrollFloat from '@/components/effects/ScrollFloat';
import { useMuseum } from '@/contexts/MuseumContext';
import { getBreedById } from '@/data/breedLookup';
import { type Breed } from '@/data/breeds';
import { visibleBreeds, visibleCategories } from '@/data/visibleBreeds';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { buildSiteClusters, clustersForLens, type SiteCluster } from '@/lib/geo/clusterSites';
import { buildDigest, lightMapSummary } from '@/lib/geo/lightMapData';
import { categoryLabel, fill, levelLabel, provinceLabel } from '@/lib/displayLabels';
import { useSettings } from '@/contexts/AppSettings';
import '@/styles/explore-map-page.css';

const categoryFromParams = (params: URLSearchParams) => {
  const requested = params.get('category');
  // 只接受当前可浏览的类别：旧链接里的空类别（如“蜂”）不应把地图留在空视图。
  return visibleCategories.find((category) => category === requested) ?? null;
};

/**
 * 镜头与类别是两条正交的筛选轴：
 * - 镜头 = 全部 / 国家级保护 / 濒危之窗，回答“看哪一类证据”；
 * - 类别 = 猪、牛、羊……，回答“看哪一类畜种”。
 * 旧实现把两者塞进同一个 `lens` 状态（选类别就等于切镜头），
 * 于是“牛 + 国家级保护”这种组合无法表达，镜头控件也在改版后整组消失，
 * 文档里承诺的三个镜头实际无法抵达。
 */
type ExploreLens = Exclude<LensId, 'category'>;

const lensFromParams = (params: URLSearchParams): ExploreLens => {
  const requested = params.get('lens');
  return requested === 'protect' || requested === 'risk' ? requested : 'all';
};

/**
 * 省份参数只接受当前地图上真实存在的省份。
 *
 * 旧链接（或手改地址栏）可能带来「待核验」、已无带图记录的省份，
 * 这类值会让右侧详情停在空态、地图却没有任何省份被选中。
 */
const provinceFromParams = (params: URLSearchParams): string | null => {
  const requested = params.get('province');
  if (!requested) return null;
  return visibleBreeds.some((breed) => breed.province === requested) ? requested : null;
};

const LENS_OPTIONS: Array<{ id: ExploreLens; labelKey: string }> = [
  { id: 'all', labelKey: 'explore.lensAll' },
  { id: 'protect', labelKey: 'explore.lensProtect' },
  { id: 'risk', labelKey: 'explore.lensRisk' },
];

const cardBreedFor = (breed: Breed | null | undefined): Breed | null => {
  if (breed && hasBreedImage(breed.image)) return breed;
  return null;
};

/**
 * 地图探索页：把地图作为唯一主角，给首页的介绍内容留出呼吸空间。
 * 所有点位均链接到馆藏卷宗，镜头只改变筛选口径，不改变原始记录。
 */
export default function ExploreMapPage() {
  const { isInCompare, toggleCompare } = useMuseum();
  const { t, language } = useSettings();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [lens, setLens] = useState<ExploreLens>(() => lensFromParams(params));
  const [category, setCategory] = useState<string | null>(() => categoryFromParams(params));
  const [province, setProvince] = useState<string | null>(() => provinceFromParams(params));
  const [mobileDetailOpen, setMobileDetailOpen] = useState(Boolean(params.get('breed_id') || params.get('province')));

  // 首页的类别/省份排行通过 query 直达探索页；同步 URL 变化，
  // 也让浏览器前进/后退保持与筛选状态一致。
  useEffect(() => {
    const requestedCategory = categoryFromParams(params);
    setCategory(requestedCategory);
    setLens(lensFromParams(params));
    setProvince(provinceFromParams(params));
    // `breed_id` 也是地址栏状态的一部分：后退/前进时要跟着回到当时的选中记录，
    // 否则地图上的高亮与详情卡会停留在上一次的品种。
    setSelectedBreed(cardBreedFor(getBreedById(params.get('breed_id'))) ?? null);
  }, [params]);

  /** 把筛选写回地址栏：刷新、分享和后退都能回到同一视图。 */
  const syncParams = (next: { category: string | null; province: string | null; lens?: ExploreLens; breedId?: string | null }) => {
    const search = new URLSearchParams(params);
    if (next.category) search.set('category', next.category);
    else search.delete('category');
    if (next.province) search.set('province', next.province);
    else search.delete('province');
    const nextLens = next.lens ?? lens;
    if (nextLens === 'all') search.delete('lens');
    else search.set('lens', nextLens);
    // 换了省/类别/镜头后，旧的点选品种不再属于当前视图，避免刷新后选中错位；
    // 若这次操作同时确定了新的预览品种，则把它写回去。
    if (next.breedId) search.set('breed_id', next.breedId);
    else search.delete('breed_id');
    setParams(search, { replace: true });
  };
  // 详情卡默认展示当前筛选下的第一条记录（见 `fallbackBreed`），
  // 带 `breed_id` 时优先展示参数指定的记录，避免刷新/后退后丢失上下文。
  const [selectedBreed, setSelectedBreed] = useState<Breed | null>(() => cardBreedFor(getBreedById(params.get('breed_id'))) ?? null);
  const digest = useMemo(() => buildDigest(visibleBreeds), []);
  const clusters = useMemo(() => buildSiteClusters(visibleBreeds), []);
  const visibleClusters = useMemo(() => clustersForLens(clusters, lens, category), [clusters, lens, category]);
  const summary = useMemo(() => lightMapSummary(visibleClusters), [visibleClusters]);
  /**
   * 当前镜头 + 类别下的记录集合。
   *
   * 详情卡必须跟着筛选走：旧实现固定拿 `visibleBreeds[0]` 当首屏预览，
   * 观众切到「濒危之窗 + 鸭」时（该组合没有记录），右侧仍展示一条普通鸡，
   * 与地图、标题统计互相矛盾。这里改为只从可见簇的成员里取预览记录，
   * 空组合则显示空态。
   */
  const filteredMembers = useMemo(() => {
    const ids = new Set(visibleClusters.flatMap((cluster) => cluster.members.map((member) => member.id)));
    return visibleBreeds.filter((breed) => ids.has(breed.id));
  }, [visibleClusters]);
  /**
   * 每个镜头在当前类别下的记录数。
   *
   * 镜头条直接给出数字，观众在点击之前就能看出哪个组合是空的
   * （例如「鸭 + 濒危之窗」为 0），不必先切过去再面对一张空图。
   */
  const lensCounts = useMemo(() => {
    const counts = new Map<ExploreLens, number>();
    for (const option of LENS_OPTIONS) {
      counts.set(option.id, lightMapSummary(clustersForLens(clusters, option.id, category)).mappable);
    }
    return counts;
  }, [clusters, category]);
  const activeProvince = useMemo(
    () => (province ? digest.provinces.find((item) => item.province === province) ?? null : null),
    [digest, province],
  );
  const fallbackBreed = province
    ? filteredMembers.find((breed) => breed.province === province) ?? filteredMembers[0] ?? null
    : filteredMembers[0] ?? null;
  const previewBreed = selectedBreed && filteredMembers.some((breed) => breed.id === selectedBreed.id)
    ? selectedBreed
    : fallbackBreed;

  const openBreed = (breed: Breed) => {
    const cardBreed = cardBreedFor(breed) ?? visibleBreeds.find((item) => item.province === breed.province) ?? null;
    if (!cardBreed) {
      setSelectedBreed(null);
      setMobileDetailOpen(false);
      return;
    }
    setSelectedBreed(cardBreed);
    setMobileDetailOpen(true);
    syncParams({ category, province, breedId: cardBreed.id });
  };
  const handleCluster = (cluster: SiteCluster) => {
    setMobileDetailOpen(true);
    setProvince(cluster.province);
    // 产区簇可能包含多个品种；用簇内第一条**当前镜头下可见**的记录作为详情预览，
    // 避免右侧停留在镜头之外的品种。
    const breed = visibleBreeds.find((item) => item.id === cluster.members[0]?.id)
      ?? filteredMembers.find((item) => item.province === cluster.province)
      ?? null;
    syncParams({ category, province: cluster.province, breedId: breed?.id ?? null });
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
    const breed = nextProvince ? filteredMembers.find((item) => item.province === nextProvince) ?? null : null;
    syncParams({ category, province: nextProvince, breedId: breed?.id ?? null });
    if (breed) setSelectedBreed(breed);
    else {
      setSelectedBreed(null);
      if (!nextProvince) setMobileDetailOpen(false);
    }
  };

  return (
    <div className="museum-home museum-explore-page min-h-full text-[var(--museum-fg)]">
      <div className="museum-home-inner museum-map-stage px-2 py-2 sm:px-3 sm:py-3 lg:px-4">
        <h1 className="sr-only">{t('explore.title')}</h1>

        <div className="museum-map-workbench museum-map-workbench--focus">
          <CategorySidebar
            selected={category}
            options={visibleCategories}
            onSelect={(nextCategory) => {
              setCategory(nextCategory);
              setProvince(null);
              setMobileDetailOpen(false);
              syncParams({ category: nextCategory, province: null });
            }}
          />
          <section className="museum-map-card museum-map-card--focus" aria-labelledby="explore-map-title">
            <div className="museum-map-heading">
              <div>
                <ScrollFloat
                  as="h2"
                  id="explore-map-title"
                  once
                  containerClassName="font-serif text-xl text-[var(--museum-fg)] sm:text-2xl"
                  stagger={0.03}
                  animationDuration={0.75}
                >
                  {t('explore.mapHeading')}
                </ScrollFloat>
              </div>
              <span className="museum-map-total">
                {fill(t('explore.summary'), {
                  records: summary.mappable.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN'),
                  clusters: summary.clusters,
                  provinces: summary.provinces,
                })}
              </span>
            </div>
            <div className="museum-map-lensbar" role="group" aria-label={t('explore.lensGroup')}>
              {LENS_OPTIONS.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  aria-pressed={lens === option.id}
                  onClick={() => {
                    setLens(option.id);
                    setMobileDetailOpen(false);
                    syncParams({ category, province, lens: option.id });
                  }}
                  className={`museum-map-lens ${lens === option.id ? 'is-active' : ''}`}
                >
                  {t(option.labelKey)}
                  <span className="museum-map-lens-count" aria-hidden="true">{lensCounts.get(option.id) ?? 0}</span>
                </button>
              ))}
              <span className="museum-map-lens-note">
                {category
                  ? fill(t('explore.lensNoteStacked'), { category: categoryLabel(category, language) })
                  : t('explore.lensNotePlain')}
              </span>
            </div>
            <div className="museum-map-canvas"><ChinaMap breeds={visibleBreeds} selectedProvince={province} selectedBreed={previewBreed ?? null} pulseId={previewBreed?.id ?? null} lens={lens} lensCategory={category} focusedProvince={province} showProvinceLabels={false} showCoordinateNote={false} onProvinceClick={handleProvinceClick} onBreedClick={openBreed} onClusterClick={handleCluster} onClearSelection={() => { setProvince(null); setSelectedBreed(null); setMobileDetailOpen(false); syncParams({ category, province: null }); }} /></div>
            {/* 组合为空时必须说明原因，否则观众只看到一张没有点位的中国地图，会以为数据丢了。 */}
            {summary.mappable === 0 && (
              <div role="status" className="museum-map-empty flex flex-col items-center gap-2 px-4 py-6 text-center text-sm text-[var(--museum-muted)]">
                <p>{t('explore.emptyTitle')}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {category && <button type="button" onClick={() => { setCategory(null); setProvince(null); syncParams({ category: null, province: null }); }} className="museum-map-lens">{t('explore.emptyClearCategory')}</button>}
                  {lens !== 'all' && <button type="button" onClick={() => { setLens('all'); setProvince(null); syncParams({ category, province: null, lens: 'all' }); }} className="museum-map-lens">{t('explore.emptyResetLens')}</button>}
                </div>
              </div>
            )}
          </section>

          <aside className={`museum-detail museum-detail--compact ${mobileDetailOpen ? 'is-open' : ''}`} aria-label={t('explore.detailAria')}>
            <button type="button" className="museum-detail-close" onClick={() => setMobileDetailOpen(false)} aria-label={t('explore.collapseAria')}>{t('explore.collapse')}</button>
            {previewBreed ? <>
              <div className="museum-detail-media">
                <BreedImage src={previewBreed.image} alt={fill(t('enc.imageAlt'), { name: previewBreed.name })} category={previewBreed.category} breedName={previewBreed.name} className="aspect-[1.55] w-full" eager />
                <span className="museum-detail-status">{levelLabel(previewBreed.endangered, language)}</span>
              </div>
              <div className="museum-detail-title"><div><h2 className="font-serif text-2xl text-[var(--museum-fg)]">{language === 'en' ? (previewBreed.englishName || previewBreed.name) : previewBreed.name}</h2><p className="mt-1 text-xs text-[var(--museum-muted)]">{language === 'en' ? previewBreed.name : previewBreed.englishName}</p></div></div>
              <dl className="museum-detail-meta"><div><dt><MapPin className="h-3.5 w-3.5" />{t('explore.provinceLabel')}</dt><dd>{provinceLabel(previewBreed.province, language)}</dd></div><div><dt>{t('explore.categoryLabel')}</dt><dd>{categoryLabel(previewBreed.category, language)}</dd></div></dl>
              <div className="museum-detail-actions">
                <button type="button" onClick={() => toggleCompare(previewBreed.id)} className={`inline-flex min-h-9 flex-1 items-center justify-center gap-1.5 rounded-md border px-2.5 text-xs transition-colors ${isInCompare(previewBreed.id) ? 'border-stage-gold bg-stage-gold/15 text-stage-gold' : 'border-[var(--museum-line)] text-[var(--museum-muted)] hover:border-stage-gold hover:text-[var(--museum-fg)]'}`} aria-pressed={isInCompare(previewBreed.id)}>{isInCompare(previewBreed.id) && <Check className="h-3.5 w-3.5" aria-hidden="true" />} {isInCompare(previewBreed.id) ? t('explore.inCompare') : t('explore.addCompare')}</button>
                <button type="button" onClick={() => navigate(`/encyclopedia?breed=${encodeURIComponent(previewBreed.id)}`)} className="museum-link inline-flex min-h-9 justify-center border border-transparent px-2 text-xs">{t('explore.openInEnc')} <ArrowRight className="h-3.5 w-3.5" /></button>
              </div>
              <section className="museum-detail-story" aria-label={t('explore.storyLabel')}><p className="museum-detail-label">{t('explore.storyLabel')}</p><p className="mt-2 line-clamp-5 text-sm leading-6 text-[var(--museum-muted)]">{previewBreed.story}</p></section>
            </> : <div className="flex min-h-[220px] flex-col items-center justify-center text-center"><Sparkles className="h-6 w-6 text-stage-gold" /><p className="mt-3 text-sm text-[var(--museum-fg)]">{t('explore.clickHint')}</p></div>}
            {activeProvince && (
              <div role="region" aria-label={`${provinceLabel(activeProvince.province, language)} ${t('explore.provinceBrief')}`} className="mt-4 border-t border-[var(--museum-line)] pt-3">
                <p className="text-[11px] text-[var(--museum-muted)]">{t('explore.provinceBrief')}</p>
                <p className="mt-1 text-base text-[var(--museum-fg)]">
                  {provinceLabel(activeProvince.province, language)}{' '}
                  <span className="font-mono text-xs text-stage-gold">{fill(t('explore.provinceRecords'), { n: activeProvince.total })}</span>
                </p>
                <p className="mt-1 text-[11px] text-[var(--museum-muted)]">{fill(t('explore.provinceDetail'), { mapped: activeProvince.mappable, protected: activeProvince.nationalProtected })}</p>
              </div>
            )}
          </aside>
        </div>

        <footer className="sr-only"><VerificationLegend /><span>{fill(t('explore.unverifiedNote'), { n: COLLECTION_SUMMARY.unverifiedProvince })}</span><Link to="/dashboard">{t('explore.dataScope')}</Link></footer>
      </div>
    </div>
  );
}
