import { Download, MapPin, Search, SearchX, Shuffle, X } from 'lucide-react';
import { motion } from 'motion/react';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { VirtuosoGrid } from 'react-virtuoso';
import { toast } from 'sonner';
import { BreedImage } from '@/components/common/BreedImage';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSettings } from '@/contexts/AppSettings';
import { useMuseum } from '@/contexts/MuseumContext';
import { matchesBreedQuery } from '@/data/breedSearch';
import { breeds, categories, endangeredLevels, provinces } from '@/data/breeds';
import { categoryColors, endangeredColors } from '@/lib/categoryIcons';
import { renderCategorySvgIcon } from '@/lib/categorySvgIcons';
import { exportBreedsToCSV } from '@/lib/export';
import type { EncyclopediaQueryState } from '@/lib/queryState';
import { parseEncyclopediaQuery, serializeEncyclopediaQuery } from '@/lib/queryState';

const EncyclopediaPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { selectedCategory, setSelectedCategory, setSelectedBreedId } = useMuseum();
  const { t } = useSettings();
  const initialQueryRef = useRef<EncyclopediaQueryState | null>(null);
  if (initialQueryRef.current === null) {
    initialQueryRef.current = parseEncyclopediaQuery(searchParams, { provinces, categories, endangeredLevels });
  }
  const initialQuery = initialQueryRef.current;
  const [filterProvince, setFilterProvince] = useState<string>(initialQuery.province ?? 'all');
  const [filterEndangered, setFilterEndangered] = useState<string>(initialQuery.endangered ?? 'all');
  const [searchInput, setSearchInput] = useState(initialQuery.search);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQuery.search);
  const [scrollParent, setScrollParent] = useState<HTMLElement | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);
  const queryString = searchParams.toString();
  const initialContextCategoryRef = useRef(selectedCategory);
  const initializedFromUrlRef = useRef(false);
  const applyingUrlStateRef = useRef(false);

  // 虚拟滚动容器：页面滚动发生在 Layout 的 <main> 元素上
  useEffect(() => {
    setScrollParent(rootRef.current?.closest('main') ?? null);
  }, []);

  // Keep shared links canonical and restore state when browser navigation changes the query.
  useEffect(() => {
    const parsed = parseEncyclopediaQuery(searchParams, { provinces, categories, endangeredLevels });
    const isInitial = !initializedFromUrlRef.current;
    const category = isInitial && parsed.category === null ? initialContextCategoryRef.current : parsed.category;

    applyingUrlStateRef.current = true;
    setFilterProvince(parsed.province ?? 'all');
    setFilterEndangered(parsed.endangered ?? 'all');
    setSearchInput(parsed.search);
    setSelectedCategory(category);

    const canonical = serializeEncyclopediaQuery({
      search: parsed.search,
      province: parsed.province,
      category,
      endangered: parsed.endangered,
    });
    if (canonical !== queryString) {
      setSearchParams(canonical, { replace: true });
    }
    initializedFromUrlRef.current = true;
  }, [queryString, searchParams, setSearchParams, setSelectedCategory]);

  // State changes made by the controls are reflected in a stable share URL.
  useEffect(() => {
    if (applyingUrlStateRef.current) {
      applyingUrlStateRef.current = false;
      return;
    }
    const canonical = serializeEncyclopediaQuery({
      search: searchInput,
      province: filterProvince,
      category: selectedCategory,
      endangered: filterEndangered,
    });
    if (canonical !== queryString) {
      setSearchParams(canonical, { replace: true });
    }
  }, [filterEndangered, filterProvince, queryString, searchInput, selectedCategory, setSearchParams]);

  // 300ms 搜索防抖
  useEffect(() => {
    const tm = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 300);
    return () => window.clearTimeout(tm);
  }, [searchInput]);

  const allMatches = useMemo(() => {
    return breeds.filter((b) => {
      const matchCat = selectedCategory ? b.category === selectedCategory : true;
      const matchProv = filterProvince !== 'all' ? b.province === filterProvince : true;
      const matchEnd = filterEndangered !== 'all' ? b.endangered === filterEndangered : true;
      const matchSearch = matchesBreedQuery(b, debouncedSearch);
      return matchCat && matchProv && matchEnd && matchSearch;
    });
  }, [selectedCategory, filterProvince, filterEndangered, debouncedSearch]);

  const filtered = allMatches;

  const totalMatch = allMatches.length;

  const handleCardClick = useCallback(
    (breedId: string) => {
      setSelectedBreedId(breedId);
      // Let MapPage derive the category from the breed_id query. Updating the
      // shared category here races the URL-sync effect below and can overwrite
      // the navigation with the current encyclopedia query string.
      navigate(`/map?breed_id=${breedId}`);
    },
    [navigate, setSelectedBreedId],
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
            type="search"
            aria-label="搜索百科品种"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={t('enc.searchPlaceholder')}
            className="pl-8"
          />
        </div>
        <Select value={filterProvince} onValueChange={setFilterProvince}>
          <SelectTrigger aria-label="筛选省份" className="w-[140px] min-h-11">
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
          <SelectTrigger aria-label="筛选濒危等级" className="w-[140px] min-h-11">
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
              aria-pressed={selectedCategory === cat}
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

      <p role="status" aria-live="polite" className="text-sm text-muted-foreground mb-4">
        {t('enc.total').replace('{n}', String(totalMatch))}
      </p>

      {filtered.length === 0 ? (
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
        // 虚拟滚动：仅渲染可视区域内的卡片，不截断搜索结果
        <VirtuosoGrid
          customScrollParent={scrollParent ?? undefined}
          data={filtered}
          overscan={200}
          listClassName="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
          itemContent={(index, breed) => (
            <motion.button
              key={breed.id}
              type="button"
              aria-label={`查看${breed.name}`}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(index * 0.03, 0.3) }}
              whileHover={{ y: -4 }}
              onClick={() => handleCardClick(breed.id)}
              className="bg-card border border-border rounded-xl overflow-hidden hover:shadow-card transition-shadow text-left flex flex-col w-full"
            >
              <BreedImage
                src={breed.image}
                alt={breed.name}
                className="aspect-[4/3] w-full bg-muted"
                imgClassName="object-cover"
              />
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
