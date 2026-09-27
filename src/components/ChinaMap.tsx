import React, { useMemo, useState } from 'react';
import { mapViewBox, projectCoordinate, provincePaths } from '@/data/chinaMap';
import type { Breed } from '@/data/breeds';
import { categoryColors } from '@/lib/categoryIcons';

interface ChinaMapProps {
  breeds: Breed[];
  selectedProvince: string | null;
  selectedBreed: Breed | null;
  pulseId?: string | null;
  onProvinceClick: (province: string) => void;
  onBreedClick: (breed: Breed) => void;
  onClearSelection?: () => void;
}

interface TooltipInfo {
  x: number;
  y: number;
  name: string;
  category: string;
}

export const ChinaMap: React.FC<ChinaMapProps> = ({
  breeds,
  selectedProvince,
  selectedBreed,
  pulseId,
  onProvinceClick,
  onBreedClick,
  onClearSelection,
}) => {
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const provinceHasData = useMemo(() => {
    const set = new Set(breeds.map((b) => b.province));
    return set;
  }, [breeds]);

  const breedPoints = useMemo(() => {
    return breeds.map((breed) => {
      const { x, y } = projectCoordinate(breed.longitude, breed.latitude);
      return { breed, x, y };
    });
  }, [breeds]);

  return (
    <div className="relative w-full h-full flex items-center justify-center p-2">
      <svg
        viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
        className="w-full h-full max-h-[calc(100vh-14rem)]"
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
        onClick={onClearSelection}
      >
        <defs>
          <pattern id="ricePaper" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="hsl(var(--card))" />
            <circle cx="2" cy="2" r="0.5" fill="hsl(var(--border))" opacity="0.3" />
            <circle cx="12" cy="12" r="0.5" fill="hsl(var(--border))" opacity="0.2" />
          </pattern>
        </defs>
        {/* 透明背景层：点击空白区域清除当前高亮 */}
        <rect x={0} y={0} width={mapViewBox.width} height={mapViewBox.height} fill="transparent" />

        {Object.entries(provincePaths).map(([fullName, d]) => {
          const simpleName = fullName.replace(/省|市|自治区|特别行政区/g, '');
          const isSelected = selectedProvince === simpleName;
          const isHovered = hoveredProvince === fullName;
          const hasData = provinceHasData.has(simpleName);
          return (
            <path
              key={fullName}
              d={d}
              fill={
                isSelected
                  ? 'hsl(var(--primary))'
                  : isHovered
                    ? 'hsl(var(--accent))'
                    : hasData
                      ? 'url(#ricePaper)'
                      : 'hsl(var(--muted))'
              }
              stroke="hsl(var(--border))"
              strokeWidth={isSelected ? 2 : 1}
              className="cursor-pointer transition-all duration-200"
              opacity={hasData ? 1 : 0.6}
              onMouseEnter={() => setHoveredProvince(fullName)}
              onMouseLeave={() => setHoveredProvince(null)}
              onClick={() => onProvinceClick(simpleName)}
            />
          );
        })}

        {breedPoints.map(({ breed, x, y }) => {
          const isSelected = selectedBreed?.id === breed.id;
          const isPulsing = pulseId === breed.id;
          const color = categoryColors[breed.category] ?? 'hsl(var(--primary))';
          return (
            <g
              key={breed.id}
              className="cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                onBreedClick(breed);
              }}
              onMouseEnter={() => setTooltip({ x, y, name: breed.name, category: breed.category })}
              onMouseLeave={() => setTooltip(null)}
            >
              {/* 跳转定位脉冲光晕 */}
              {isPulsing && (
                <circle
                  cx={x}
                  cy={y}
                  r={8}
                  fill="none"
                  stroke={color}
                  strokeWidth={3}
                  className="pulse-glow"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isSelected ? 7 : 5}
                fill={color}
                stroke="hsl(var(--card))"
                strokeWidth={2}
                className="transition-all duration-200"
              />
              {isSelected && (
                <circle
                  cx={x}
                  cy={y}
                  r={12}
                  fill="none"
                  stroke={color}
                  strokeOpacity={0.4}
                  className="animate-pulse"
                />
              )}
              <text
                x={x}
                y={y - 10}
                textAnchor="middle"
                fontSize={10}
                fill="hsl(var(--foreground))"
                fontWeight={600}
                className={`pointer-events-none transition-opacity duration-200 ${isSelected ? 'opacity-100' : 'opacity-0'}`}
              >
                {breed.name}
              </text>
            </g>
          );
        })}
      </svg>

      {/* 图例说明 */}
      {(selectedBreed || selectedProvince) && (
        <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
          <div className="flex items-center gap-2">
            <span className="w-4 h-3 rounded-sm bg-primary border border-border" />
            <span className="text-muted-foreground">当前品种所在省份</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary border-2 border-card" />
            <span className="text-muted-foreground">当前查看品种</span>
          </div>
        </div>
      )}

      {/* 悬停信息卡片 */}
      {tooltip && (
        <div
          className="absolute pointer-events-none z-10 bg-card border border-border rounded-md shadow-lg px-3 py-2 text-xs"
          style={{
            left: `${(tooltip.x / mapViewBox.width) * 100}%`,
            top: `${(tooltip.y / mapViewBox.height) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <p className="font-semibold text-foreground">{tooltip.name}</p>
          <p className="text-muted-foreground">{tooltip.category}类</p>
        </div>
      )}
    </div>
  );
};
