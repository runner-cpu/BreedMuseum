import React, { useMemo, useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'motion/react';
import { toast } from 'sonner';
import { ChinaMap } from '@/components/ChinaMap';
import BreedDetail from '@/components/BreedDetail';
import { breeds } from '@/data/breeds';
import { useMuseum, getBreedById } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';

const MapPage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const { t } = useSettings();
  const {
    selectedCategory,
    selectedProvince,
    setSelectedProvince,
    selectedBreedId,
    setSelectedBreedId,
    setSelectedCategory,
    searchValue,
    triggerPulse,
    pulseId,
    toggleCompare,
    isInCompare,
  } = useMuseum();

  const [loading, setLoading] = useState(false);
  const [mapKey, setMapKey] = useState(0);
  const debounceRef = useRef<number | null>(null);

  // 从百科页跳转携带的品种ID（URL 参数），强制刷新地图视图
  const breedIdParam = searchParams.get('breed_id');
  useEffect(() => {
    if (breedIdParam) {
      const breed = getBreedById(breedIdParam);
      if (breed) {
        setSelectedCategory(breed.category);
        setSelectedBreedId(breedIdParam);
        setSelectedProvince(breed.province);
        // 强制刷新地图组件，清除之前的选中与高亮
        setMapKey((k) => k + 1);
        // 地图完全加载后再触发定位高亮与脉冲动画（5秒）
        const t = window.setTimeout(() => triggerPulse(breedIdParam), 400);
        return () => window.clearTimeout(t);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breedIdParam]);

  const filteredBreeds = useMemo(() => {
    return breeds.filter((b) => {
      const matchCat = selectedCategory ? b.category === selectedCategory : true;
      const matchProv = selectedProvince ? b.province === selectedProvince : true;
      const matchSearch = searchValue
        ? b.name.toLowerCase().includes(searchValue.toLowerCase())
        : true;
      return matchCat && matchProv && matchSearch;
    });
  }, [selectedCategory, selectedProvince, searchValue]);

  const selectedBreed = useMemo(
    () => breeds.find((b) => b.id === selectedBreedId) ?? filteredBreeds[0] ?? null,
    [selectedBreedId, filteredBreeds],
  );

  const handleProvinceClick = useCallback((province: string) => {
    setSelectedProvince(province === selectedProvince ? null : province);
  }, [selectedProvince, setSelectedProvince]);

  // 点击地图空白区域：清除当前品种与省份高亮
  const handleClearSelection = useCallback(() => {
    setSelectedBreedId(null);
    setSelectedProvince(null);
  }, [setSelectedBreedId, setSelectedProvince]);

  // 点击品种点：防抖处理（1秒内多次点击只执行最后一次）
  const handleBreedClick = useCallback(
    (breed: (typeof breeds)[number]) => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      debounceRef.current = window.setTimeout(() => {
        setSelectedCategory(breed.category);
        setSelectedBreedId(breed.id);
        setSelectedProvince(null);
        setLoading(true);
        window.setTimeout(() => setLoading(false), 250);
      }, 150);
    },
    [setSelectedCategory, setSelectedBreedId, setSelectedProvince],
  );

  const handleToggleCompare = useCallback(() => {
    if (!selectedBreed) return;
    const added = toggleCompare(selectedBreed.id);
    if (!added && !isInCompare(selectedBreed.id)) {
      toast.warning(t('detail.compareFull'));
    }
  }, [selectedBreed, toggleCompare, isInCompare]);

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-0">
      <div className="flex-1 min-w-0 flex flex-col p-3 md:p-4">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.4 }}
          className="flex-1 min-h-0 rounded-xl border border-border bg-card/50 shadow-card p-3 flex flex-col"
        >
          <div className="flex items-center justify-between mb-2 px-1">
            <h2 className="text-base md:text-lg font-serif font-semibold text-foreground border-l-4 border-primary pl-3">
              {t('map.title')}
            </h2>
            <span className="text-xs text-muted-foreground">
              {selectedProvince ? `${selectedProvince} · ` : ''}
              {selectedCategory ? `${selectedCategory}${t('detail.categorySuffix')} · ` : ''}
              {filteredBreeds.length} {t('map.breedUnit')}
            </span>
          </div>
          <div className="flex-1 min-h-0">
            <ChinaMap
              key={mapKey}
              breeds={filteredBreeds}
              selectedProvince={selectedProvince}
              selectedBreed={selectedBreed}
              pulseId={pulseId}
              onProvinceClick={handleProvinceClick}
              onBreedClick={handleBreedClick}
              onClearSelection={handleClearSelection}
            />
          </div>
        </motion.div>
      </div>

      <div className="w-full lg:w-[360px] shrink-0 p-3 md:p-4 lg:pl-0">
        <motion.div
          key={selectedBreed?.id ?? 'empty'}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.3 }}
          className="h-full rounded-xl border border-border bg-card shadow-card overflow-hidden"
        >
          <BreedDetail
            breed={selectedBreed}
            loading={loading}
            onToggleCompare={handleToggleCompare}
            isInCompare={selectedBreed ? isInCompare(selectedBreed.id) : false}
          />
        </motion.div>
      </div>
    </div>
  );
};

export default MapPage;