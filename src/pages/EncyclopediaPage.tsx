import { ArrowUpRight, Check, ChevronDown, ExternalLink, GitCompare, ImageOff, MapPin, Search, Shuffle, SlidersHorizontal, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import { getBreedMetadata, getBreedSource } from '@/data/breedMetadata';
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
  const selectedMetadata = selectedBreed ? getBreedMetadata(selectedBreed) : null;
  const selectedSources = selectedMetadata?.sourceIds.map((sourceId) => getBreedSource(sourceId)).filter(Boolean) ?? [];

  useEffect(() => {
    const next = params.get('breed');
    setSelectedBreedId(next);
  }, [params]);

  useEffect(() => {
    if (!selectedBreedId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') closeDetail(); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedBreedId]);

  const updateParams = (updates: Record<string, string>) => {
    const next = new URLSearchParams(params);
    Object.entries(updates).forEach(([key, value]) => value && value !== '全部' ? next.set(key, value) : next.delete(key));
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
    const source = filteredBreeds.length ? filteredBreeds : breeds;
    const picked = source[Math.floor(Math.random() * source.length)];
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
      <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 lg:px-10 lg:py-8">
        <header className="mb-5 flex flex-col gap-4 border-b border-stage-border pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div><p className="font-mono text-[0.65rem] uppercase tracking-[0.28em] text-stage-gold">ENCYCLOPEDIA · 品种百科</p><h1 className="mt-2 font-serif text-3xl tracking-tight sm:text-4xl">从名字找到一条地方记忆</h1><p className="mt-2 max-w-[58ch] text-sm leading-6 text-stage-muted">{COLLECTION_SUMMARY.total.toLocaleString()} 条馆藏记录，按名称、产区与类别快速筛选。</p></div>
          <div className="flex flex-wrap gap-2"><button type="button" onClick={randomBreed} className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-stage-border px-3 text-sm text-stage-fg transition-colors hover:border-stage-gold"><Shuffle className="h-4 w-4" aria-hidden="true" />随机一条</button><Link to="/explore" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-stage-gold px-3 text-sm font-semibold text-stage"><MapPin className="h-4 w-4" aria-hidden="true" />在地图探索</Link></div>
        </header>

        <div className="mb-5 rounded-xl border border-stage-gold/35 bg-stage-panel/80 px-4 py-3 text-xs leading-5 text-stage-muted"><strong className="font-medium text-stage-fg">图片说明</strong><span className="mx-2 text-stage-gold">·</span>优先展示已登记图片；来源待核验或缺失的记录会使用博物馆示意图，详情中会明确资料边界。</div>

        <section aria-label="百科筛选" className="mb-5 rounded-2xl border border-stage-border bg-stage-panel p-3 sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center"><label className="relative min-w-0 flex-1"><span className="sr-only">搜索品种名称、别名或描述</span><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stage-muted" aria-hidden="true" /><input value={query} onChange={(event) => updateQuery(event.target.value)} type="search" placeholder="搜索品种名称、别名或特征……" className="min-h-11 w-full rounded-lg border border-stage-border bg-stage-soft pl-10 pr-3 text-sm text-stage-fg outline-none transition-colors placeholder:text-stage-muted focus:border-stage-gold focus:ring-2 focus:ring-stage-gold/20" /></label><div className="flex flex-wrap items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-stage-muted" aria-hidden="true" /><select aria-label="按类别筛选" value={category} onChange={(event) => updateCategory(event.target.value)} className="min-h-11 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"><option>全部</option>{categories.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="按省份筛选" value={province} onChange={(event) => updateProvince(event.target.value)} className="min-h-11 max-w-[9rem] rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"><option>全部</option>{provinces.map((item) => <option key={item}>{item}</option>)}</select><select aria-label="按濒危等级筛选" value={level} onChange={(event) => updateLevel(event.target.value)} className="min-h-11 rounded-lg border border-stage-border bg-stage-soft px-3 text-sm text-stage-fg outline-none focus:border-stage-gold"><option>全部</option>{levels.map((item) => <option key={item}>{item}</option>)}</select>{hasFilters && <button type="button" onClick={clearFilters} aria-label="清空筛选" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-2 text-sm text-stage-muted hover:text-stage-fg"><X className="h-4 w-4" />清空</button>}</div></div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-xs text-stage-muted"><span>当前显示 <strong className="font-mono text-stage-fg">{filteredBreeds.length.toLocaleString()}</strong> 条</span><span>已有 {withImages.toLocaleString()} 条记录登记图片 · 已选 {compareIds.length} 条对比</span></div>
        </section>

        {visibleBreeds.length ? <>
          <section aria-label="品种百科结果" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {visibleBreeds.map((breed) => {
              const metadata = getBreedMetadata(breed);
              const categoryColor = categoryColors[breed.category] ?? '#d4a853';
              return <article key={breed.id} className="group overflow-hidden rounded-2xl border border-stage-border bg-stage-panel text-left transition duration-200 hover:-translate-y-0.5 hover:border-stage-gold hover:shadow-[0_16px_38px_rgba(0,0,0,.18)]">
                <button type="button" onClick={() => openBreed(breed.id)} className="block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stage-gold" aria-label={`查看${breed.name}详情`}>
                  <div className="relative aspect-[1.45] overflow-hidden bg-stage-soft"><BreedImage src={breed.image} alt={`${breed.name}图片`} category={breed.category} breedName={breed.name} className="h-full w-full" imgClassName="transition duration-500 group-hover:scale-105" sizes="(min-width: 1280px) 240px, (min-width: 640px) 33vw, 100vw" /><span className="absolute left-3 top-3 rounded-md border px-2 py-1 text-[11px]" style={{ borderColor: `${categoryColor}88`, color: categoryColor, background: 'rgb(8 14 12 / .82)' }}>{breed.category}</span><span className={`absolute right-3 top-3 rounded-md border px-2 py-1 text-[11px] ${statusClass(breed.endangered)}`}>{breed.endangered}</span></div>
                  <div className="p-4 pb-3"><div className="flex items-start justify-between gap-2"><div className="min-w-0"><h2 className="truncate font-serif text-lg text-stage-fg">{breed.name}</h2><p className="mt-0.5 truncate text-xs text-stage-muted">{breed.englishName}</p></div><ArrowUpRight className="mt-1 h-4 w-4 shrink-0 text-stage-muted transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-stage-gold" aria-hidden="true" /></div><div className="mt-3 flex items-center gap-2 text-xs text-stage-muted"><MapPin className="h-3.5 w-3.5" aria-hidden="true" />{breed.province}<span aria-hidden="true">·</span><span>{metadata.aliases.length ? `别名 ${metadata.aliases.length}` : '官方名录'}</span></div></div>
                </button>
                <div className="flex items-center justify-between border-t border-stage-border/70 px-4 py-2.5"><button type="button" onClick={() => openBreed(breed.id)} className="inline-flex min-h-8 items-center gap-1 text-xs text-stage-muted hover:text-stage-gold">查看详情 <ArrowUpRight className="h-3.5 w-3.5" /></button><button type="button" onClick={() => toggleCompare(breed.id)} aria-pressed={isInCompare(breed.id)} className={`inline-flex min-h-8 items-center gap-1 rounded-md border px-2.5 text-xs transition-colors ${isInCompare(breed.id) ? 'border-stage-gold bg-stage-gold/15 text-stage-gold' : 'border-stage-border text-stage-muted hover:border-stage-gold hover:text-stage-fg'}`}><GitCompare className="h-3.5 w-3.5" />{isInCompare(breed.id) ? '已加入' : '加入对比'}</button></div>
              </article>;
            })}
          </section>
          <div className="mt-6 flex justify-center">{visibleCount < filteredBreeds.length ? <button type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)} className="inline-flex min-h-11 items-center rounded-lg border border-stage-border px-5 text-sm text-stage-fg hover:border-stage-gold">加载更多 · 还剩 {(filteredBreeds.length - visibleCount).toLocaleString()} 条</button> : <p className="text-xs text-stage-muted">已显示全部匹配记录</p>}</div>
        </> : <div className="rounded-2xl border border-dashed border-stage-border bg-stage-panel px-6 py-20 text-center"><ImageOff className="mx-auto h-8 w-8 text-stage-muted" aria-hidden="true" /><h2 className="mt-3 font-serif text-xl">没有匹配的品种</h2><p className="mt-2 text-sm text-stage-muted">调整关键词或筛选条件，再试一次。</p><button type="button" onClick={clearFilters} className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-stage-gold px-4 text-sm font-semibold text-stage">查看全部品种</button></div>}

        <footer className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-stage-border pt-4 text-xs text-stage-muted"><span>数据版本 {COLLECTION_SUMMARY.total.toLocaleString()} 条 · 名称与类别依据国家名录核对</span><Link to="/dashboard" className="underline underline-offset-4 hover:text-stage-fg">查看数据口径</Link></footer>
      </div>

      {selectedBreed && selectedMetadata && <div className="museum-drawer-backdrop fixed inset-0 z-50 flex items-end justify-end bg-black/60" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) closeDetail(); }}><aside role="dialog" aria-modal="true" aria-label={`${selectedBreed.name}详情`} className="museum-breed-drawer ml-auto flex h-full w-full max-w-xl flex-col overflow-y-auto border-l border-stage-border bg-stage-panel shadow-2xl"><div className="sticky top-0 z-10 flex items-center justify-between border-b border-stage-border bg-stage-panel/95 px-5 py-3 backdrop-blur"><div><p className="font-mono text-[0.6rem] uppercase tracking-[0.2em] text-stage-gold">BREED RECORD · 品种记录</p><p className="mt-1 text-xs text-stage-muted">{selectedBreed.province} · {selectedBreed.category}</p></div><button type="button" aria-label="关闭详情" onClick={closeDetail} className="rounded-full p-2 text-stage-muted hover:bg-stage-soft hover:text-stage-fg"><X className="h-5 w-5" /></button></div><div className="p-5 sm:p-7"><div className="relative overflow-hidden rounded-2xl bg-stage-soft"><BreedImage src={selectedBreed.image} alt={`${selectedBreed.name}图片`} category={selectedBreed.category} breedName={selectedBreed.name} className="aspect-[1.55] w-full" eager imgClassName="object-cover" /><div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 bg-gradient-to-t from-black/75 to-transparent p-4 pt-12"><div><h2 className="font-serif text-3xl text-white">{selectedBreed.name}</h2><p className="mt-1 text-xs text-white/70">{selectedBreed.englishName}</p></div><span className="rounded-md border border-white/30 bg-black/35 px-2 py-1 text-xs text-white">{selectedBreed.endangered}</span></div></div><div className="mt-4 flex flex-wrap items-center gap-2"><span className="rounded-md border border-stage-gold/50 bg-stage-gold/10 px-2.5 py-1 text-xs text-stage-gold">{selectedBreed.category}</span><span className="inline-flex items-center gap-1 text-xs text-stage-muted"><MapPin className="h-3.5 w-3.5" />{selectedBreed.province}</span><button type="button" onClick={() => toggleCompare(selectedBreed.id)} className={`ml-auto inline-flex min-h-10 items-center gap-1.5 rounded-lg border px-3 text-xs transition-colors ${isInCompare(selectedBreed.id) ? 'border-stage-gold bg-stage-gold/15 text-stage-gold' : 'border-stage-border text-stage-muted hover:border-stage-gold hover:text-stage-fg'}`}><GitCompare className="h-4 w-4" />{isInCompare(selectedBreed.id) ? '已加入对比' : '加入对比'}</button></div><p className="mt-5 text-sm leading-7 text-stage-fg/90">{selectedBreed.story || '故事资料待补充。'}</p><div className="mt-5 grid gap-3 sm:grid-cols-2"><div className="rounded-xl bg-stage-soft p-4"><p className="text-xs text-stage-muted">体貌特征</p><p className="mt-2 text-sm leading-6 text-stage-fg">{selectedBreed.appearance || '资料待补充'}</p></div><div className="rounded-xl bg-stage-soft p-4"><p className="text-xs text-stage-muted">生产性能</p><p className="mt-2 text-sm leading-6 text-stage-fg">{selectedBreed.performance || '资料待补充'}</p></div></div><details className="group mt-6 rounded-xl border border-stage-border bg-stage-soft"><summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-stage-fg"><span>更多资料</span><ChevronDown className="h-4 w-4 text-stage-muted transition-transform group-open:rotate-180" /></summary><div className="space-y-4 border-t border-stage-border px-4 py-4 text-xs leading-6 text-stage-muted"><div><p className="text-stage-fg">来源与核验</p><dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5"><dt>名录状态</dt><dd className="text-stage-fg">{selectedMetadata.officialName}</dd><dt>保护状态</dt><dd className="text-stage-fg">{selectedMetadata.protectionStatus === 'national-list' ? '国家级保护名录匹配' : selectedMetadata.protectionStatus === 'not-on-national-list' ? '未匹配国家级保护名录' : '待核验'}</dd><dt>核验时间</dt><dd className="text-stage-fg">{selectedMetadata.verifiedAt}</dd></dl></div><div><p className="text-stage-fg">雷达指标</p><div className="mt-2 grid grid-cols-2 gap-2">{Object.entries(selectedBreed.radar).map(([key, value]) => <span key={key} className="flex items-center justify-between rounded-md border border-stage-border px-2 py-1"><span>{key}</span><strong className="font-mono text-stage-fg">{value ?? '待核验'}</strong></span>)}</div></div>{selectedSources.length > 0 && <div><p className="text-stage-fg">资料来源</p><ul className="mt-2 space-y-1">{selectedSources.map((source) => source && <li key={source.id}>{source.url ? <a href={source.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-stage-gold underline-offset-2 hover:underline">{source.title}<ExternalLink className="h-3 w-3" /></a> : source.title}</li>)}</ul></div>}<p className="border-t border-stage-border pt-3">图片与编辑濒危标签均遵循馆内核验口径，不能替代统一试验或官方鉴定。</p></div></details><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-stage-border pt-4 text-xs"><Link to={`/explore?breed_id=${encodeURIComponent(selectedBreed.id)}`} onClick={closeDetail} className="inline-flex items-center gap-1 text-stage-gold hover:underline">在地图中查看 <ArrowUpRight className="h-3.5 w-3.5" /></Link><Link to="/compare" className="text-stage-muted hover:text-stage-fg">对比栏已选择 {compareIds.length} / 4</Link></div></div></aside></div>}
    </div>
  );
}
