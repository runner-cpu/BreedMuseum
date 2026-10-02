import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface CircularGalleryItem {
  icon?: ReactNode;
  text: string;
  sub?: string;
  color?: string;
}

interface CircularGalleryProps {
  items: CircularGalleryItem[];
  /** 自动旋转速度（度/秒） */
  autoSpeed?: number;
  /** 卡片宽度 */
  itemWidth?: number;
  /** 卡片高度 */
  itemHeight?: number;
  onSelect?: (index: number) => void;
  className?: string;
}

/**
 * 3D 环形画廊（纯 CSS 3D 实现，无需 WebGL 依赖）。
 * 卡片围绕中心环形排布，支持自动旋转与鼠标/触摸拖拽。
 */
const CircularGallery = ({
  items,
  autoSpeed = 10,
  itemWidth = 150,
  itemHeight = 170,
  onSelect,
  className = '',
}: CircularGalleryProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rotationRef = useRef(0);
  const dragState = useRef({ dragging: false, lastX: 0, velocity: 0, moved: 0 });
  const [radius, setRadius] = useState(330);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
      : false,
  );

  const count = items.length;
  const step = 360 / Math.max(count, 1);
  const staticLayout = reducedMotion;

  // 响应式半径
  useEffect(() => {
    const update = () => setRadius(window.innerWidth < 768 ? 215 : 330);
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  // 渲染循环：自动旋转 + 拖拽惯性 + 卡片深度样式
  useEffect(() => {
    if (reducedMotion) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const drag = dragState.current;
      if (!drag.dragging) {
        // 惯性衰减 + 自动旋转
        drag.velocity *= 0.94;
        rotationRef.current += (autoSpeed + drag.velocity) * dt;
      }
      const rot = rotationRef.current;
      for (let i = 0; i < count; i++) {
        const el = cardRefs.current[i];
        if (!el) continue;
        const angle = i * step + rot;
        const rad = (angle * Math.PI) / 180;
        const depth = (Math.cos(rad) + 1) / 2; // 0=背面 1=正面
        el.style.transform = `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px)`;
        el.style.opacity = String(0.3 + 0.7 * depth);
        el.style.zIndex = String(Math.round(depth * 100));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, step, radius, autoSpeed, reducedMotion]);

  // 拖拽交互
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDown = (e: PointerEvent) => {
      dragState.current.dragging = true;
      dragState.current.lastX = e.clientX;
      dragState.current.moved = 0;
      dragState.current.velocity = 0;
      el.setPointerCapture(e.pointerId);
    };
    const onMove = (e: PointerEvent) => {
      const drag = dragState.current;
      if (!drag.dragging) return;
      const dx = e.clientX - drag.lastX;
      drag.lastX = e.clientX;
      drag.moved += Math.abs(dx);
      const delta = dx * 0.35;
      rotationRef.current += delta;
      drag.velocity = delta * 60;
    };
    const onUp = () => {
      dragState.current.dragging = false;
    };
    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    return () => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-[400px] md:h-[600px] overflow-hidden select-none ${staticLayout ? 'overflow-y-auto' : 'touch-pan-y cursor-grab active:cursor-grabbing'} ${className}`}
      style={staticLayout ? undefined : { perspective: '1200px' }}
      data-reduced-motion={staticLayout ? 'true' : 'false'}
    >
      <div
        className={staticLayout ? 'grid grid-cols-1 gap-3 p-4 sm:grid-cols-2' : 'absolute inset-0'}
        style={staticLayout ? undefined : { transformStyle: 'preserve-3d' }}
      >
        {items.map((item, i) => (
          <button
            key={i}
            ref={(el) => {
              cardRefs.current[i] = el;
            }}
            type="button"
            onClick={() => {
              // 拖拽后不触发点击
              if (dragState.current.moved < 8) onSelect?.(i);
            }}
            className="absolute left-1/2 top-1/2 flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-sm text-white transition-colors hover:border-white/40 hover:bg-white/10"
            style={{
              ...(staticLayout
                ? { position: 'relative', left: 'auto', top: 'auto', width: '100%', height: itemHeight, transform: 'none' }
                : { width: itemWidth, height: itemHeight, transform: 'translate(-50%, -50%)', backfaceVisibility: 'visible' }),
            }}
          >
            {item.icon}
            <span className="text-sm font-medium">{item.text}</span>
            {item.sub && <span className="text-[10px] text-white/50">{item.sub}</span>}
          </button>
        ))}
      </div>
      {/* 底部渐变遮罩，增强纵深 */}
      {!staticLayout && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-[#0a0a1a] to-transparent" />}
    </div>
  );
};

export default CircularGallery;
