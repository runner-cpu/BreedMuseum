import React, { useMemo, useState } from 'react';
import { useSettings } from '@/contexts/AppSettings';
import type { Breed } from '@/data/breeds';
import { mapViewBox, provincePaths } from '@/data/chinaMap';
import { categoryColors } from '@/lib/categoryIcons';
import { buildSiteClusters, markerRadiusFor, type SiteCluster } from '@/lib/geo3d/clusterSites';

interface ChinaMapProps {
  breeds: Breed[];
  selectedProvince: string | null;
  selectedBreed: Breed | null;
  pulseId?: string | null;
  onProvinceClick: (province: string) => void;
  onBreedClick: (breed: Breed) => void;
  onClusterClick?: (cluster: SiteCluster) => void;
  onClearSelection?: () => void;
}

interface TooltipInfo {
  x: number;
  y: number;
  title: string;
  detail: string;
}

/**
 * 2D 省域图（无 WebGL 与「切换平面图」时使用）。
 *
 * 落点与 3D 完全同源：都用 `buildSiteClusters` 的产区簇。上一版把同坐标的记录按固定
 * 角度铺成圆环，1,062 条里有 655 条落在 102 个圆环上，页面上就是「密密麻麻围成圈的点」；
 * 现在一个产区只画一个标记，半径随该产区品种数增长，外圈弧线按类别分段着色。
 */
export const ChinaMap: React.FC<ChinaMapProps> = ({
  breeds,
  selectedProvince,
  selectedBreed,
  pulseId,
  onProvinceClick,
  onBreedClick,
  onClusterClick,
  onClearSelection,
}) => {
  const { t } = useSettings();
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [tooltip, setTooltip] = useState<TooltipInfo | null>(null);

  const provinceHasData = useMemo(() => {
    const set = new Set(breeds.map((b) => b.province));
    return set;
  }, [breeds]);

  /**
   * 产区簇与 3D 同源（`buildSiteClusters`），但只聚合**传进来的这批记录**，
   * 这样筛选后的列表、单元测试里的小样本都能得到对应结果。
   * 簇的平面坐标 × 100 + 半张图 = 画布像素，与 `projectCoordinate` 互逆。
   */
  const clusters = useMemo(
    () =>
      buildSiteClusters(breeds).map((cluster) => ({
        cluster,
        x: cluster.position[0] * 100 + mapViewBox.width / 2,
        y: mapViewBox.height / 2 - cluster.position[1] * 100,
        /** 世界单位 → 画布像素 */
        r: markerRadiusFor(cluster.total) * 100,
      })),
    [breeds],
  );

  const selectedCluster = useMemo(
    () => clusters.find((item) => item.cluster.members.some((member) => member.id === selectedBreed?.id)) ?? null,
    [clusters, selectedBreed],
  );

  /** 类别弧线：把圆按类别计数切成一段段弧，颜色与 3D 柱身、图例一致。 */
  const arcsFor = (cluster: SiteCluster, radius: number) => {
    const total = cluster.slices.reduce((sum, slice) => sum + slice.count, 0) || 1;
    let cursor = 0;
    return cluster.slices.map((slice) => {
      const sweep = (slice.count / total) * 360;
      const from = cursor;
      cursor += sweep;
      return { ...slice, from, sweep, color: categoryColors[slice.category] ?? '#95A5A6' };
    }).map((slice) => ({ ...slice, radius }));
  };

  const polar = (cx: number, cy: number, radius: number, degrees: number) => {
    const rad = ((degrees - 90) * Math.PI) / 180;
    return [cx + radius * Math.cos(rad), cy + radius * Math.sin(rad)] as const;
  };

  const arcPath = (cx: number, cy: number, radius: number, from: number, sweep: number) => {
    // 整圈用两段半圆拼，避免起终点重合导致 SVG 直接不画
    const end = from + sweep;
    const [x0, y0] = polar(cx, cy, radius, from);
    const [x1, y1] = polar(cx, cy, radius, end);
    const large = sweep > 180 ? 1 : 0;
    return `M ${x0} ${y0} A ${radius} ${radius} 0 ${large} 1 ${x1} ${y1}`;
  };

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

        {clusters.map(({ cluster, x, y, r }) => {
          const isSelected = selectedCluster?.cluster.id === cluster.id;
          const isPulsing = cluster.members.some((member) => member.id === pulseId);
          const color = categoryColors[cluster.slices[0].category] ?? 'hsl(var(--primary))';
          const title = `${cluster.province} 产区 · ${cluster.total} 个品种`;
          const detail = cluster.slices.map((slice) => `${slice.category} ${slice.count}`).join(' / ');
          return (
            <g
              key={cluster.id}
              className="cursor-pointer"
              role="button"
              tabIndex={0}
              aria-label={t('map.clusterAria').replace('{province}', cluster.province).replace('{count}', String(cluster.total))}
              aria-pressed={isSelected}
              onClick={(event) => {
                event.stopPropagation();
                if (onClusterClick) onClusterClick(cluster);
                else if (cluster.members.length === 1) {
                  const breed = breeds.find((item) => item.id === cluster.members[0].id);
                  if (breed) onBreedClick(breed);
                }
              }}
              onMouseEnter={() => setTooltip({ x, y, title, detail })}
              onMouseLeave={() => setTooltip(null)}
              onFocus={() => setTooltip({ x, y, title, detail })}
              onBlur={() => setTooltip(null)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                  event.preventDefault();
                  event.stopPropagation();
                  if (onClusterClick) onClusterClick(cluster);
                }
              }}
            >
              {/* 底座淡色圆：让柱身/弧线在纸底上有一块可读的底 */}
              <circle cx={x} cy={y} r={r} fill={color} fillOpacity={0.22} stroke="hsl(var(--card))" strokeWidth={1} />
              {/* 类别弧线：按类别计数切分，一段一色 */}
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
              {/* 单品种产区：核心一个实心点，避免空心看着像未加载 */}
              {cluster.total === 1 && <circle cx={x} cy={y} r={Math.max(1.6, r * 0.34)} fill={color} />}
              {/* 含国家级保护名录：外圈金环 */}
              {cluster.hasNationalProtected && (
                <circle cx={x} cy={y} r={r * 1.32} fill="none" stroke="#d4a853" strokeWidth={1.6} />
              )}
              {/* 含编辑口径濒危：外圈细虚线（非权威结论） */}
              {cluster.hasEndangered && (
                <circle
                  cx={x}
                  cy={y}
                  r={r * 1.6}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth={1}
                  strokeDasharray="3 3"
                  opacity={0.7}
                />
              )}
              {isPulsing && (
                <circle
                  cx={x}
                  cy={y}
                  r={r * 1.9}
                  fill="none"
                  stroke={color}
                  strokeWidth={2.5}
                  className="pulse-glow"
                  style={{ transformOrigin: `${x}px ${y}px` }}
                />
              )}
              {isSelected && (
                <circle cx={x} cy={y} r={r * 2.2} fill="none" stroke={color} strokeOpacity={0.45} strokeWidth={2} />
              )}
            </g>
          );
        })}
      </svg>

      {/* 图例说明 */}
      <div className="absolute bottom-3 left-3 z-10 bg-card/90 backdrop-blur border border-border rounded-lg shadow-lg px-3 py-2 text-xs space-y-1">
        <div className="flex items-center gap-2">
          <span className="w-4 h-3 rounded-sm bg-primary border border-border" />
          <span className="text-muted-foreground">{t('map.legendProvince')}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3.5 h-3.5 rounded-full border-2 border-[#d4a853]" />
          <span className="text-muted-foreground">{t('map.legendCluster')}</span>
        </div>
      </div>

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
          <p className="font-semibold text-foreground">{tooltip.title}</p>
          <p className="max-w-[220px] text-muted-foreground">{tooltip.detail}</p>
        </div>
      )}
    </div>
  );
};
