import React, { createContext, useContext, useState, useCallback } from 'react';
import { breeds } from '@/data/breeds';

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
  const [compareIds, setCompareIds] = useState<string[]>([]);
  const [pulseId, setPulseId] = useState<string | null>(null);

  const setSelectedCategory = useCallback((category: string | null) => {
    setSelectedCategoryState(category);
    setSearchValue('');
  }, []);

  // 触发地图点位脉冲光晕，5秒后自动消失（高亮放大状态由选中品种保持）
  const triggerPulse = useCallback((breedId: string) => {
    setPulseId(breedId);
    window.setTimeout(() => setPulseId((cur) => (cur === breedId ? null : cur)), 5000);
  }, []);

  const isInCompare = useCallback((breedId: string) => compareIds.includes(breedId), [compareIds]);

  const toggleCompare = useCallback(
    (breedId: string) => {
      let added = false;
      setCompareIds((prev) => {
        if (prev.includes(breedId)) {
          return prev.filter((id) => id !== breedId);
        }
        if (prev.length >= 4) return prev; // 最多4个
        added = true;
        return [...prev, breedId];
      });
      return added;
    },
    [],
  );

  const removeFromCompare = useCallback((breedId: string) => {
    setCompareIds((prev) => prev.filter((id) => id !== breedId));
  }, []);

  const clearCompare = useCallback(() => setCompareIds([]), []);

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

/** 根据 ID 查找品种 */
export function getBreedById(id: string | null) {
  if (!id) return null;
  return breeds.find((b) => b.id === id) ?? null;
}