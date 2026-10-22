import { ChevronLeft, ChevronRight, MapPin } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useRef, useState } from 'react';

export interface FeaturedRailItem {
  image?: string;
  alt?: string;
  icon?: ReactNode;
  text: string;
  sub?: string;
  meta?: string;
  color?: string;
}

interface FeaturedRailProps {
  items: FeaturedRailItem[];
  onSelect?: (index: number) => void;
  /** 无障碍区域名，例如“精选品种” */
  label: string;
  className?: string;
}

/**
 * 横向滑动品种栏（参考原站 `overflow-x-auto + snap-x` 的精选品种区）。
 *
 * 为什么不再用弧形画廊：环形排布在窄屏会把两侧卡片推到画布外，
 * 遮挡正文、拖拽与点击也会互相抢事件。这里换成原生滚动容器：
 * - 触屏直接横向滑动，桌面支持鼠标拖拽与左右箭头；
 * - `scroll-snap` 保证每张卡停稳，不会停在半张卡的位置；
 * - 拖动超过 8px 不触发点击，避免误进详情；
 * - 卡片本身是原生按钮，Tab + Enter 可用。
 */
const FeaturedRail = ({ items, onSelect, label, className = '' }: FeaturedRailProps) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const drag = useRef({ active: false, startX: 0, startScroll: 0, moved: 0 });
  const [canLeft, setCanLeft] = useState(false);
  const [canRight, setCanRight] = useState(false);

  const syncArrows = useCallback(() => {
    const el = trackRef.current;
    if (!el) return;
    setCanLeft(el.scrollLeft > 4);
    setCanRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }, []);

  useEffect(() => {
    const el = trackRef.current;
    if (!el) return undefined;
    syncArrows();
    el.addEventListener('scroll', syncArrows, { passive: true });
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(syncArrows);
    observer?.observe(el);
    return () => {
      el.removeEventListener('scroll', syncArrows);
      observer?.disconnect();
    };
  }, [syncArrows, items.length]);

  const slide = (direction: 1 | -1) => {
    const el = trackRef.current;
    if (!el) return;
    const card = el.querySelector<HTMLElement>('[data-featured-card]');
    const step = (card?.offsetWidth ?? 200) + 12;
    el.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  };

  return (
    <div className={`relative ${className}`} role="region" aria-label={label}>
      <div
        ref={trackRef}
        className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-1 pb-4 pt-1 [scrollbar-color:rgba(212,168,83,.55)_transparent] [scrollbar-width:thin]"
        onPointerDown={(event) => {
          if (event.pointerType !== 'mouse') return;
          const el = trackRef.current;
          if (!el) return;
          drag.current = { active: true, startX: event.clientX, startScroll: el.scrollLeft, moved: 0 };
          el.setPointerCapture(event.pointerId);
          el.style.cursor = 'grabbing';
          el.style.scrollSnapType = 'none';
        }}
        onPointerMove={(event) => {
          const el = trackRef.current;
          const state = drag.current;
          if (!el || !state.active) return;
          const dx = event.clientX - state.startX;
          state.moved = Math.max(state.moved, Math.abs(dx));
          el.scrollLeft = state.startScroll - dx;
        }}
        onPointerUp={() => {
          const el = trackRef.current;
          drag.current.active = false;
          if (el) {
            el.style.cursor = '';
            el.style.scrollSnapType = '';
          }
        }}
        onPointerCancel={() => {
          const el = trackRef.current;
          drag.current.active = false;
          if (el) {
            el.style.cursor = '';
            el.style.scrollSnapType = '';
          }
        }}
      >
        {items.map((item, index) => (
          <button
            key={`${item.text}-${index}`}
            type="button"
            data-featured-card
            onClick={() => {
              if (drag.current.moved < 8) onSelect?.(index);
            }}
            aria-label={item.sub ? `${item.text}，${item.sub}` : item.text}
            className="group relative w-[10.5rem] shrink-0 snap-start overflow-hidden rounded-xl border border-white/[0.12] bg-white/[0.04] text-left outline-none transition duration-300 hover:-translate-y-1 hover:border-[#D4A853]/70 focus-visible:ring-2 focus-visible:ring-[#D4A853] sm:w-[12rem]"
          >
            <span className="relative block aspect-[4/3] overflow-hidden bg-[#121C33]">
              {item.image ? (
                <img
                  src={item.image}
                  alt={item.alt ?? item.text}
                  loading="lazy"
                  decoding="async"
                  draggable={false}
                  className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
                />
              ) : (
                <span
                  aria-hidden="true"
                  className="flex h-full w-full items-center justify-center"
                  style={{ background: item.color ?? '#16233C', color: '#F2EEE3' }}
                >
                  {item.icon}
                </span>
              )}
              {item.meta && (
                <span className="absolute left-2 top-2 rounded-full border border-white/25 bg-[#0A0A1A]/60 px-2 py-0.5 font-mono text-[0.56rem] tracking-[0.12em] text-[#F0E3C8] backdrop-blur">
                  {item.meta}
                </span>
              )}
            </span>
            <span className="block px-3 py-2.5">
              <span className="block truncate font-serif text-sm font-semibold text-[#F7F2E6]">{item.text}</span>
              {item.sub && (
                <span className="mt-1 flex items-center gap-1 truncate text-[0.68rem] text-[#AEB8C8]">
                  <MapPin className="h-3 w-3 shrink-0 text-[#D4A853]" aria-hidden="true" />
                  {item.sub}
                </span>
              )}
            </span>
          </button>
        ))}
      </div>

      <div className="pointer-events-none absolute right-0 top-[-3.2rem] flex gap-2">
        <button
          type="button"
          aria-label="向左查看更多品种"
          disabled={!canLeft}
          onClick={() => slide(-1)}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.06] text-[#F2EEE3] transition enabled:hover:border-[#D4A853]/70 enabled:hover:text-[#E8C98A] disabled:opacity-30"
        >
          <ChevronLeft className="h-5 w-5" aria-hidden="true" />
        </button>
        <button
          type="button"
          aria-label="向右查看更多品种"
          disabled={!canRight}
          onClick={() => slide(1)}
          className="pointer-events-auto inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/[0.18] bg-white/[0.06] text-[#F2EEE3] transition enabled:hover:border-[#D4A853]/70 enabled:hover:text-[#E8C98A] disabled:opacity-30"
        >
          <ChevronRight className="h-5 w-5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
};

export default FeaturedRail;
