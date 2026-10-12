import { ArrowUpRight, Check, ImageOff, MapPin, Search, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import { getBreedMetadata } from '@/data/breedMetadata';
import { matchesBreedQuery, sortBreedsByRelevance } from '@/data/breedSearch';
import { breeds, categories, endangeredLevels, provinces } from '@/data/breeds';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { categoryColors } from '@/lib/categoryIcons';
import { useMuseum } from '@/contexts/MuseumContext';

const PAGE_SIZE = 24;
const levels = endangeredLevels.filter((level) => level !== '极危');
const imageAvailable = (src: string) => Boolean(src) && !src.includes('breed-placeholder');

function statusClass(level: string) {
  if (level === '濒危' || level === '极危') return 'border-red-400/50 bg-red-400/10 text-red-200';
  if (level === '易危') return 'border-amber-300/50 bg-amber-300/10 text-amber-100';
  return 'border-stage-border bg-stage-soft text-stage-muted';
}

export default function EncyclopediaPage() {
  const [params, setParams] = useSearchParams();
  const [query, setQuery] = useState(params.get('search') ?? '');
  const [category, setCategory] = useState(params.get('category') ?? '全部');
  const [province, setProvince] = useState(params.get('province') ?? '全部');
  const [level, setLevel] = useState(params.get('level') ?? '全部');
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(params.get('breed'));
  const { toggleCompare, isInCompare, compareIds } = useMuseum();

  const filteredBreeds = useMemo(() => {
    const result = breeds.filter((breed) => {
      if (category !== '全部' && breed.category !== category) return false;
      if (province !== '全部' && breed.province !== province) return false;
      if (level !== '全部' && breed.endangered !== level) return false;
      return matchesBreedQuery(breed, query);
    });
    return sortBreedsByRelevance(result, query).sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
  }, [category, level, province, query]);

  const visibleBreeds = filteredBreeds.slice(0, visibleCount);
  const withImages = useMemo(() => breeds.filter((breed) => imageAvailable(breed.image)).length, []);
  const hasFilters = Boolean(query.trim()) || category !== '全部' || province !== '全部' || level !== '全部';
  const selectedBreed = useMemo(() => selectedBreedId ? breeds.find((breed) => breed.id === selectedBreedId) ?? null : null, [selectedBreedId]);

  useEffect(() => {
    const next = params.get('breed');
    if (next) setSelectedBreedId(next);
  }, [params]);

  const updateQuery = (value: string) => {
    setQuery(value);
    setVisibleCount(PAGE_SIZE);
    const next = new URLSearchParams(params);
    if (value.trim()) next.set('search', value.trim()); else next.delete('search');
    setParams(next, { replace: true });
  };

  const clearFilters = () => {
    setQuery('');
    setCategory('全部');
    setProvince('全部');
    setLevel('全部');
    setVisibleCount(PAGE_SIZE);
    setParams({}, { replace: true });
  };

  const randomBreed = () => {
    const source = filteredBreeds.length ? filteredBreeds : breeds;
    const picked = source[Math.floor(Math.random() * source.length)];
    if (picked) { setSelectedBreedId(picked.id); setParams({ breed: picked.id }, { replace: true }); }
  };

  const openBreed = (id: string) => { setSelectedBreedId(id); setParams({ ...Object.fromEntries(params.entries()), breed: id }, { replace: true }); };
  const closeDetail = () => { setSelectedBreedId(null); const next = new URLSearchParams(params); next.delete('breed'); setParams(next, { replace: true }); };

  return (
    <div className="min-h-full bg-stage text-stage-fg">
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-stage-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-stage-gold">ENCYCLOPEDIA · 品种百科</p>
            <h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">从名字找到一条地方记忆</h1>
            <p className="mt-2 text-sm text-stage-muted">{COLLECTION_SUMMARY.total.toLocaleString()} 条馆藏记录，按名称、产区与类别快速筛选。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={randomBreed} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stage-border px-3 text-sm text-stage-fg transition-colors hover:border-stage-gold"><Shuffle className="h-4 w-4" aria-hidden="true" />随机一条</button>
            <Link to="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-stage-gold px-3 text-sm font-semibold text-stage"><MapPin className="h-4 w-4" aria-hidden="true" />在地图探索</Link>
          </div>
        </header>

        <section aria-label="百科筛选" className="mb-5 rounded-2xl border border-stage-border bg-stage-panel p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center">
            <label className="relative min-w-0 flex-1"><span className="sr-only">搜索品种名称、别名或描述</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stage-muted" aria-hidden="true" /><input value={query} onChange={(event) => updateQuery(event.target.value)} type="search" placeholder="搜索品种名称、别名或特征……" className="min-h-11 w-full rounded-lg border border-stage-border bg-stage-soft pl-10 pr-3 text-sm text-stage-fg outline-none transition-colors placeholder:text-stage-muted focus:border-stage-gold focus:ring-2 focus:ring-stage-gold/20" /></label>
            <div className="flex flex-wrap items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-stage-muted" aria-hidden="true" />
              <select aria-label="按类别筛选" value={category} onChange={(event) => { setCategory(event.target.value); setVisibleCount(PAGE_SIZE); }} className="min-h-11 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"><option>全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select>
              <select aria-label="按省份筛选" value={province} onChange={(event) => { setProvince(event.target.value); setVisibleCount(PAGE_SIZE); }} className="min-h-11 max-w-[9rem] rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"><option>全部</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select>
              <select aria-label="按濒危等级筛选" value={level} onChange={(event) => { setLevel(event.target.value); setVisibleCount(PAGE_SIZE); }} className="min-h-11 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"><option>全部</option>{levels.map((item) => <option key={item}>{item}</option>)}</select>
              {hasFilters && <button type="button" onClick={clearFilters} aria-label="清空筛选" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-stage-muted hover:text-stage-fg"><X className="h-4 w-4" />清空</button>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stage-muted"><span>当前显示 <strong className="font-mono text-stage-fg">{filteredBreeds.length.toLocaleString()}</strong> 条</span><span>{withImages.toLocaleString()} 条历史外链（来源待核验） · 其余使用博物馆示意图</span></div>
        </section>

        {visibleBreeds.length ? <>
          <section aria-label="品种百科结果" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleBreeds.map((breed) => {
              const metadata = getBreedMetadata(breed);
              return <button type="button" key={breed.id} onClick={() => openBreed(breed.id)} className="group overflow-hidden rounded-2xl border border-stage-border bg-stage-panel text-left transition duration-200 hover:-translate-y-0.5 hover:border-stage-gold hover:shadow-[0_16px_38px_rgba(0,0,0,.18)]">
                <div className="relative aspect-[1.45] overflow-hidden bg-stage-soft"><BreedImage src={breed.image} alt={`${breed.name}图片`} className="h-full w-full" imgClassName="transition duration-500 group-hover:scale-105" sizes="(min-width: 1280px) 240px, (min-width: 640px) 33vw, 100vw" /><span className="absolute left-3 top-3 rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: `${categoryColors[breed.category] ?? '#d4a853'}88`, color: categoryColors[breed.category] ?? '#d4a853', background: 'rgb(8 14 12 / .82)' }}>{breed.category}</span><span className={`absolute right-3 top-3 rounded-md border px-2 py-1 text-[11px] ${statusClass(breed.endangered)}`}>{breed.endangered}</span><span className="absolute bottom-3 left-3 rounded bg-black/65 px-2 py-1 text-[10px] text-white/80">{imageAvailable(breed.image) ? '图片来源待核验' : '图片待补充'}</span></div>
                <div className="p-4"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-serif text-lg text-stage-fg">{breed.name}</h2><p className="mt-0.5 truncate text-xs text-stage-muted">{breed.englishName}</p></div><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-stage-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-stage-gold" aria-hidden="true" /></div><div className="mt-3 flex items-center gap-2 text-xs text-stage-muted"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{breed.province}<span aria-hidden="true">·</span><span>{metadata.aliases.length ? `别名 ${metadata.aliases.length}` : '官方名录'}</span></div></div>
              </button>;
            })}
          </section>
          <div className="mt-6 flex justify-center">{visibleCount < filteredBreeds.length ? <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="inline-flex min-h-11 items-center rounded-lg border border-stage-border px-5 text-sm text-stage-fg transition-colors hover:border-stage-gold">加载更多 · 还剩 {(filteredBreeds.length - visibleCount).toLocaleString()} 条</button> : <p className="text-xs text-stage-muted">已显示全部匹配记录</p>}</div>
        </> : <div className="rounded-2xl border border-dashed border-stage-border bg-stage-panel px-6 py-20 text-center"><ImageOff className="mx-auto h-8 w-8 text-stage-muted" aria-hidden="true" /><h2 className="mt-3 font-serif text-xl">没有匹配的品种</h2><p className="mt-2 text-sm text-stage-muted">调整关键词或筛选条件，再试一次。</p><button type="button" onClick={clearFilters} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-stage-gold px-4 text-sm font-semibold text-stage">查看全部品种</button></div>}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stage-border pt-4 text-xs text-stage-muted"><span>数据版本 {COLLECTION_SUMMARY.total.toLocaleString()} 条 · 名称与类别依据国家名录核对</span><Link to="/dashboard" className="underline underline-offset-4 hover:text-stage-fg">查看数据口径</Link></footer>
      </div>
      {selectedBreed && <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-6" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}><article role="dialog" aria-modal="true" aria-label={`${selectedBreed.name}详情`} className="max-h-[92vh] w-full max-w-2xl overflow-y-auto rounded-t-2xl border border-stage-border bg-stage-panel shadow-2xl sm:rounded-2xl"><div className="relative aspect-[2.4] min-h-40 overflow-hidden bg-stage-soft"><BreedImage src={selectedBreed.image} alt={`${selectedBreed.name}图片`} className="h-full w-full" eager imgClassName="object-cover" /><button type="button" aria-label="关闭详情" onClick={closeDetail} className="absolute right-3 top-3 rounded-full bg-black/55 p-2 text-white hover:bg-black/75"><X className="h-4 w-4" /></button></div><div className="space-y-4 p-5 sm:p-7"><div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs uppercase tracking-[0.18em] text-stage-gold">{selectedBreed.category} · {selectedBreed.province}</p><h2 className="mt-1 font-serif text-3xl text-stage-fg">{selectedBreed.name}</h2><p className="text-sm text-stage-muted">{selectedBreed.englishName}</p></div><button type="button" onClick={() => toggleCompare(selectedBreed.id)} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stage-gold/70 px-3 text-sm text-stage-gold hover:bg-stage-gold/10">{isInCompare(selectedBreed.id) ? <Check className="h-4 w-4" /> : null}{isInCompare(selectedBreed.id) ? '已加入对比' : '加入对比'}</button></div><div className="grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-stage-soft p-4"><p className="text-xs text-stage-muted">体貌特征</p><p className="mt-2 text-sm leading-6 text-stage-fg">{selectedBreed.appearance || '资料待补充'}</p></div><div className="rounded-xl bg-stage-soft p-4"><p className="text-xs text-stage-muted">生产性能</p><p className="mt-2 text-sm leading-6 text-stage-fg">{selectedBreed.performance || '资料待补充'}</p></div></div><div><p className="text-xs text-stage-muted">文化故事</p><p className="mt-2 text-sm leading-7 text-stage-fg/85">{selectedBreed.story || '故事资料待补充'}</p></div><div className="flex flex-wrap items-center justify-between gap-2 border-t border-stage-border pt-3 text-xs text-stage-muted"><span>对比栏已选择 {compareIds.length} / 4</span><Link to={`/explore?breed_id=${encodeURIComponent(selectedBreed.id)}`} onClick={closeDetail} className="text-stage-gold hover:underline">在地图中查看</Link></div></div></article></div>}
    </div>
  );
}
