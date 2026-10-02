import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';

interface MuseumContextValue {
  selectedCategory: string | null;
  setSelectedCategory: (category: string | null) => void;
  searchValue: string;
  setSearchValue: (value: string) => void;
  selectedBreedId: string | null;
  setSelectedBreedId: (id: string | null) => void;
  selectedProvince: string | null;
  setSelectedProvince: (province: string | null) => void;
  compareIds: string[];
  setCompareIds: (ids: readonly string[]) => void;
  toggleCompare: (breedId: string) => boolean;
  isInCompare: (breedId: string) => boolean;
  removeFromCompare: (breedId: string) => void;
  clearCompare: () => void;
  pulseId: string | null;
  triggerPulse: (breedId: string) => void;
}

const MuseumContext = createContext<MuseumContextValue | undefined>(undefined);

export const MuseumProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [selectedCategory, setSelectedCategoryState] = useState<string | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [selectedBreedId, setSelectedBreedId] = useState<string | null>(null);
  const [selectedProvince, setSelectedProvince] = useState<string | null>(null);
  const [compareIds, setCompareIdsState] = useState<string[]>([]);
  const [pulseId, setPulseId] = useState<string | null>(null);
  const compareRef = useRef<string[]>([]);
  const pulseTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(pulseTimer.current), []);

  const setSelectedCategory = useCallback((category: string | null) => {
    setSelectedCategoryState(category);
    setSearchValue('');
  }, []);

  // 触发地图点位脉冲光晕，5秒后自动消失（高亮放大状态由选中品种保持）
  const triggerPulse = useCallback((breedId: string) => {
    setPulseId(breedId);
    clearTimeout(pulseTimer.current);
    pulseTimer.current = setTimeout(() => setPulseId(null), 5000);
  }, []);

  const isInCompare = useCallback((breedId: string) => compareIds.includes(breedId), [compareIds]);

  const setCompareIds = useCallback((ids: readonly string[]) => {
    const next: string[] = [];
    for (const id of ids) {
      const normalized = id.trim();
      if (!normalized || next.includes(normalized)) continue;
      next.push(normalized);
      if (next.length >= 4) break;
    }
    compareRef.current = next;
    setCompareIdsState(next);
  }, []);

  const toggleCompare = useCallback(
    (breedId: string) => {
      const normalized = breedId.trim();
      if (!normalized) return false;
      const prev = compareRef.current;
      const exists = prev.includes(normalized);
      if (!exists && prev.length >= 4) return false;
      const next = exists ? prev.filter(id => id !== normalized) : [...prev, normalized];
      compareRef.current = next; setCompareIdsState(next);
      return !exists;
    },
    [],
  );

  const removeFromCompare = useCallback((breedId: string) => {
    const next = compareRef.current.filter(id => id !== breedId);
    compareRef.current = next;
    setCompareIdsState(next);
  }, []);

  const clearCompare = useCallback(() => { compareRef.current = []; setCompareIdsState([]); }, []);

  return (
    <MuseumContext.Provider
      value={{
        selectedCategory,
        setSelectedCategory,
        searchValue,
        setSearchValue,
        selectedBreedId,
        setSelectedBreedId,
        selectedProvince,
        setSelectedProvince,
        compareIds,
        setCompareIds,
        toggleCompare,
        isInCompare,
        removeFromCompare,
        clearCompare,
        pulseId,
        triggerPulse,
      }}
    >
      {children}
    </MuseumContext.Provider>
  );
};

export const useMuseum = () => {
  const ctx = useContext(MuseumContext);
  if (!ctx) throw new Error('useMuseum must be used within MuseumProvider');
  return ctx;
};
