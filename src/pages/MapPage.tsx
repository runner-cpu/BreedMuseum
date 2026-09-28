import { useMemo, useState, useEffect, useCallback } from 'react';
import { useMediaQuery } from '@/hooks/useMediaQuery';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ChinaMap } from '@/components/ChinaMap';
import BreedDetail from '@/components/BreedDetail';
import { breeds, type Breed } from '@/data/breeds';
import { matchesBreedQuery } from '@/data/breedSearch';
import { useMuseum, getBreedById } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import { Sheet, SheetContent, SheetTitle, SheetDescription } from '@/components/ui/sheet';

export default function MapPage() {
  const [params, setParams] = useSearchParams();
  const { t, language } = useSettings();
  const { selectedCategory, selectedProvince, setSelectedProvince, selectedBreedId, setSelectedBreedId,
    setSelectedCategory, searchValue, setSearchValue, triggerPulse, pulseId, toggleCompare, isInCompare } = useMuseum();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const [detailOpen, setDetailOpen] = useState(false);
  const breedIdParam = params.get('breed_id');
  const queryParam = params.get('search');
  const zh = language === 'zh';
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
    }
  }, [breedIdParam, setSelectedCategory, setSelectedProvince, setSelectedBreedId, triggerPulse]);
  const filtered = useMemo(() => breeds.filter(b =>
    (!selectedCategory || b.category === selectedCategory) && (!selectedProvince || b.province === selectedProvince) && matchesBreedQuery(b, searchValue)
  ), [selectedCategory, selectedProvince, searchValue]);
  const selectedBreed = filtered.find(b => b.id === selectedBreedId) ?? filtered[0] ?? null;
  const selectBreed = useCallback((breed: Breed) => { setSelectedBreedId(breed.id); setDetailOpen(true); }, [setSelectedBreedId]);
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
      <div className="flex flex-wrap gap-2" aria-label={zh ? '品种搜索结果' : 'Breed results'}>
        {filtered.slice(0, 8).map(breed => <button type="button" key={breed.id} onClick={() => selectBreed(breed)} aria-pressed={selectedBreed?.id === breed.id}
          className="min-h-11 rounded-lg border border-border/40 bg-card px-3 text-sm hover:bg-secondary">{breed.name}</button>)}
        {filtered.length === 0 && <p className="py-4 text-muted-foreground">{zh ? '未找到符合条件的品种。' : 'No matching breeds.'}</p>}
        {(searchValue || selectedCategory || selectedProvince) && <button type="button" onClick={reset} className="min-h-11 rounded-lg px-3 text-sm text-primary underline underline-offset-4">{zh ? '清除筛选' : 'Clear filters'}</button>}
      </div>
      <p className="text-xs text-muted-foreground">{zh ? '地图点位用于示意主要产区，并非精确分布边界。' : 'Points indicate approximate origin areas, not distribution boundaries.'}</p>
    </section>
    {desktop && <aside aria-label={zh ? '品种详情' : 'Breed detail'} className="hidden lg:block lg:w-[350px] xl:w-[390px] shrink-0 border-l border-border/30 bg-card overflow-hidden">{detail}</aside>}
    <Sheet open={detailOpen && !desktop} onOpenChange={setDetailOpen}>
      <SheetContent side="bottom" className="h-[85dvh] rounded-t-2xl p-0 flex flex-col gap-0 lg:hidden">
        <div className="shrink-0 border-b px-5 py-3 pr-16"><SheetTitle>{selectedBreed?.name ?? (zh ? '品种详情' : 'Breed detail')}</SheetTitle><SheetDescription>{zh ? '向下浏览品种特征与数据来源。' : 'Read the breed profile and sources.'}</SheetDescription></div>
        <div className="min-h-0 flex-1">{detail}</div>
      </SheetContent>
    </Sheet>
  </div>;
}
