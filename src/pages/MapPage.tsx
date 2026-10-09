import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import BreedDetail from '@/components/BreedDetail';
import { ChinaMap } from '@/components/ChinaMap';
import { Sheet, SheetContent, SheetDescription, SheetTitle } from '@/components/ui/sheet';
import { useSettings } from '@/contexts/AppSettings';
import { useMuseum } from '@/contexts/MuseumContext';
import { getBreedById } from '@/data/breedLookup';
import { matchesBreedQuery } from '@/data/breedSearch';
import { type Breed, breeds } from '@/data/breeds';
import { useMediaQuery } from '@/hooks/useMediaQuery';

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useSettings();
  const { selectedCategory, selectedProvince, setSelectedProvince, selectedBreedId, setSelectedBreedId,
    setSelectedCategory, searchValue, setSearchValue, triggerPulse, pulseId, toggleCompare, isInCompare } = useMuseum();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [detailOpen, setDetailOpen] = useState(false);
  const [showAllBreeds, setShowAllBreeds] = useState(false);
  const breedIdParam = params.get('breed_id');
  const queryParam = params.get('search');
    useEffect(() => {
    if (queryParam !== null) {
      setSelectedCategory(null); setSelectedProvince(null); setSelectedBreedId(null); setSearchValue(queryParam);
    }
  }, [queryParam, setSelectedCategory, setSelectedProvince, setSelectedBreedId, setSearchValue]);
  useEffect(() => {
    const breed = getBreedById(breedIdParam);
    if (breed) {
      setSelectedCategory(breed.category); setSelectedProvince(null); setSelectedBreedId(breed.id);
      triggerPulse(breed.id); setDetailOpen(true);
    } else if (breedIdParam) {
      // 无效或已更名的 breed_id：清除参数，避免分享链接与页面内容不一致
      setParams(prev => { const next = new URLSearchParams(prev); next.delete('breed_id'); return next; }, { replace: true });
    }
  }, [breedIdParam, setParams, setSelectedCategory, setSelectedProvince, setSelectedBreedId, triggerPulse]);
  useEffect(() => {
    setShowAllBreeds(false);
  }, [selectedCategory, selectedProvince, searchValue]);
  const filtered = useMemo(() => breeds.filter(b =>
    (!selectedCategory || b.category === selectedCategory) && (!selectedProvince || b.province === selectedProvince) && matchesBreedQuery(b, searchValue)
  ), [selectedCategory, selectedProvince, searchValue]);
  const selectedBreed = filtered.find(b => b.id === selectedBreedId) ?? filtered[0] ?? null;
  const selectBreed = useCallback((breed: Breed) => {
    setSelectedBreedId(breed.id);
    setDetailOpen(true);
    // 同步到 URL，让“复制链接分享”始终指向当前查看的品种
    setParams(prev => {
      const next = new URLSearchParams(prev);
      if (next.get('breed_id') !== breed.id) next.set('breed_id', breed.id);
      return next;
    }, { replace: true });
  }, [setParams, setSelectedBreedId]);
  const reset = () => { setSelectedCategory(null); setSelectedProvince(null); setSelectedBreedId(null); setSearchValue(''); setParams({}); };
  const handleToggleCompare = () => {
    if (!selectedBreed) return;
    const alreadySelected = isInCompare(selectedBreed.id);
    const added = toggleCompare(selectedBreed.id);
    if (!alreadySelected && !added) toast.warning(t('detail.compareFull'));
  };
  const detail = <BreedDetail breed={selectedBreed} onToggleCompare={handleToggleCompare} isInCompare={selectedBreed ? isInCompare(selectedBreed.id) : false} />;
  return <div className="flex min-h-full flex-col lg:h-full lg:flex-row">
    <section className="min-w-0 flex-1 p-3 md:p-5 flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-serif text-xl font-semibold">{t('map.title')}</h1>
        <span role="status" aria-live="polite" className="text-sm text-muted-foreground">{filtered.length} {t('map.breedUnit')}{selectedProvince ? ' · ' + selectedProvince : ''}</span>
      </div>
      <div className="min-h-[320px] h-[45vh] lg:h-auto lg:flex-1 rounded-xl border border-border/40 bg-card p-2">
        <ChinaMap breeds={filtered} selectedProvince={selectedProvince} selectedBreed={selectedBreed} pulseId={pulseId}
          onProvinceClick={province => setSelectedProvince(province === selectedProvince ? null : province)}
          onBreedClick={selectBreed} onClearSelection={() => { setSelectedBreedId(null); setSelectedProvince(null); }} />
      </div>
      <div className="flex flex-wrap gap-2" aria-label={t('map.breedResults')}>
        {!showAllBreeds && filtered.slice(0, 8).map(breed => <button type="button" key={breed.id} onClick={() => selectBreed(breed)} aria-pressed={selectedBreed?.id === breed.id}
          className="min-h-11 rounded-lg border border-border/40 bg-card px-3 text-sm hover:bg-secondary">{breed.name}</button>)}
        {filtered.length > 8 && <button
          type="button"
          aria-expanded={showAllBreeds}
          aria-controls="map-breed-results-all"
          aria-label={showAllBreeds ? t('map.collapseAll').replace('{n}', String(filtered.length)) : t('map.showAllCount').replace('{n}', String(filtered.length))}
          onClick={() => setShowAllBreeds((expanded) => !expanded)}
          className="min-h-11 rounded-lg border border-primary/40 px-3 text-sm text-primary hover:bg-secondary"
        >
          {showAllBreeds ? t('map.collapseList') : t('map.showAllShort').replace('{n}', String(filtered.length))}
        </button>}
        {showAllBreeds && <ul id="map-breed-results-all" aria-label={t('map.allFiltered')} className="basis-full grid max-h-96 gap-2 overflow-auto rounded-lg border border-border/40 p-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((breed, index) => <li key={breed.id} aria-setsize={filtered.length} aria-posinset={index + 1}>
            <button type="button" onClick={() => selectBreed(breed)} aria-pressed={selectedBreed?.id === breed.id}
              aria-label={t('map.nameProvince').replace('{name}', breed.name).replace('{province}', breed.province)}
              className="min-h-11 w-full rounded-lg border border-border/40 bg-card px-3 text-left text-sm hover:bg-secondary">{breed.name}</button>
          </li>)}
        </ul>}
        {filtered.length === 0 && <p className="py-4 text-muted-foreground">{t('map.noMatch')}</p>}
        {(searchValue || selectedCategory || selectedProvince) && <button type="button" onClick={reset} className="min-h-11 rounded-lg px-3 text-sm text-primary underline underline-offset-4">{t('map.clearFilters')}</button>}
      </div>
      <p className="text-xs text-muted-foreground">{t('map.pointsNote')}</p>
      {/* 折叠入口：从地图进入数据看板（导航精简后仍可发现） */}
      <div className="flex flex-wrap items-center gap-3 rounded-xl border border-dashed border-border p-3 text-xs">
        <span className="text-muted-foreground">{t('map.dashboardHint')}</span>
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="min-h-9 rounded-lg border border-primary/40 px-3 text-xs text-primary hover:bg-secondary"
        >
          {t('map.openDashboard')}
        </button>
      </div>
    </section>
    {desktop && <aside aria-label={t('map.detailAria')} className="hidden lg:block lg:w-[350px] xl:w-[390px] shrink-0 border-l border-border/30 bg-card overflow-hidden">{detail}</aside>}
    <Sheet open={detailOpen && !desktop} onOpenChange={setDetailOpen}>
      <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl p-0 flex flex-col gap-0 lg:hidden">
        <div className="shrink-0 border-b px-5 py-3 pr-16"><SheetTitle>{selectedBreed?.name ?? t('map.detailAria')}</SheetTitle><SheetDescription>{t('map.detailSheetDesc')}</SheetDescription></div>
        <div className="min-h-0 flex-1">{detail}</div>
      </SheetContent>
    </Sheet>
  </div>;
}
