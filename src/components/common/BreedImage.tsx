import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { publicAsset } from '@/lib/publicAsset';
import { CategorySilhouette } from '@/components/arcade/CategorySilhouette';
import { hasBreedImage } from '@/data/breedImage';
import { useSettings } from '@/contexts/AppSettings';
import { fill } from '@/lib/displayLabels';

export const BREED_IMAGE_FALLBACK = publicAsset('brand/breed-placeholder.svg');
export { hasBreedImage } from '@/data/breedImage';
// 站内根路径（/brand/...、/images/...）统一走 publicAsset 以兼容 Pages 子路径部署；外链 URL 原样使用
const resolveSrc = (src?: string) => (src?.startsWith('/') ? publicAsset(src) : src || BREED_IMAGE_FALLBACK);

/**
 * Visual cards must not present the illustrated fallback as if it were a
 * sourced photograph. Detail pages may still keep the record and explain that
 * its image is pending, so this helper is intentionally limited to card
 * selection.
 */
export interface BreedImageProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  sizes?: string;
  /** 缺失图片时用于生成有类别辨识度的馆藏示意插画。 */
  category?: string;
  breedName?: string;
  /** Empty state for detail views that must not present a placeholder as a photo. */
  fallbackMode?: 'illustration' | 'empty';
}

export function BreedImage({
  src,
  alt,
  className,
  imgClassName,
  eager = false,
  sizes,
  category = '其他',
  breedName,
  fallbackMode = 'illustration',
}: BreedImageProps) {
  const { t } = useSettings();
  const [currentSrc, setCurrentSrc] = useState(resolveSrc(src));

  useEffect(() => {
    setCurrentSrc(resolveSrc(src));
  }, [src]);

  const isFallback = currentSrc === BREED_IMAGE_FALLBACK;
  const label = breedName ?? alt.replace(/图片$/, '');

  return (
    <div
      className={cn('relative overflow-hidden bg-muted', className)}
      data-fallback={isFallback ? 'true' : undefined}
    >
      {isFallback && fallbackMode === 'empty' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center text-stage-muted">
          <span className="font-serif text-base text-stage-fg">{t('image.pendingTitle')}</span>
          <span className="text-[11px]">{t('image.pendingNote')}</span>
        </div>
      )}
      {isFallback && fallbackMode === 'illustration' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden bg-[radial-gradient(circle_at_50%_28%,rgb(216_177_92_/_0.26),transparent_42%),linear-gradient(145deg,var(--stage-soft),var(--stage-panel))] px-4 text-center text-stage-fg">
          <span className="absolute right-3 top-3 rounded border border-stage-gold/45 bg-stage-panel/70 px-1.5 py-0.5 font-mono text-[9px] tracking-[0.16em] text-stage-gold">{t('image.illustration')}</span>
          <CategorySilhouette category={category} label={fill(t('image.illustrationAlt'), { name: label })} className="h-24 w-24 text-stage-gold/80" />
          <span className="mt-2 max-w-full truncate font-serif text-sm">{label}</span>
          <span className="mt-1 text-[9px] uppercase tracking-[0.18em] text-stage-muted">{t('image.archive')}</span>
        </div>
      )}
      {!(isFallback && fallbackMode === 'empty') && <img
        src={currentSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes}
        data-fallback={isFallback ? 'true' : undefined}
        className={cn('h-full w-full object-cover', isFallback ? 'relative opacity-0' : '', imgClassName)}
        onError={() => setCurrentSrc(BREED_IMAGE_FALLBACK)}
      />}
    </div>
  );
}
