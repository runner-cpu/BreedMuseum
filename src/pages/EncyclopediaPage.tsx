import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { VirtuosoGrid } from 'react-virtuoso';
import { MapPin, Search, X, SearchX, Download, Shuffle } from 'lucide-react';
import { breeds, categories, provinces, endangeredLevels } from '@/data/breeds';
import { categoryColors, endangeredColors } from '@/lib/categoryIcons';
import { renderCategorySvgIcon } from '@/lib/categorySvgIcons';
import { useMuseum } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import { preloadBreedImages } from '@/lib/preload';
import { exportBreedsToCSV } from '@/lib/export';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const EncyclopediaPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { selectedCategory, setSelectedCategory, setSelectedBreedId } = useMuseum();
  const { t } = useSettings();
  const [filterProvince, setFilterProvince] = useState<string>('all');
  const [filterEndangered, setFilterEndangered] = useState<string>('all');
  const [searchInput, setSearchInput] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showSkeleton, setShowSkeleton] = useState(false);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
  const clickTimer = useRef<number | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  // 虚拟滚动容器：页面滚动发生在 Layout 的 <main> 元素上
  useEffect(() => {
    setScrollParent(rootRef.current?.closest('main') ?? null);
  }, []);

  // 支持 URL 参数联动：/encyclopedia?province=xx 与 ?search=xx
  useEffect(() => {
    const province = searchParams.get('province');
    const search = searchParams.get('search');
    if (province && provinces.includes(province)) setFilterProvince(province);
    if (search) setSearchInput(search);
  }, [searchParams]);

  // 300ms 搜索防抖
  useEffect(() => {
    const tm = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(tm);
  }, [searchInput]);

  // 切换筛选时先显示骨架屏，营造加载过渡，避免占位卡顿
  useEffect(() => {
    setShowSkeleton(true);
    const t = window.setTimeout(() => setShowSkeleton(false), 240);
    return () => window.clearTimeout(t);
  }, [selectedCategory, filterProvince, filterEndangered, debouncedSearch]);

  // 预加载前10个品种图片到缓存
  useEffect(() => {
    preloadBreedImages(breeds, 10);
  }, []);

  const allMatches = useMemo(() => {
    return breeds.filter((b) => {
      const matchCat = selectedCategory ? b.category === selectedCategory : true;
      const matchProv = filterProvince !== 'all' ? b.province === filterProvince : true;
      const matchEnd = filterEndangered !== 'all' ? b.endangered === filterEndangered : true;
      const matchSearch = debouncedSearch
        ? b.name.toLowerCase().includes(debouncedSearch.toLowerCase())
        : true;
      return matchCat && matchProv && matchEnd && matchSearch;
    });
  }, [selectedCategory, filterProvince, filterEndangered, debouncedSearch]);

  // 搜索时限制最多50条
  const filtered = useMemo(() => {
    return debouncedSearch ? allMatches.slice(0, 50) : allMatches;
  }, [allMatches, debouncedSearch]);

  const totalMatch = allMatches.length;

  const handleCardClick = useCallback(
    (breedId: string) => {
      // 快速连续点击防抖：500ms 内多次点击只执行最后一次
      if (clickTimer.current) window.clearTimeout(clickTimer.current);
      clickTimer.current = window.setTimeout(() => {
        setSelectedBreedId(breedId);
        const breed = breeds.find((b) => b.id === breedId);
        if (breed) setSelectedCategory(breed.category);
        navigate(`/map?breed_id=${breedId}`);
      }, 500);
    },
    [navigate, setSelectedBreedId, setSelectedCategory],
  );

  const clearAll = () => {
    setFilterProvince('all');
    setFilterEndangered('all');
    setSearchInput('');
    setSelectedCategory(null);
    setSelectedBreedId(null);
  };

  const handleExport = () => {
    if (allMatches.length === 0) {
      toast.error(t('enc.exportEmpty'));
      return;
    }
    exportBreedsToCSV(allMatches, '中国地方畜禽品种.csv');
    toast.success(t('enc.exported'));
  };

  const handleRandom = () => {
    const pool = filtered.length > 0 ? filtered : breeds;
    const breed = pool[Math.floor(Math.random() * pool.length)];
    if (breed) handleCardClick(breed.id);
  };

  const hasActiveFilter = selectedCategory || filterProvince !== 'all' || filterEndangered !== 'all' || debouncedSearch;

  return (
    <div ref={rootRef} className="p-4 md:p-8 max-w-6xl mx-auto">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-serif font-bold text-foreground mb-6 border-l-4 border-primary pl-3"
      >
        {t('enc.title')}
      </motion.h1>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('enc.searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <Select value={filterProvince} onValueChange={setFilterProvince}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('enc.filterProvince')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('enc.allProvinces')}</SelectItem>
            {provinces.map((p) => (
              <SelectItem key={p} value={p}>{p}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterEndangered} onValueChange={setFilterEndangered}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder={t('enc.filterLevel')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t('enc.allLevels')}</SelectItem>
            {endangeredLevels.map((l) => (
              <SelectItem key={l} value={l}>{l}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="w-4 h-4 mr-1.5" />
          {t('common.export')}
        </Button>
        <Button variant="outline" size="sm" onClick={handleRandom}>
          <Shuffle className="w-4 h-4 mr-1.5" />
          {t('common.random')}
        </Button>
        {hasActiveFilter && (
          <button
            type="button"
            onClick={clearAll}
            className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-4 h-4" />
            {t('common.clear')}
          </button>
        )}
      </div>

      <div className="flex flex-wrap gap-2 mb-6">
        {categories.map((cat) => {
          const color = categoryColors[cat] ?? '#95A5A6';
          return (
            <button
              key={cat}
              type="button"
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                selectedCategory === cat ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-accent'
              }`}
              style={selectedCategory === cat ? { backgroundColor: color } : undefined}
            >
              {renderCategorySvgIcon(cat, selectedCategory === cat ? '#ffffff' : color, 16)}
              {t(`cat.${cat}`)}
            </button>
          );
        })}
      </div>

      <p className="text-sm text-muted-foreground mb-4">
        {t('enc.total').replace('{n}', String(totalMatch))}
        {debouncedSearch && totalMatch > 50 ? t('enc.searchLimit') : ''}
      </p>

      {showSkeleton ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="bg-card border border-border rounded-xl overflow-hidden">
              <Skeleton className="aspect-[4/3] w-full" />
              <div className="p-3 space-y-2">
                <Skeleton className="h-4 w-2/3" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto mb-4">
            <SearchX className="w-8 h-8 text-muted-foreground" />
          </div>
          <p className="text-base text-foreground font-medium mb-1">
            {debouncedSearch ? t('enc.noResult') : t('enc.emptyFilter')}
          </p>
          <p className="text-sm text-muted-foreground mb-4">
            {debouncedSearch ? t('enc.adjustFilter') : t('common.clear')}
          </p>
          <Button variant="default" onClick={clearAll}>{t('enc.viewAll')}</Button>
        </div>
      ) : (
        // 虚拟滚动：仅渲染可视区域内的卡片，568 个品种流畅浏览
        <VirtuosoGrid
          customScrollParent={scrollParent ?? undefined}
          data={filtered}
          overscan={200}
          listClassName="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          itemContent={(index, breed) => (
            <motion.button
              key={breed.id}
              type="button"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
              whileHover={{ y: -4 }}
              onClick={() => handleCardClick(breed.id)}
              className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-card transition-shadow text-left flex flex-col w-full"
            >
              <div className="aspect-[4/3] overflow-hidden bg-muted">
                <img
                  src={breed.image}
                  alt={breed.name}
                  className="w-full h-full object-cover"
                  loading="lazy"
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
              <div className="p-3 flex flex-col flex-1">
                <h3 className="text-sm font-semibold text-foreground truncate">{breed.name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {breed.province}
                </p>
                <div className="flex items-center gap-1.5 mt-2">
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: categoryColors[breed.category] }}
                  >
                    {breed.category}
                  </span>
                  <span
                    className="px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                    style={{ backgroundColor: endangeredColors[breed.endangered] }}
                  >
                    {breed.endangered}
                  </span>
                </div>
              </div>
            </motion.button>
          )}
        />
      )}
    </div>
  );
};

export default EncyclopediaPage;