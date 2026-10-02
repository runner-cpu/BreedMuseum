import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { publicAsset } from '@/lib/publicAsset';

export const BREED_IMAGE_FALLBACK = publicAsset('brand/breed-placeholder.svg');
// 站内根路径（/brand/...、/images/...）统一走 publicAsset 以兼容 Pages 子路径部署；外链 URL 原样使用
const resolveSrc = (src?: string) => (src?.startsWith('/') ? publicAsset(src) : src || BREED_IMAGE_FALLBACK);

export interface BreedImageProps {
  src?: string;
  alt: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  sizes?: string;
}

export function BreedImage({
  src,
  alt,
  className,
  imgClassName,
  eager = false,
  sizes,
}: BreedImageProps) {
  const [currentSrc, setCurrentSrc] = useState(resolveSrc(src));

  useEffect(() => {
    setCurrentSrc(resolveSrc(src));
  }, [src]);

  const isFallback = currentSrc === BREED_IMAGE_FALLBACK;

  return (
    <div
      className={cn('overflow-hidden bg-muted', className)}
      data-fallback={isFallback ? 'true' : undefined}
    >
      <img
        src={currentSrc}
        alt={alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        sizes={sizes}
        data-fallback={isFallback ? 'true' : undefined}
        className={cn('h-full w-full object-cover', imgClassName)}
        onError={() => setCurrentSrc(BREED_IMAGE_FALLBACK)}
      />
    </div>
  );
}
