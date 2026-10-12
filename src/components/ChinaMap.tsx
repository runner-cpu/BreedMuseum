import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/contexts/AppSettings';
import type { Breed } from '@/data/breeds';
import { mapViewBox, provincePaths } from '@/data/chinaMap';
import {
  buildSiteClusters,
  clustersForLens,
  type LensId,
  type SiteCluster,
} from '@/lib/geo/clusterSites';
import { buildProvinceChoropleth, CHOROPLETH_DARK_COLORS } from '@/lib/geo/provinceChoropleth';

export type { LensId };

export interface ChinaMapProps {
  breeds: Breed[];
  selectedProvince: string | null;
  selectedBreed: Breed | null;
  /** Legacy pulse hook; retained for callers while marker styling stays static. */
  pulseId?: string | null;
  /** Active map lens; optional to preserve the original API. */
  lens?: LensId;
  /** Category selected while `lens === 'category'`. */
  lensCategory?: string | null;
  /** Parent focus is an alias of selectedProvince for the new home layout. */
  focusedProvince?: string | null;
  onProvinceClick: (province: string) => void;
  onBreedClick: (breed: Breed) => void;
  onClusterClick?: (cluster: SiteCluster) => void;
  onClearSelection?: () => void;
  onProvinceHover?: (province: string | null) => void;
  /** Render the map as a dark exhibition surface with clean point markers. */
  darkSurface?: boolean;
  /** Province names are useful for study mode but too noisy for the hero map. */
  showProvinceLabels?: boolean;
  className?: string;
}

interface TooltipInfo {
  x: number;
  y: number;
  title: string;
  detail: string;
}

const simpleProvinceName = (name: string): string =>
  name.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '');

const provinceLabelPoint = (path: string): { x: number; y: number; width: number; height: number } => {
  const numbers = path.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
  const xs: number[] = [];
  const ys: number[] = [];
  for (let index = 0; index + 1 < numbers.length; index += 2) {
    xs.push(numbers[index]);
    ys.push(numbers[index + 1]);
  }
  if (xs.length === 0) return { x: mapViewBox.width / 2, y: mapViewBox.height / 2, width: 0, height: 0 };
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: (minX + maxX) / 2, y: (minY + maxY) / 2, width: maxX - minX, height: maxY - minY };
};

const formatRange = (from: number, to: number | null): string => {
  const lower = Math.max(0, Math.round(from));
  if (to === null) return `${lower}+`;
  const upper = Math.max(lower, Math.round(to));
  return lower === upper ? `${lower}` : `${lower}–${upper}`;
};

/**
 * Main 2D map. Province fills encode the active lens and one compact dot marks
 * each production cluster. Labels remain in the DOM for accessible navigation.
 */
export const ChinaMap: React.FC<ChinaMapProps> = ({
  breeds,
  selectedProvince,
  selectedBreed,
  lens = 'all',
  lensCategory = null,
  focusedProvince,
  onProvinceClick,
  onBreedClick,
  onClusterClick,
  onClearSelection,
  onProvinceHover,
  darkSurface = false,
  showProvinceLabels = true,
  className,
}) => {
  const { t, isDark } = useSettings();
  const mapIsDark = isDark || darkSurface;
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [revealedProvinces, setRevealedProvinces] = useState<Set<string>>(() => new Set());

  const allClusters = useMemo(() => buildSiteClusters(breeds), [breeds]);
  const clusters = useMemo(
    () => clustersForLens(allClusters, lens, lens === 'category' ? lensCategory : null),
    [allClusters, lens, lensCategory],
  );

  const provinceEntries = useMemo(
    () => Object.entries(provincePaths).map(([fullName, path]) => ({
      fullName,
      name: simpleProvinceName(fullName),
      path,
      label: provinceLabelPoint(path),
    })),
    [],
  );

  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cluster of clusters) counts.set(cluster.province, (counts.get(cluster.province) ?? 0) + cluster.total);
    return counts;
  }, [clusters]);

  const choropleth = useMemo(() => buildProvinceChoropleth(provinceCounts), [provinceCounts]);
  const selectedCluster = useMemo(
    () => clusters.find((item) => item.members.some((member) => member.id === selectedBreed?.id)) ?? null,
    [clusters, selectedBreed],
  );
  const revealOrder = useMemo(
    () => [...provinceCounts.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .map(([province]) => province),
    [provinceCounts],
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setPrefersReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  useEffect(() => {
    if (prefersReducedMotion || revealOrder.length === 0) {
      setRevealedProvinces(new Set(revealOrder));
      return undefined;
    }
    setRevealedProvinces(new Set());
    let cursor = 0;
    // Keep the full reveal under 1.4s even when all 34 units have data.
    const intervalMs = Math.min(90, 1400 / Math.max(1, revealOrder.length));
    const timer = window.setInterval(() => {
      cursor += 1;
      setRevealedProvinces(new Set(revealOrder.slice(0, cursor)));
      if (cursor >= revealOrder.length) window.clearInterval(timer);
    }, intervalMs);
    return () => window.clearInterval(timer);
  }, [prefersReducedMotion, revealOrder]);

  const mapClassName = [
    'relative flex h-full w-full items-center justify-center p-2',
    darkSurface ? 'museum-map-surface' : '',
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={mapClassName}
      data-lens={lens}
      data-focused-province={focusedProvince ?? selectedProvince ?? ''}
      data-reduced-motion={prefersReducedMotion ? 'true' : 'false'}
    >
      <svg
        viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
        className="h-full w-full max-h-[calc(100vh-14rem)]"
        role="group"
        aria-label={t('map.title')}
        data-lens={lens}
        onClick={onClearSelection}
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
      >
        <title id="china-map-title">{t('map.title')}</title>
        <defs>
          <pattern id="ricePaper" width="20" height="20" patternUnits="userSpaceOnUse">
          <rect width="20" height="20" fill={darkSurface ? 'var(--museum-panel)' : 'hsl(var(--card))'} />
            <circle cx="2" cy="2" r="0.5" fill="hsl(var(--border))" opacity="0.3" />
            <circle cx="12" cy="12" r="0.5" fill="hsl(var(--border))" opacity="0.2" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={mapViewBox.width} height={mapViewBox.height} fill={darkSurface ? 'var(--museum-panel)' : 'url(#ricePaper)'} opacity={darkSurface ? 1 : 0.48} />
        {darkSurface && (
          <>
            <defs>
              <radialGradient id="mapHalo" cx="50%" cy="46%" r="65%">
                <stop offset="0%" stopColor="var(--museum-panel-raised)" stopOpacity="0.72" />
                <stop offset="65%" stopColor="var(--museum-panel)" stopOpacity="0.15" />
                <stop offset="100%" stopColor="var(--museum-bg)" stopOpacity="0.8" />
              </radialGradient>
              <filter id="mapGlow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="5" />
              </filter>
            </defs>
            <rect x={0} y={0} width={mapViewBox.width} height={mapViewBox.height} fill="url(#mapHalo)" />
            <ellipse cx={mapViewBox.width * 0.52} cy={mapViewBox.height * 0.48} rx="280" ry="190" fill="#d4a853" opacity="0.08" filter="url(#mapGlow)" />
          </>
        )}

        {provinceEntries.map(({ fullName, name, path, label }) => {
          const count = choropleth.values[name] ?? 0;
          const hasData = count > 0;
          const activeProvince = focusedProvince ?? selectedProvince;
          const isSelected = activeProvince === name;
          const isHovered = hoveredProvince === fullName;
          const isDimmed = Boolean(activeProvince) && !isSelected;
          const isRevealed = prefersReducedMotion || !hasData || revealedProvinces.has(name);
          const fill = hasData
            ? darkSurface
              ? 'var(--museum-panel-raised)'
              : mapIsDark
                ? CHOROPLETH_DARK_COLORS[choropleth.binFor(count)]
                : choropleth.colorFor(count)
            : darkSurface ? 'var(--museum-panel)' : 'hsl(var(--muted))';
          return (
            <g key={fullName} data-province={name}>
              <path
                d={path}
                role="button"
                tabIndex={0}
                aria-label={t('map.provinceAria').replace('{name}', name)}
                aria-pressed={isSelected}
                fill={fill}
                stroke={isHovered || isSelected ? '#d4a853' : darkSurface ? 'var(--museum-line)' : 'hsl(var(--border))'}
                strokeWidth={isHovered || isSelected ? 2.5 : darkSurface ? 1.2 : 1}
                className="cursor-pointer transition-[opacity,stroke,filter] duration-200"
                opacity={(hasData && !isRevealed ? 0.34 : hasData ? 1 : 0.6) * (isDimmed ? 0.35 : 1)}
                style={{ filter: isHovered ? 'brightness(1.28)' : undefined }}
                onMouseEnter={() => {
                  setHoveredProvince(fullName);
                  onProvinceHover?.(name);
                }}
                onMouseLeave={() => {
                  setHoveredProvince(null);
                  onProvinceHover?.(null);
                }}
                onFocus={() => {
                  setHoveredProvince(fullName);
                  onProvinceHover?.(name);
                }}
                onBlur={() => {
                  setHoveredProvince(null);
                  onProvinceHover?.(null);
                }}
                onClick={(event) => {
                  event.stopPropagation();
                  onProvinceClick(name);
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    onProvinceClick(name);
                  }
                }}
              >
                <title>{`${name} · ${count} ${t('map.breedUnit')}`}</title>
              </path>
              {showProvinceLabels && (
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                aria-hidden="true"
                fontSize={label.width < 24 || label.height < 20 ? 7 : 9}
                fontWeight={isSelected || isHovered ? 700 : 500}
                fill={darkSurface ? 'var(--museum-fg)' : 'hsl(var(--foreground))'}
                opacity={(isDimmed ? 0.35 : 0.82) * (isRevealed ? 1 : 0.55)}
                stroke={darkSurface ? 'var(--museum-panel)' : 'hsl(var(--card))'}
                strokeWidth={1.7}
                paintOrder="stroke"
              >
                {name}
              </text>
              )}
            </g>
          );
        })}

        {clusters.map((cluster) => {
          const x = cluster.position[0] * 100 + mapViewBox.width / 2;
          const y = mapViewBox.height / 2 - cluster.position[1] * 100;
          const isSelected = selectedCluster?.id === cluster.id;
          // Keep every point visually equal. Counts remain available in the
          // tooltip and detail card; radius is reserved for the active point.
          const r = isSelected ? 8 : 5.2;
          const color = isSelected ? '#d4a853' : '#8cc7b2';
          const title = `${cluster.province} 产区 · ${cluster.total} 个品种`;
          const detail = cluster.slices.map((slice) => `${slice.category} ${slice.count}`).join(' / ');
          const activeProvince = focusedProvince ?? selectedProvince;
          const isFocusedOut = Boolean(activeProvince) && cluster.province !== activeProvince;
          const provinceIsRevealed = prefersReducedMotion || revealedProvinces.has(cluster.province) || revealOrder.length === 0;
          return (
            <g
              key={cluster.id}
              className="cursor-pointer transition-opacity duration-300"
              role="button"
              tabIndex={0}
              aria-label={t('map.clusterAria').replace('{province}', cluster.province).replace('{count}', String(cluster.total))}
              aria-pressed={isSelected}
              opacity={(provinceIsRevealed ? 1 : 0.28) * (isFocusedOut ? 0.25 : 1)}
              onClick={(event) => {
                event.stopPropagation();
                if (onClusterClick) onClusterClick(cluster);
                else if (cluster.members.length === 1) {
                  const breed = breeds.find((item) => item.id === cluster.members[0].id);
                  if (breed) onBreedClick(breed);
                }
              }}
              onMouseEnter={() => {
                setTooltip({ x, y, title, detail });
                onProvinceHover?.(cluster.province);
              }}
              onMouseLeave={() => {
                setTooltip(null);
                onProvinceHover?.(null);
              }}
              onFocus={() => {
                setTooltip({ x, y, title, detail });
                onProvinceHover?.(cluster.province);
              }}
              onBlur={() => {
                setTooltip(null);
                onProvinceHover?.(null);
              }}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onClusterClick) onClusterClick(cluster);
                  else if (cluster.members.length === 1) {
                    const breed = breeds.find((item) => item.id === cluster.members[0].id);
                    if (breed) onBreedClick(breed);
                  }
                }
              }}
            >
              <circle cx={x} cy={y} r={r} fill={color} stroke={isSelected ? '#f8e7b4' : 'none'} strokeWidth={isSelected ? 1.5 : 0} />
            </g>
          );
        })}
      </svg>

      <div
        className={`absolute bottom-3 left-3 z-10 max-w-[min(90%,340px)] rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur ${darkSurface ? 'border-[var(--museum-line)] bg-[var(--museum-panel)] text-[var(--museum-fg)]' : 'border-border bg-card/90'}`}
        role="group"
        aria-label="省份品种数量图例"
      >
        <div className={`mb-1 flex items-center justify-between gap-3 text-[11px] font-medium ${darkSurface ? 'text-[var(--museum-fg)]' : 'text-foreground'}`}>
          <span>省份品种数</span>
          <span className={darkSurface ? 'text-[var(--museum-muted)]' : 'text-muted-foreground'}>{lens === 'all' ? '全部落点记录' : '当前镜头'}</span>
        </div>
        <div className="flex items-center gap-1.5" aria-label="省份品种数分级">
          {choropleth.legend.map((item) => (
            <span key={item.bin} className="flex items-center gap-1" title={formatRange(item.from, item.to)}>
              <span className="h-3 w-5 rounded-sm border border-black/10" style={{ backgroundColor: mapIsDark ? CHOROPLETH_DARK_COLORS[item.bin] : item.color }} />
              <span className="sr-only">{formatRange(item.from, item.to)}</span>
            </span>
          ))}
        </div>
        <div className={`mt-1 flex items-center gap-2 text-[10px] ${darkSurface ? 'text-[var(--museum-muted)]' : 'text-muted-foreground'}`}>
          <span className="inline-block h-3 w-3 rounded-full bg-[#8cc7b2]" aria-hidden="true" />
          <span>圆点 = 产区簇 · 金色 = 当前选择</span>
        </div>
      </div>

      <div className={`absolute right-3 top-3 z-10 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur ${darkSurface ? 'border-[var(--museum-line)] bg-[var(--museum-panel)] text-[var(--museum-muted)]' : 'border-border bg-card/90 text-muted-foreground'}`}>
        {t('map.coordNote')}
      </div>

      {tooltip && (
        <div
          className={`pointer-events-none absolute z-10 rounded-md border px-3 py-2 text-xs shadow-lg ${darkSurface ? 'border-[var(--museum-line)] bg-[var(--museum-panel)] text-[var(--museum-fg)]' : 'border-border bg-card'}`}
          style={{
            left: `${(tooltip.x / mapViewBox.width) * 100}%`,
            top: `${(tooltip.y / mapViewBox.height) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <p className={darkSurface ? 'font-semibold text-[var(--museum-fg)]' : 'font-semibold text-foreground'}>{tooltip.title}</p>
          <p className={darkSurface ? 'max-w-[220px] text-[var(--museum-muted)]' : 'max-w-[220px] text-muted-foreground'}>{tooltip.detail}</p>
        </div>
      )}
    </div>
  );
};
