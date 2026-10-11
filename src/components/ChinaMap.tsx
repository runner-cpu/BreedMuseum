import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/contexts/AppSettings';
import type { Breed } from '@/data/breeds';
import { mapViewBox, provincePaths } from '@/data/chinaMap';
import { categoryColors } from '@/lib/categoryIcons';
import {
  buildSiteClusters,
  clustersForLens,
  markerRadiusFor,
  type LensId,
  type SiteCluster,
} from '@/lib/geo/clusterSites';
import { CHOROPLETH_DARK_COLORS, buildProvinceChoropleth } from '@/lib/geo/provinceChoropleth';

export type { LensId };

export interface ChinaMapProps {
  breeds: Breed[];
  selectedProvince: string | null;
  selectedBreed: Breed | null;
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

const polar = (cx: number, cy: number, radius: number, degrees: number) => {
  const rad = ((degrees - 90) * Math.PI) / 180;
  return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)] as const;
};

const arcPath = (cx: number, cy: number, radius: number, from: number, sweep: number) => {
  const end = from + sweep;
  const [x0, y0] = polar(cx, cy, radius, from);
  const [x1, y1] = polar(cx, cy, radius, end);
  const large = sweep > 180 ? 1 : 0;
  return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
};

const formatRange = (from: number, to: number | null): string => {
  const lower = Math.max(0, Math.round(from));
  if (to === null) return `${lower}+`;
  const upper = Math.max(lower, Math.round(to));
  return lower === upper ? `${lower}` : `${lower}–${upper}`;
};

/**
 * Main 2D map. Province fills encode the active lens, rings encode production
 * site composition, and labels remain in the DOM for accessible navigation.
 */
export const ChinaMap: React.FC<ChinaMapProps> = ({
  breeds,
  selectedProvince,
  selectedBreed,
  pulseId,
  lens = 'all',
  lensCategory = null,
  focusedProvince,
  onProvinceClick,
  onBreedClick,
  onClusterClick,
  onClearSelection,
  onProvinceHover,
  className,
}) => {
  const { t, isDark } = useSettings();
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

  const arcsFor = (cluster: SiteCluster, radius: number) => {
    const total = cluster.slices.reduce((sum, slice) => sum + slice.count, 0) || 1;
    let cursor = 0;
    return cluster.slices.map((slice) => {
      const sweep = (slice.count / total) * 360;
      const from = cursor;
      cursor += sweep;
      return { ...slice, from, sweep, radius, color: categoryColors[slice.category] ?? '#95A5A6' };
    });
  };

  const mapClassName = ['relative flex h-full w-full items-center justify-center p-2', className]
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
        role="img"
        aria-label={t('map.title')}
        data-lens={lens}
        onClick={onClearSelection}
        style={{ filter: 'drop-shadow(0 2px 8px rgba(0,0,0,0.06))' }}
      >
        <title>{t('map.title')}</title>
        <defs>
          <pattern id="ricePaper" width="20" height="20" patternUnits="userSpaceOnUse">
            <rect width="20" height="20" fill="hsl(var(--card))" />
            <circle cx="2" cy="2" r="0.5" fill="hsl(var(--border))" opacity="0.3" />
            <circle cx="12" cy="12" r="0.5" fill="hsl(var(--border))" opacity="0.2" />
          </pattern>
        </defs>
        <rect x={0} y={0} width={mapViewBox.width} height={mapViewBox.height} fill="url(#ricePaper)" opacity={0.48} />

        {provinceEntries.map(({ fullName, name, path, label }) => {
          const count = choropleth.values[name] ?? 0;
          const hasData = count > 0;
          const activeProvince = focusedProvince ?? selectedProvince;
          const isSelected = activeProvince === name;
          const isHovered = hoveredProvince === fullName;
          const isDimmed = Boolean(activeProvince) && !isSelected;
          const isRevealed = prefersReducedMotion || !hasData || revealedProvinces.has(name);
          const fill = hasData
            ? isDark
              ? CHOROPLETH_DARK_COLORS[choropleth.binFor(count)]
              : choropleth.colorFor(count)
            : 'hsl(var(--muted))';
          return (
            <g key={fullName} data-province={name}>
              <path
                d={path}
                role="button"
                tabIndex={0}
                aria-label={t('map.provinceAria').replace('{name}', name)}
                aria-pressed={isSelected}
                fill={fill}
                stroke={isHovered || isSelected ? '#d4a853' : 'hsl(var(--border))'}
                strokeWidth={isHovered || isSelected ? 2.5 : 1}
                className="cursor-pointer transition-[opacity,stroke,filter] duration-200"
                opacity={(hasData && !isRevealed ? 0.34 : hasData ? 1 : 0.6) * (isDimmed ? 0.35 : 1)}
                style={{ filter: isHovered ? 'brightness(1.1)' : undefined }}
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
              <text
                x={label.x}
                y={label.y}
                textAnchor="middle"
                dominantBaseline="central"
                pointerEvents="none"
                aria-hidden="true"
                fontSize={label.width < 24 || label.height < 20 ? 7 : 9}
                fontWeight={isSelected || isHovered ? 700 : 500}
                fill="hsl(var(--foreground))"
                opacity={(isDimmed ? 0.35 : 0.82) * (isRevealed ? 1 : 0.55)}
                stroke="hsl(var(--card))"
                strokeWidth={1.7}
                paintOrder="stroke"
              >
                {name}
              </text>
            </g>
          );
        })}

        {clusters.map((cluster) => {
          const x = cluster.position[0] * 100 + mapViewBox.width / 2;
          const y = mapViewBox.height / 2 - cluster.position[1] * 100;
          const r = markerRadiusFor(cluster.baseTotal) * 100;
          const isSelected = selectedCluster?.id === cluster.id;
          const isPulsing = cluster.members.some((member) => member.id === pulseId);
          const color = categoryColors[cluster.slices[0]?.category] ?? 'hsl(var(--primary))';
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
              <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.22} stroke="hsl(var(--card))" strokeWidth={1.5} />
              {arcsFor(cluster, r * 0.72).map((arc) => (
                <path
                  key={arc.category}
                  d={arcPath(x, y, arc.radius, arc.from, arc.sweep)}
                  fill="none"
                  stroke={arc.color}
                  strokeWidth={Math.max(2.5, r * 0.34)}
                  strokeLinecap="butt"
                />
              ))}
              {cluster.total === 1 && <circle cx={x} cy={y} r={Math.max(1.6, r * 0.34)} fill={color} />}
              {cluster.hasNationalProtected && <circle cx={x} cy={y} r={r * 1.32} fill="none" stroke="#d4a853" strokeWidth={2} />}
              {cluster.hasEndangered && <circle cx={x} cy={y} r={r * 1.6} fill="none" stroke="hsl(var(--primary))" strokeWidth={1} strokeDasharray="3 3" opacity={0.7} />}
              {isPulsing && <circle cx={x} cy={y} r={r * 1.9} fill="none" stroke={color} strokeWidth={2.5} className="pulse-glow" />}
              {isSelected && <circle cx={x} cy={y} r={r * 2.2} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={2} />}
            </g>
          );
        })}
      </svg>

      <div
        className="absolute bottom-3 left-3 z-10 max-w-[min(90%,340px)] rounded-lg border border-border bg-card/90 px-3 py-2 text-xs shadow-lg backdrop-blur"
        role="group"
        aria-label="省份品种数量图例"
      >
        <div className="mb-1 flex items-center justify-between gap-3 text-[11px] font-medium text-foreground">
          <span>省份品种数</span>
          <span className="text-muted-foreground">{lens === 'all' ? '全部落点记录' : '当前镜头'}</span>
        </div>
        <div className="flex items-center gap-1.5" aria-label="省份品种数分级">
          {choropleth.legend.map((item) => (
            <span key={item.bin} className="flex items-center gap-1" title={formatRange(item.from, item.to)}>
              <span className="h-3 w-5 rounded-sm border border-black/10" style={{ backgroundColor: isDark ? CHOROPLETH_DARK_COLORS[item.bin] : item.color }} />
              <span className="sr-only">{formatRange(item.from, item.to)}</span>
            </span>
          ))}
        </div>
        <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground">
          <span className="inline-block h-3 w-3 rounded-full border-2 border-[#d4a853]" aria-hidden="true" />
          <span>{t('map.legendCluster')}</span>
        </div>
      </div>

      <div className="absolute right-3 top-3 z-10 rounded-md border border-border bg-card/90 px-2.5 py-1.5 text-[11px] text-muted-foreground shadow-sm backdrop-blur">
        {t('map.coordNote')}
      </div>

      {tooltip && (
        <div
          className="pointer-events-none absolute z-10 rounded-md border border-border bg-card px-3 py-2 text-xs shadow-lg"
          style={{
            left: `${(tooltip.x / mapViewBox.width) * 100}%`,
            top: `${(tooltip.y / mapViewBox.height) * 100}%`,
            transform: 'translate(-50%, -130%)',
          }}
        >
          <p className="font-semibold text-foreground">{tooltip.title}</p>
          <p className="max-w-[220px] text-muted-foreground">{tooltip.detail}</p>
        </div>
      )}
    </div>
  );
};
