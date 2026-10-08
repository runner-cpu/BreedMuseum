import React, { useMemo, useState } from 'react';
import { useSettings } from '@/contexts/AppSettings';
import type { Breed } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { hasVerifiedCoordinates } from '@/data/catalog';
import { mapViewBox, projectCoordinate, provincePaths } from '@/data/chinaMap';
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
  const { t } = useSettings();
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const provinceHasData = useMemo(() => {
    const set = new Set(breeds.map((b) => b.province));
    return set;
  }, [breeds]);

  const breedPoints = useMemo(() => {
    // 产区未核验的记录停在 (0,0) 哨兵坐标，不是真实地理点，不渲染为可聚焦按钮
    const mappable = breeds.filter(hasVerifiedCoordinates);
    const groups = new Map<string, typeof mappable>();
    mappable.forEach((breed) => {
      const key = `${breed.longitude.toFixed(3)},${breed.latitude.toFixed(3)}`;
      const group = groups.get(key) ?? [];
      group.push(breed);
      groups.set(key, group);
    });
    return mappable.flatMap((breed) => {
      const key = `${breed.longitude.toFixed(3)},${breed.latitude.toFixed(3)}`;
      const group = groups.get(key) ?? [breed];
      const index = group.findIndex((item) => item.id === breed.id);
      const { x, y } = projectCoordinate(breed.longitude, breed.latitude);
      if (group.length === 1) return [{ breed, x, y }];
      const angle = (index / group.length) * Math.PI * 2 - Math.PI / 2;
      const radius = Math.min(18, 7 + group.length * 0.45);
      return [{ breed, x: x + Math.cos(angle) * radius, y: y + Math.sin(angle) * radius }];
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
          const simpleName = fullName.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '');
          const isSelected = selectedProvince === simpleName;
          const isHovered = hoveredProvince === fullName;
          const hasData = provinceHasData.has(simpleName);
          return (
            <path
              key={fullName}
              d={d}
              role="button"
              tabIndex={0}
              aria-label={t('map.provinceAria').replace('{name}', simpleName)}
              aria-pressed={isSelected}
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
              onFocus={() => setHoveredProvince(fullName)}
              onBlur={() => setHoveredProvince(null)}
              onClick={(event) => {
                // 阻止冒泡到 SVG 根的“点击空白清除选择”，否则省份选中会被立即清空
                event.stopPropagation();
                onProvinceClick(simpleName);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onProvinceClick(simpleName);
                }
              }}
            />
          );
        })}

        {breedPoints.map(({ breed, x, y }) => {
          const isSelected = selectedBreed?.id === breed.id;
          const isPulsing = pulseId === breed.id;
          const isProtected = getBreedMetadata(breed).protectionStatus === 'national-list';
          const color = categoryColors[breed.category] ?? 'hsl(var(--primary))';
          const dotColor = isProtected ? '#d4a853' : color;
          return (
            <g
              key={breed.id}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={t('map.pointAria').replace('{name}', breed.name)}
              aria-pressed={isSelected}
              onClick={(e) => {
                e.stopPropagation();
                onBreedClick(breed);
              }}
              onMouseEnter={() => setTooltip({ x, y, name: breed.name, category: breed.category })}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip({ x, y, name: breed.name, category: breed.category })}
              onBlur={() => setTooltip(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  onBreedClick(breed);
                }
              }}
            >
              {/* 国家级保护品种：常驻金色呼吸脉冲圈 */}
              {isProtected && (
                <circle
                  cx={x}
                  cy={y}
                  r={6}
                  fill="none"
                  stroke="#d4a853"
                  strokeWidth={1.5}
                  className="protected-pulse"
                />
              )}
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
                r={isSelected ? 7 : isProtected ? 6 : 5}
                fill={dotColor}
                stroke={isProtected ? '#fff5d6' : 'hsl(var(--card))'}
                strokeWidth={isProtected ? 2 : 2}
                className="transition-all duration-200"
              />
              {/* 国家级保护品种：小金星标识 */}
              {isProtected && (
                <path
                  d={`M ${x} ${y - 11} l 1.2 2.4 2.6.4 -1.9 1.8.5 2.6 -2.4 -1.3 -2.4 1.3.5 -2.6 -1.9 -1.8 2.6 -.4 z`}
                  fill="#d4a853"
                  stroke="#7a5a1a"
                  strokeWidth={0.4}
                />
              )}
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
                y={y - (isProtected ? -16 : 10)}
                textAnchor="middle"
                fontSize={isProtected ? 10 : 10}
                fill={isProtected ? '#d4a853' : 'hsl(var(--foreground))'}
                fontWeight={isProtected ? 700 : 600}
                className={`pointer-events-none transition-opacity duration-200 ${isSelected || isProtected ? 'opacity-100' : 'opacity-0'}`}
                style={isProtected ? { textShadow: '0 1px 3px rgba(0,0,0,0.8)' } : undefined}
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
            <span className="text-muted-foreground">{t('map.legendProvince')}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-primary border-2 border-card" />
            <span className="text-muted-foreground">{t('map.legendSelected')}</span>
          </div>
        </div>
      )}

      <div className="absolute top-3 right-3 z-10 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm">
        {t('map.coordNote')}
      </div>

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
