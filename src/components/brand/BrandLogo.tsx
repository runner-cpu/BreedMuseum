import React from 'react';
import { cn } from '@/lib/utils';
import { publicAsset } from '@/lib/publicAsset';

export interface BrandLogoProps {
  compact?: boolean;
  className?: string;
}

const MUSEUM_NAME = '中国地方畜禽品种数字博物馆';

export function BrandLogo({ compact = false, className }: BrandLogoProps) {
  return (
    <img
      src={publicAsset(compact ? 'brand/museum-mark.svg' : 'brand/museum-wordmark.svg')}
      alt={MUSEUM_NAME}
      className={cn(compact ? 'h-9 w-9' : 'h-9 w-auto max-w-full', className)}
      width={compact ? 36 : 252}
      height={36}
      decoding="async"
    />
  );
}
