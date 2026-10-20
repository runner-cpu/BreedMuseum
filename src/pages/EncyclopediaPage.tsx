import {
  ArrowUpRight,
  ChevronDown,
  ExternalLink,
  GitCompare,
  ImageOff,
  Map as MapIcon,
  MapPin,
  Search,
  Shuffle,
  X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import { CategorySidebar } from '@/components/common/CategorySidebar';
import { getBreedMetadata, getBreedSource } from '@/data/breedMetadata';
import { matchesBreedQuery, sortBreedsByRelevance } from '@/data/breedSearch';
import { visibleBreeds, visibleCategories, visibleEndangeredLevels, visibleProvinces } from '@/data/visibleBreeds';
import { categoryColors } from '@/lib/categoryIcons';
import { categoryLabel, fill, levelLabel, provinceLabel } from '@/lib/displayLabels';
import { useMuseum } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';

const PAGE_SIZE = 24;
/**
 * 筛选项只列“筛得出东西”的值：`endangeredLevels` 目录里保留“极危”等
 * 尚未收录的等级，`provinces` 目录保留 34 个省级行政区（含天津/港澳台
 * 暂无带图记录者）。直接铺满会让观众点进空结果，这里按可浏览集合收窄。
 */
const levels = visibleEndangeredLevels;

/** 旧链接可能带着已无记录的类别/省份/等级；这类值不能留在状态里，否则页面空白且没有可取消的筛选项。 */
const categoryOrAll = (value: string | null) => (value && (visibleCategories as readonly string[]).includes(value) ? value : '全部');
const provinceOrAll = (value: string | null) => (value && visibleProvinces.includes(value) ? value : '全部');
const levelOrAll = (value: string | null) => (value && (levels as readonly string[]).includes(value) ? value : '全部');
/**
 * 濒危等级标签。旧实现写死 `text-red-200` / `text-amber-100`：
 * 这两种近白文字在浅色宣纸底上几乎不可读（对比度约 1.2:1），
 * 而站点本身支持浅/深两套主题。这里改用语义令牌 + 主题感知的强调色，
 * 保证两种底色下等级文字都有足够对比。
 */
function statusClass(level: string) {
  if (level === '濒危' || level === '极危') return 'border-red-700/45 bg-red-600/10 text-red-800 dark:border-red-400/50 dark:bg-red-400/10 dark:text-red-200';
  if (level === '易危') return 'border-amber-700/45 bg-amber-600/10 text-amber-900 dark:border-amber-300/50 dark:bg-amber-300/10 dark:text-amber-100';
  return 'border-stage-border bg-stage-soft text-stage-muted';
}

/**
 * 图片上的类别角标。
 *
 * 旧实现直接把类别色当文字色压在深色胶囊上：兔的浅粉、蜂的暗金都还行，
 * 但骆驼 #8B4513 这类深棕对胶囊底只有约 2.8:1，小字号读不清。
 * 现在文字固定用近白色，类别色只作为左侧圆点，颜色编码保留、对比度稳定。
 */
const badgeStyle = (color: string) => ({
  borderColor: `${color}88`,
  color: '#f7f3e8',
  background: 'rgb(8 14 12 / .84)',
});

export default function EncyclopediaPage() {
  const [params, setParams] = useSearchParams();
  const { t, language } = useSettings();
  const { toggleCompare, isInCompare, compareIds } = useMuseum();

  const [query, setQuery] = useState(params.get('search') ?? '');
  const [category, setCategory] = useState(categoryOrAll(params.get('category')));
  const [province, setProvince] = useState(provinceOrAll(params.get('province')));
  const [level, setLevel] = useState(levelOrAll(params.get('level')));
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(params.get('breed'));

  const filteredBreeds = useMemo(() => {
    const result = visibleBreeds.filter((breed) => {
      if (category !== '全部' && breed.category !== category) return false;
      if (province !== '全部' && breed.province !== province) return false;
      if (level !== '全部' && breed.endangered !== level) return false;
      return matchesBreedQuery(breed, query);
    });
    return sortBreedsByRelevance(result, query);
  }, [category, level, province, query]);

  const visibleCards = filteredBreeds.slice(0, visibleCount);
  const hasFilters = Boolean(query.trim()) || category !== '全部' || province !== '全部' || level !== '全部';
  const selectedBreed = useMemo(() => (selectedBreedId ? visibleBreeds.find((breed) => breed.id === selectedBreedId) ?? null : null), [selectedBreedId]);
  const selectedMetadata = selectedBreed ? getBreedMetadata(selectedBreed) : null;
  const selectedSources = selectedMetadata?.sourceIds.map((sourceId) => getBreedSource(sourceId)).filter(Boolean) ?? [];

  useEffect(() => {
    // 地址栏是筛选状态的唯一事实源：从全局搜索、地图或外部链接进来时，
    // 关键词/类别/省份/等级都要跟着 URL 一起刷新，否则页面显示的是上一次的筛选。
    // 关键词只比较去空白后的值：输入过程中的尾随空格不该被立刻吞掉。
    setQuery((current) => {
      const incoming = params.get('search') ?? '';
      return incoming === current.trim() ? current : incoming;
    });
    setCategory(categoryOrAll(params.get('category')));
    setProvince(provinceOrAll(params.get('province')));
    setLevel(levelOrAll(params.get('level')));
    setVisibleCount(PAGE_SIZE);
    setSelectedBreedId(params.get('breed'));
  }, [params]);

  useEffect(() => {
    if (!selectedBreedId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedBreedId]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => (value && value !== '全部' ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  };

  const updateQuery = (value: string) => { setQuery(value); setVisibleCount(PAGE_SIZE); updateParams({ search: value.trim() }); };
  const updateCategory = (value: string) => { setCategory(value); setVisibleCount(PAGE_SIZE); updateParams({ category: value }); };
  const updateProvince = (value: string) => { setProvince(value); setVisibleCount(PAGE_SIZE); updateParams({ province: value }); };
  const updateLevel = (value: string) => { setLevel(value); setVisibleCount(PAGE_SIZE); updateParams({ level: value }); };

  const clearFilters = () => {
    setQuery(''); setCategory('全部'); setProvince('全部'); setLevel('全部'); setVisibleCount(PAGE_SIZE);
    const next = new URLSearchParams();
    if (params.get('breed')) next.set('breed', params.get('breed')!);
    setParams(next, { replace: true });
  };

  const randomBreed = () => {
    const source = filteredBreeds.length ? filteredBreeds : visibleBreeds;
    // 只用于「随机挑一条」这种纯展示用途；用 crypto 作为唯一随机源，
    // 环境不支持时才退回时间戳，避免引入弱随机数实现。
    const buffer = new Uint32Array(1);
    if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(buffer);
    else buffer[0] = Date.now() >>> 0;
    const picked = source[buffer[0] % source.length];
    if (picked) openBreed(picked.id);
  };

  const openBreed = (id: string) => {
    setSelectedBreedId(id);
    setParams({ ...Object.fromEntries(params.entries()), breed: id }, { replace: true });
  };

  function closeDetail() {
    setSelectedBreedId(null);
    const next = new URLSearchParams(params);
    next.delete('breed');
    setParams(next, { replace: true });
  }

  return (
    <div className="min-h-full bg-stage text-stage-fg">
      <div className="museum-encyclopedia-layout">
        <CategorySidebar
          selected={category === '全部' ? null : category}
          options={visibleCategories}
          onSelect={(nextCategory) => updateCategory(nextCategory ?? '全部')}
        />

        <div className="museum-encyclopedia-main min-w-0 px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
          {/* 页面标题保留给屏幕阅读器与页面结构；视觉上直接以筛选栏开场，
              省掉一条只有「品种百科」四个字和一个按钮的横幅。 */}
          <h1 className="sr-only">{t('enc.title')}</h1>

          <section aria-label={t('enc.searchAria')} className="mb-5 rounded-2xl border border-stage-border bg-stage-panel p-3 sm:p-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">{t('enc.searchAria')}</span>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stage-muted" aria-hidden="true" />
                <input
                  value={query}
                  onChange={(event) => updateQuery(event.target.value)}
                  type="search"
                  placeholder={t('enc.searchPlaceholder')}
                  className="min-h-11 w-full rounded-lg border border-stage-border bg-stage-soft pl-10 pr-3 text-sm text-stage-fg outline-none transition-colors placeholder:text-stage-muted focus:border-stage-gold focus:ring-2 focus:ring-stage-gold/20"
                />
              </label>

              <div className="flex flex-wrap items-center gap-2">
                <select
                  aria-label={t('enc.filterProvinceAria')}
                  value={province}
                  onChange={(event) => updateProvince(event.target.value)}
                  className="min-h-11 max-w-[10rem] rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"
                >
                  <option value="全部">{t('enc.allProvinces')}</option>
                  {visibleProvinces.map((item) => <option key={item} value={item}>{provinceLabel(item, language)}</option>)}
                </select>
                <select
                  aria-label={t('enc.filterEndangeredAria')}
                  value={level}
                  onChange={(event) => updateLevel(event.target.value)}
                  className="min-h-11 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"
                >
                  <option value="全部">{t('enc.allLevels')}</option>
                  {levels.map((item) => <option key={item} value={item}>{levelLabel(item, language)}</option>)}
                </select>
                {hasFilters && (
                  <button type="button" onClick={clearFilters} aria-label={t('enc.clearFilters')} className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-stage-muted hover:text-stage-fg">
                    <X className="h-4 w-4" />
                    {t('enc.clearFilters')}
                  </button>
                )}
                <button type="button" onClick={randomBreed} className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stage-border px-3 text-sm text-stage-fg transition-colors hover:border-stage-gold hover:bg-stage-soft">
                  <Shuffle className="h-4 w-4" aria-hidden="true" />
                  {t('enc.random')}
                </button>
                <Link to="/explore" className="inline-flex min-h-11 items-center gap-1.5 rounded-lg bg-stage-gold px-3 text-sm font-medium text-stage transition-colors hover:brightness-105">
                  <MapIcon className="h-4 w-4" aria-hidden="true" />
                  {t('enc.openMap')}
                </Link>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stage-muted">
              <span>
                {t('enc.showing')} <strong className="font-mono text-stage-fg">{filteredBreeds.length.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN')}</strong> {t('enc.unitRecords')}
              </span>
              <span>{t('enc.compareSelected')} {compareIds.length} / 4</span>
            </div>
          </section>

          {visibleCards.length ? (
            <>
              <section aria-label={t('enc.resultsAria')} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {visibleCards.map((breed) => {
                  const metadata = getBreedMetadata(breed);
                  const categoryColor = categoryColors[breed.category] ?? '#d4a853';
                  // 英文界面把英文名放在主标题位，中文名退到副标题：否则整页
                  // 只有标签是英文、每条记录仍是一行中文，等于没切语言。
                  const displayName = language === 'en' ? (breed.englishName || breed.name) : breed.name;
                  const secondaryName = language === 'en' ? breed.name : breed.englishName;
                  return (
                    <article key={breed.id} className="group overflow-hidden rounded-2xl border border-stage-border bg-stage-panel text-left transition duration-200 hover:-translate-y-0.5 hover:border-stage-gold hover:shadow-[0_16px_38px_rgba(0,0,0,.18)]">
                      <button
                        type="button"
                        onClick={() => openBreed(breed.id)}
                        className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stage-gold"
                        aria-label={fill(t('enc.viewBreed'), { name: displayName })}
                      >
                        <div className="relative aspect-[1.45] overflow-hidden bg-stage-soft">
                          <BreedImage
                            src={breed.image}
                            alt={fill(t('enc.imageAlt'), { name: displayName })}
                            category={breed.category}
                            breedName={breed.name}
                            className="h-full w-full"
                            imgClassName="transition duration-500 group-hover:scale-105"
                            sizes="(min-width: 1280px) 240px, (min-width: 640px) 33vw, 100vw"
                          />
                          <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px]" style={badgeStyle(categoryColor)}>
                            <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: categoryColor }} />
                            {categoryLabel(breed.category, language)}
                          </span>
                          <span className={`absolute right-3 top-3 rounded-md border px-2 py-1 text-[11px] ${statusClass(breed.endangered)}`}>
                            {levelLabel(breed.endangered, language)}
                          </span>
                        </div>
                        <div className="p-4 pb-3">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <h2 className="truncate font-serif text-lg text-stage-fg">{displayName}</h2>
                              <p className="mt-0.5 truncate text-xs text-stage-muted">{secondaryName}</p>
                            </div>
                            <ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-stage-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-stage-gold" aria-hidden="true" />
                          </div>
                          <div className="mt-3 flex items-center gap-2 text-xs text-stage-muted">
                            <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                            {provinceLabel(breed.province, language)}
                            <span aria-hidden="true">·</span>
                            <span>{metadata.aliases.length ? `${t('enc.aliasCount')} ${metadata.aliases.length}` : t('enc.officialCatalog')}</span>
                          </div>
                        </div>
                      </button>
                      <div className="flex items-center justify-between border-t border-stage-border/70 px-4 py-2.5">
                        <button type="button" onClick={() => openBreed(breed.id)} className="inline-flex min-h-8 items-center gap-1 text-xs text-stage-muted hover:text-stage-gold">
                          {t('enc.viewDetail')}
                          <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => toggleCompare(breed.id)}
                          aria-pressed={isInCompare(breed.id)}
                          className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors ${isInCompare(breed.id) ? 'border-stage-gold bg-stage-gold/15 text-stage-gold' : 'border-stage-border text-stage-muted hover:border-stage-gold hover:text-stage-fg'}`}
                        >
                          <GitCompare className="h-3.5 w-3.5" aria-hidden="true" />
                          {isInCompare(breed.id) ? t('enc.inCompare') : t('enc.addCompare')}
                        </button>
                      </div>
                    </article>
                  );
                })}
              </section>

              <div className="mt-6 flex justify-center">
                {visibleCount < filteredBreeds.length ? (
                  <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="inline-flex min-h-11 items-center rounded-lg border border-stage-border px-5 text-sm text-stage-fg hover:border-stage-gold">
                    {fill(t('enc.loadMore'), { n: (filteredBreeds.length - visibleCount).toLocaleString(language === 'en' ? 'en-US' : 'zh-CN') })}
                  </button>
                ) : (
                  <p className="text-xs text-stage-muted">{t('enc.allShown')}</p>
                )}
              </div>
            </>
          ) : (
            <div className="rounded-2xl border border-dashed border-stage-border bg-stage-panel px-6 py-20 text-center">
              <ImageOff className="mx-auto h-8 w-8 text-stage-muted" aria-hidden="true" />
              <h2 className="mt-3 font-serif text-xl">{t('enc.noResult')}</h2>
              <p className="mt-2 text-sm text-stage-muted">{t('enc.noResultHint')}</p>
              <button type="button" onClick={clearFilters} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-stage-gold px-4 text-sm font-semibold text-stage">
                {t('enc.viewAll')}
              </button>
            </div>
          )}

          <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stage-border pt-4 text-xs text-stage-muted">
            <span>{fill(t('enc.footerNote'), { n: visibleBreeds.length.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN') })}</span>
            <Link to="/dashboard" className="underline underline-offset-4 hover:text-stage-fg">{t('enc.viewScope')}</Link>
          </footer>
        </div>
      </div>

      {selectedBreed && selectedMetadata && (
        <div
          className="museum-drawer-backdrop fixed inset-0 z-50 flex items-end justify-end bg-black/60"
          role="presentation"
          onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}
        >
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={fill(t('enc.detailAria'), { name: selectedBreed.name })}
            className="museum-breed-drawer ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-stage-border bg-stage-panel shadow-2xl"
          >
            <div className="sticky top-0 z-10 flex items-center justify-between border-b border-stage-border bg-stage-panel/95 px-5 py-3 backdrop-blur">
              <p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-stage-gold">BREED RECORD</p>
              <button type="button" aria-label={t('enc.closeDetail')} onClick={closeDetail} className="rounded-full p-2 text-stage-muted hover:bg-stage-soft hover:text-stage-fg">
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            <div className="p-5 sm:p-7">
              <div className="relative overflow-hidden rounded-2xl bg-stage-soft">
                <BreedImage
                  src={selectedBreed.image}
                  alt={fill(t('enc.imageAlt'), { name: selectedBreed.name })}
                  category={selectedBreed.category}
                  breedName={selectedBreed.name}
                  fallbackMode="empty"
                  className="aspect-[1.55] w-full"
                  eager
                  imgClassName="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12">
                  <div>
                    <h2 className="font-serif text-3xl text-white">{language === 'en' ? (selectedBreed.englishName || selectedBreed.name) : selectedBreed.name}</h2>
                    <p className="mt-1 text-xs text-white/70">{language === 'en' ? selectedBreed.name : selectedBreed.englishName}</p>
                  </div>
                  <span className="rounded-md border border-white/30 bg-black/35 px-2 py-1 text-xs text-white">
                    {levelLabel(selectedBreed.endangered, language)}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-stage-gold/50 bg-stage-gold/10 px-2.5 py-1 text-xs text-stage-gold">
                  {categoryLabel(selectedBreed.category, language)}
                </span>
                <span className="inline-flex items-center gap-1 text-xs text-stage-muted">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
                  {provinceLabel(selectedBreed.province, language)}
                </span>
                <button
                  type="button"
                  onClick={() => toggleCompare(selectedBreed.id)}
                  className={`ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${isInCompare(selectedBreed.id) ? 'border-stage-gold bg-stage-gold/15 text-stage-gold' : 'border-stage-border text-stage-muted hover:border-stage-gold hover:text-stage-fg'}`}
                >
                  <GitCompare className="h-4 w-4" aria-hidden="true" />
                  {isInCompare(selectedBreed.id) ? t('enc.inCompare') : t('enc.addCompare')}
                </button>
              </div>

              <p className="mt-5 text-sm leading-7 text-stage-fg/90">{selectedBreed.story || t('enc.storyPending')}</p>

              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-stage-soft p-4">
                  <p className="text-xs text-stage-muted">{t('detail.appearance')}</p>
                  <p className="mt-2 text-sm leading-6 text-stage-fg">{selectedBreed.appearance || t('enc.dataPending')}</p>
                </div>
                <div className="rounded-xl bg-stage-soft p-4">
                  <p className="text-xs text-stage-muted">{t('detail.performance')}</p>
                  <p className="mt-2 text-sm leading-6 text-stage-fg">{selectedBreed.performance || t('enc.dataPending')}</p>
                </div>
              </div>

              <details className="group mt-6 rounded-xl border border-stage-border bg-stage-soft">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-stage-fg">
                  <span>{t('enc.moreData')}</span>
                  <ChevronDown className="h-4 w-4 text-stage-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <div className="space-y-4 border-t border-stage-border px-4 py-4 text-xs leading-6 text-stage-muted">
                  <div>
                    <p className="text-stage-fg">{t('detail.provenanceTitle')}</p>
                    <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5">
                      <dt>{t('detail.officialName')}</dt>
                      <dd className="text-stage-fg">{selectedMetadata.officialName}</dd>
                      <dt>{t('detail.protectionStatus')}</dt>
                      <dd className="text-stage-fg">
                        {selectedMetadata.protectionStatus === 'national-list'
                          ? t('detail.protectionNational')
                          : selectedMetadata.protectionStatus === 'not-on-national-list'
                            ? t('detail.protectionNotListed')
                            : t('detail.protectionPending')}
                      </dd>
                      <dt>{t('detail.verifiedAt')}</dt>
                      <dd className="text-stage-fg">{selectedMetadata.verifiedAt}</dd>
                    </dl>
                  </div>

                  {selectedSources.length > 0 && (
                    <div>
                      <p className="text-stage-fg">{t('detail.sourceListLabel')}</p>
                      <ul className="mt-2 space-y-1">
                        {selectedSources.map((source) => source && (
                          <li key={source.id}>
                            {source.url ? (
                              <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stage-gold underline-offset-2 hover:underline">
                                {source.title}
                                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                              </a>
                            ) : source.title}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <p className="border-t border-stage-border pt-3">{t('detail.provenanceNote')}</p>
                </div>
              </details>

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stage-border pt-4 text-xs">
                <Link to={`/explore?breed_id=${encodeURIComponent(selectedBreed.id)}`} onClick={closeDetail} className="inline-flex items-center gap-1 text-stage-gold hover:underline">
                  {t('enc.viewOnMap')}
                  <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <Link to="/compare" className="text-stage-muted hover:text-stage-fg">
                  {t('enc.compareBar')} {compareIds.length} / 4
                </Link>
              </div>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
