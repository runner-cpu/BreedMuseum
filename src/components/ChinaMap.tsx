import React, { useEffect, useMemo, useState } from 'react';
import { useSettings } from '@/contexts/AppSettings';
import type { Breed } from '@/data/breeds';
import { mapViewBox, provincePaths } from '@/data/chinaMap';
import { categoryColors, readableOn } from '@/lib/categoryIcons';
import { compareText } from '@/lib/compareText';
import { categoryLabel, fill as interpolate, provinceLabel } from '@/lib/displayLabels';
import {
  buildSiteClusters,
  clustersForLens,
  type LensId,
  type SiteCluster,
} from '@/lib/geo/clusterSites';
import { buildProvinceChoropleth, CHOROPLETH_DARK_COLORS } from '@/lib/geo/provinceChoropleth';
import { beamColorFor } from '@/lib/stagePalette';

/**
 * 点位颜色直接复用全站类别色板（百科标签、看板环图、互动厅同一套），
 * 再按当前主题做可读化处理。旧实现另建了 7 色调色板并把
 * 兔/鹿/驴/骆驼/蜂全部并入「马」或「其他」，同一个类别在不同页面颜色不一致，
 * 图例也读不出真实类别。
 *
 * 深浅两套主题都会经过 `beamColorFor`：浅色底压暗、深色底提亮，
 * 保证点位在任意一档省块上都读得出来。查色时未知类别回落到「其他」。
 */
const markerColorForCategory = (category: string, isDark: boolean): string =>
  beamColorFor(categoryColors[category] ?? categoryColors.其他, isDark);

/**
 * 选中/悬停信号色：浅色舞台用朱砂，深色舞台用暖珊瑚。
 *
 * 旧实现用金色做选中色，而金色同时也是省份分档里最亮的一档，
 * 选中点常常与背景融为一体。改用 signal 令牌后，两套主题都能从任何省块上跳出来。
 */
const selectedSignal = (isDark: boolean): string => (isDark ? '#f0a184' : '#a4472f');

/** 点位统一描边：让点在任意一档省块上都有清晰边界，而不是靠放大来存在感。 */
const markerStroke = (isDark: boolean): string => (isDark ? '#0f1512' : '#fffdf8');

/**
 * 图例必须列全 15 个类别。
 *
 * 旧实现只画 牛/猪/羊/鸡/鸭/马/其他 七个，再用一行小字说“其余沿用同一色板”，
 * 观众无法核对某个点位的真实颜色属于哪一类——图例没有履行图例的职责。
 * 类别色板本身是全站共用的 15 色，直接铺开即可。
 */
const LEGEND_CATEGORIES = Object.keys(categoryColors);

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
  /** Coordinate aggregation is explained elsewhere when the detail matters. */
  showCoordinateNote?: boolean;
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
  showCoordinateNote = true,
  className,
}) => {
  const { t, isDark, language } = useSettings();
  const mapIsDark = isDark || darkSurface;
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);
  const svgRef = React.useRef<SVGSVGElement | null>(null);
  // viewBox 内的坐标要换算成容器像素，preserveAspectRatio="xMidYMid meet"
  // 会在容器比例与地图比例不一致时留下左右/上下留白；直接拿百分比定位，
  // tooltip 会整体偏移（宽屏上偏右，竖屏上偏下）。
  const [mapBox, setMapBox] = useState<{ offsetX: number; offsetY: number; width: number; height: number; scale: number } | null>(null);
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || typeof ResizeObserver === 'undefined') return undefined;
    const measure = () => {
      const rect = svg.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      const scale = Math.min(rect.width / mapViewBox.width, rect.height / mapViewBox.height);
      setMapBox({
        offsetX: (rect.width - mapViewBox.width * scale) / 2,
        offsetY: (rect.height - mapViewBox.height * scale) / 2,
        width: rect.width,
        height: rect.height,
        scale,
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [revealedProvinces, setRevealedProvinces] = useState<Set<string>>(() => new Set());

  const allClusters = useMemo(() => buildSiteClusters(breeds), [breeds]);
  /**
   * 类别是独立于镜头的筛选轴：无论当前是「全部落点」「国家级保护」还是
   * 「濒危之窗」，`lensCategory` 都要参与筛选。旧写法只在 `lens === 'category'`
   * 时传类别，探索页把 lens 收窄成 protect/risk 后，类别就被地图静默忽略了
   * ——标题统计是「牛 + 保护」，画布却画出所有保护点位。
   */
  const clusters = useMemo(
    () => clustersForLens(allClusters, lens, lensCategory),
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
      .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
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
        ref={svgRef}
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
            <ellipse cx={mapViewBox.width * 0.52} cy={mapViewBox.height * 0.48} rx="280" ry="190" fill="var(--stage-accent)" opacity="0.06" filter="url(#mapGlow)" />
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
            ? mapIsDark
              ? CHOROPLETH_DARK_COLORS[choropleth.binFor(count)]
              : choropleth.colorFor(count)
            : mapIsDark ? 'var(--museum-panel-raised)' : 'hsl(var(--muted))';
          /**
           * 没有可见记录的省份是纯地理底图，不注册为按钮。
           *
           * 旧实现给每个省都挂 role="button" + tabIndex：键盘要 Tab 过 34 个
           * 省份才能到产区点位，而其中十几次回车只会得到一片空地图。
           * 现在只有「当前镜头下确实有落点」的省份可聚焦、可点击，
           * 其余省份保留轮廓与 title 说明，不再进入焦点顺序。
           */
          const provinceAria = `${provinceLabel(name, language)} · ${count} ${t('map.breedUnit')}`;
          return (
            <g key={fullName} data-province={name}>
              <path
                d={path}
                role={hasData ? 'button' : undefined}
                tabIndex={hasData ? 0 : undefined}
                aria-label={hasData ? interpolate(t('map.provinceAria'), { name: provinceLabel(name, language) }) : undefined}
                aria-pressed={hasData ? isSelected : undefined}
                fill={fill}
                stroke={isHovered || isSelected ? selectedSignal(mapIsDark) : darkSurface ? 'var(--museum-line)' : 'hsl(var(--border))'}
                strokeWidth={isHovered || isSelected ? 2.2 : darkSurface ? 1.1 : 1}
                className={hasData ? 'cursor-pointer transition-[opacity,stroke,filter] duration-200' : 'transition-[opacity,stroke,filter] duration-200'}
                opacity={(hasData && !isRevealed ? 0.34 : hasData ? 1 : 0.52) * (isDimmed ? 0.35 : 1)}
                style={{ filter: isHovered ? 'brightness(1.28)' : undefined }}
                onMouseEnter={() => {
                  setHoveredProvince(fullName);
                  setTooltip({
                    x: label.x,
                    y: label.y,
                    title: provinceAria,
                    detail: hasData ? t('map.tooltipFocus') : t('map.tooltipNoData'),
                  });
                  onProvinceHover?.(name);
                }}
                onMouseLeave={() => {
                  setHoveredProvince(null);
                  setTooltip(null);
                  onProvinceHover?.(null);
                }}
                onFocus={() => {
                  setHoveredProvince(fullName);
                  setTooltip({ x: label.x, y: label.y, title: provinceAria, detail: t('map.tooltipFocus') });
                  onProvinceHover?.(name);
                }}
                onBlur={() => {
                  setHoveredProvince(null);
                  setTooltip(null);
                  onProvinceHover?.(null);
                }}
                onClick={(event) => {
                  if (!hasData) return;
                  event.stopPropagation();
                  setTooltip(null);
                  onProvinceClick(name);
                }}
                onKeyDown={(event) => {
                  if (!hasData) return;
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    event.stopPropagation();
                    setTooltip(null);
                    onProvinceClick(name);
                  }
                }}
              >
                <title>{provinceAria}</title>
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
                {provinceLabel(name, language)}
              </text>
              )}
            </g>
          );
        })}

        {clusters.map((cluster) => {
          const x = cluster.position[0] * 100 + mapViewBox.width / 2;
          const y = mapViewBox.height / 2 - cluster.position[1] * 100;
          const isSelected = selectedCluster?.id === cluster.id;
          /**
           * 点位尺寸按簇内记录数分三档，而不是全部 5.2。
           *
           * 旧实现为了「视觉秩序」把所有点画成同一大小，结果 154 个点在地图上
           * 看起来既稀疏又毫无轻重——观众无法判断哪里是主产区。现在：
           * - 单条记录的产区 4.2，2–4 条 5.2，5 条以上 6.4；
           * - 每点加一圈 1.2px 的纸张色描边，深色省块上也不会糊掉；
           * - 选中点 8.6 并换成 signal 色。
           * 半径只编码「记录数区间」，不编码连续数值，避免读者误读成精确比例。
           */
          const r = isSelected ? 8.6 : cluster.total >= 5 ? 6.4 : cluster.total >= 2 ? 5.2 : 4.2;
          const primaryCategory = cluster.slices[0]?.category ?? '其他';
          const color = isSelected ? selectedSignal(mapIsDark) : markerColorForCategory(primaryCategory, mapIsDark);
          const title = interpolate(t('map.clusterTitle'), { province: provinceLabel(cluster.province, language), count: cluster.total });
          const detail = cluster.slices.map((slice) => `${categoryLabel(slice.category, language)} ${slice.count}`).join(' / ');
          const activeProvince = focusedProvince ?? selectedProvince;
          const isFocusedOut = Boolean(activeProvince) && cluster.province !== activeProvince;
          const provinceIsRevealed = prefersReducedMotion || revealedProvinces.has(cluster.province) || revealOrder.length === 0;
          return (
            <g
              key={cluster.id}
              className="cursor-pointer transition-opacity duration-300"
              role="button"
              tabIndex={0}
              aria-label={interpolate(t('map.clusterAria'), { province: provinceLabel(cluster.province, language), count: cluster.total })}
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
              <circle cx={x} cy={y} r={r} fill={color} stroke={markerStroke(mapIsDark)} strokeWidth={1.3} />
              {cluster.total >= 5 && (
                <text
                  x={x}
                  y={y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  pointerEvents="none"
                  aria-hidden="true"
                  fontSize={5.6}
                  fontWeight={700}
                  fill={isSelected ? '#fffdf8' : readableOn(color)}
                >
                  {cluster.total}
                </text>
              )}
            </g>
          );
        })}
      </svg>

      <div
        className={`absolute bottom-3 left-3 z-10 max-w-[min(90%,340px)] rounded-lg border px-3 py-2 text-xs shadow-lg backdrop-blur ${darkSurface ? 'border-[var(--museum-line)] bg-[var(--museum-panel)] text-[var(--museum-fg)]' : 'border-border bg-card/90'}`}
        role="group"
        aria-label={t('map.legendProvinceTitle')}
      >
        <div className={`mb-1 flex items-center justify-between gap-3 text-[11px] font-medium ${darkSurface ? 'text-[var(--museum-fg)]' : 'text-foreground'}`}>
          <span>{t('map.legendProvinceCount')}</span>
          <span className={darkSurface ? 'text-[var(--museum-muted)]' : 'text-muted-foreground'}>{lens === 'all' ? t('map.legendAllRecords') : t('map.legendCurrentLens')}</span>
        </div>
        <div className="flex items-center gap-1.5" aria-label={t('map.legendProvinceScale')}>
          {choropleth.legend.map((item) => (
            <span key={item.bin} className="flex items-center gap-1" title={formatRange(item.from, item.to)}>
              <span className="h-3 w-5 rounded-sm border border-black/10" style={{ backgroundColor: mapIsDark ? CHOROPLETH_DARK_COLORS[item.bin] : item.color }} />
              <span className="sr-only">{formatRange(item.from, item.to)}</span>
            </span>
          ))}
        </div>
        <div className={`mt-1 flex items-center gap-2 text-[10px] ${darkSurface ? 'text-[var(--museum-muted)]' : 'text-muted-foreground'}`}>
          <span className="inline-block h-3 w-3 rounded-full" style={{ backgroundColor: selectedSignal(mapIsDark) }} aria-hidden="true" />
          <span>{t('map.legendSelectedGold')}</span>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[10px]" aria-label={t('map.legendCategories')}>
          {LEGEND_CATEGORIES.map((category) => <span key={category} className="inline-flex items-center gap-1" title={interpolate(t('map.legendCategoryPoint'), { category: categoryLabel(category, language) })}><span className="h-2 w-2 rounded-full" style={{ backgroundColor: markerColorForCategory(category, mapIsDark) }} aria-hidden="true" />{categoryLabel(category, language)}</span>)}
        </div>
      </div>

      {showCoordinateNote && <div className={`museum-map-coordinate-note absolute right-3 z-10 rounded-md border px-2.5 py-1.5 text-[11px] shadow-sm backdrop-blur ${darkSurface ? 'border-[var(--museum-line)] bg-[var(--museum-panel)] text-[var(--museum-muted)]' : 'border-border bg-card/90 text-muted-foreground'}`}>
        {t('map.coordNote')}
      </div>}

      {tooltip && mapBox && (
        <div
          className={`pointer-events-none absolute z-10 max-w-[240px] rounded-md border px-3 py-2 text-xs shadow-lg ${darkSurface ? 'border-[var(--museum-line)] bg-[var(--museum-panel)] text-[var(--museum-fg)]' : 'border-border bg-card'}`}
          style={{
            left: Math.min(
              Math.max(mapBox.offsetX + tooltip.x * mapBox.scale, 8),
              Math.max(8, mapBox.width - 8),
            ),
            top: Math.max(8, mapBox.offsetY + tooltip.y * mapBox.scale),
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
