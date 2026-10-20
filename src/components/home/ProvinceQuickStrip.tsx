import { X, MapPin, ArrowUpRight } from 'lucide-react';
import type { Breed } from '@/data/breeds';
import type { ProvinceDigest } from '@/lib/geo/lightMapData';
import { compareText } from '@/lib/compareText';
import { cn } from '@/lib/utils';

interface ProvinceQuickStripProps {
  province: ProvinceDigest | null;
  breeds: readonly Breed[];
  onBreedClick: (breed: Breed) => void;
  onClose: () => void;
  className?: string;
}

/**
 * 地图下的省份速览条。
 *
 * 省份点击之后把“地图上一个颜色”翻译成一句可读的话，并只保留一排
 * 可以继续进入卷宗的品种 chip。它刻意不做成侧栏，移动端也不会打断地图。
 */
export function ProvinceQuickStrip({
  province,
  breeds,
  onBreedClick,
  onClose,
  className,
}: ProvinceQuickStripProps) {
  if (!province) return null;

  const topCategories = [...province.byCategory.entries()]
    .sort((a, b) => b[1] - a[1] || compareText(a[0], b[0]))
    .slice(0, 3)
    .map(([name]) => name);
  const categorySummary = topCategories.length > 0 ? topCategories.join('、') : '资料待整理';
  const provinceBreeds = breeds.filter((breed) => breed.province === province.province);

  return (
    <section
      aria-label={`${province.province}省份速览`}
      className={cn(
        'relative overflow-hidden rounded-2xl border border-stage-gold/35 bg-stage-panel px-4 py-3 shadow-sm sm:px-5',
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-stage-gold" aria-hidden="true" />
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 pl-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <MapPin className="h-4 w-4 shrink-0 text-stage-gold" aria-hidden="true" />
          <p className="min-w-0 text-sm leading-relaxed">
            <strong className="font-semibold">{province.province}</strong>
            <span className="text-stage-muted"> · {province.total} 个品种 · 以{categorySummary}为主 · 国家级保护 {province.nationalProtected} 个</span>
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex min-h-9 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs text-stage-muted transition-colors hover:bg-stage-soft hover:text-stage-fg"
          aria-label={`关闭${province.province}速览`}
        >
          收起
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-2 flex items-center gap-2 overflow-x-auto pl-2 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <span className="shrink-0 text-[11px] text-stage-muted">进入卷宗</span>
        {provinceBreeds.slice(0, 12).map((breed) => (
          <button
            key={breed.id}
            type="button"
            onClick={() => onBreedClick(breed)}
            className="group inline-flex min-h-8 shrink-0 items-center gap-1 rounded-full border border-stage-border bg-stage px-2.5 text-xs text-stage-fg/85 transition-colors hover:border-stage-gold/70 hover:bg-stage-gold/10 hover:text-stage-fg"
          >
            {breed.name}
            <ArrowUpRight className="h-3 w-3 text-stage-muted transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" aria-hidden="true" />
          </button>
        ))}
        {provinceBreeds.length > 12 && <span className="shrink-0 text-[11px] text-stage-muted">＋{provinceBreeds.length - 12}</span>}
      </div>
    </section>
  );
}

