import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface CircularGalleryItem {
  /** 卡片主图；没有图片时退回图标 + 纯文字卡 */
  image?: string;
  /** 图片替代文本 */
  alt?: string;
  icon?: ReactNode;
  text: string;
  sub?: string;
  meta?: string;
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

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 弧形画廊。
 *
 * 卡片沿一个虚拟圆弧排布：`rotateY` 负责朝向，`translateZ` 负责纵深，
 * 再按余弦深度压暗背面卡片。指针/触摸横向拖动可带动整个环，松手后保留惯性，
 * 没有交互时以 `autoSpeed` 缓慢自转。
 *
 * - `prefers-reduced-motion` 下不建立 rAF，直接按可滚动的两列网格展示全部卡片；
 * - 拖动距离超过 8px 时不触发点击，避免「拖完误进详情」；
 * - 卡片本身是原生按钮，键盘 Tab + Enter 可用。
 */
const CircularGallery = ({
  items,
  autoSpeed = 9,
  itemWidth = 208,
  itemHeight = 272,
  onSelect,
  className = '',
}: CircularGalleryProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const rotationRef = useRef(0);
  const dragState = useRef({ dragging: false, lastX: 0, velocity: 0, moved: 0 });
  const [radius, setRadius] = useState(340);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);

  const count = items.length;
  const step = 360 / Math.max(count, 1);
  const staticLayout = reducedMotion;

  // 响应式半径：窄屏收小，避免卡片被推到画布外。
  useEffect(() => {
    const update = () => {
      const width = window.innerWidth;
      setRadius(width < 640 ? 250 : width < 1024 ? 320 : 380);
    };
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

  // 渲染循环：自动旋转 + 拖拽惯性 + 按深度调整不透明度/层级
  useEffect(() => {
    if (reducedMotion || count === 0) return undefined;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      const drag = dragState.current;
      if (!drag.dragging) {
        drag.velocity *= 0.94;
        rotationRef.current += (autoSpeed + drag.velocity) * dt;
      }
      const rotation = rotationRef.current;
      for (let index = 0; index < count; index++) {
        const el = cardRefs.current[index];
        if (!el) continue;
        const angle = index * step + rotation;
        const radians = (angle * Math.PI) / 180;
        const depth = (Math.cos(radians) + 1) / 2; // 0 = 背面，1 = 正面
        el.style.transform = `translate(-50%, -50%) rotateY(${angle}deg) translateZ(${radius}px)`;
        el.style.opacity = String(0.28 + 0.72 * depth);
        el.style.zIndex = String(Math.round(depth * 100));
        el.style.filter = `saturate(${(0.55 + 0.45 * depth).toFixed(2)}) brightness(${(0.72 + 0.28 * depth).toFixed(2)})`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [count, step, radius, autoSpeed, reducedMotion]);

  // 横向拖拽：指针捕获 + 惯性；点击阈值避免拖动误触。
  useEffect(() => {
    const el = containerRef.current;
    if (!el || reducedMotion) return undefined;
    const onDown = (event: PointerEvent) => {
      dragState.current.dragging = true;
      dragState.current.lastX = event.clientX;
      dragState.current.moved = 0;
      dragState.current.velocity = 0;
      el.setPointerCapture(event.pointerId);
    };
    const onMove = (event: PointerEvent) => {
      const drag = dragState.current;
      if (!drag.dragging) return;
      const dx = event.clientX - drag.lastX;
      drag.lastX = event.clientX;
      drag.moved += Math.abs(dx);
      const delta = dx * 0.32;
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
  }, [reducedMotion]);

  return (
    <div
      ref={containerRef}
      className={`relative w-full select-none overflow-hidden ${
        staticLayout ? '' : 'cursor-grab touch-pan-y active:cursor-grabbing'
      } ${className}`}
      style={staticLayout ? undefined : { height: itemHeight + 84, perspective: '1400px' }}
      data-reduced-motion={staticLayout ? 'true' : 'false'}
    >
      <div
        className={staticLayout ? 'grid grid-cols-2 gap-3 sm:grid-cols-3' : 'absolute inset-0'}
        style={staticLayout ? undefined : { transformStyle: 'preserve-3d' }}
      >
        {items.map((item, index) => (
          <button
            key={`${item.text}-${index}`}
            ref={(el) => {
              cardRefs.current[index] = el;
            }}
            type="button"
            onClick={() => {
              if (dragState.current.moved < 8) onSelect?.(index);
            }}
            aria-label={item.sub ? `${item.text}，${item.sub}` : item.text}
            className={`group relative block overflow-hidden rounded-2xl border border-white/12 bg-[#102019] text-left outline-none transition-colors hover:border-[#d8b26a]/70 focus-visible:ring-2 focus-visible:ring-[#d8b26a] ${
              staticLayout ? 'w-full' : 'absolute left-1/2 top-1/2'
            }`}
            style={{
              ...(staticLayout
                ? { aspectRatio: '4 / 5' }
                : {
                    width: itemWidth,
                    height: itemHeight,
                    transform: 'translate(-50%, -50%)',
                    backfaceVisibility: 'hidden',
                  }),
            }}
          >
            {item.image ? (
              <img
                src={item.image}
                alt={item.alt ?? item.text}
                loading="lazy"
                decoding="async"
                draggable={false}
                className="absolute inset-0 h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.06]"
              />
            ) : (
              <span
                aria-hidden="true"
                className="absolute inset-0 flex items-center justify-center"
                style={{ background: item.color ?? '#173B2C', color: '#EDF2EC' }}
              >
                {item.icon}
              </span>
            )}
            <span
              aria-hidden="true"
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(180deg, rgba(6,14,11,.06) 0%, rgba(6,14,11,.12) 46%, rgba(6,14,11,.86) 100%)',
              }}
            />
            {item.meta && (
              <span className="absolute left-3 top-3 rounded-full border border-white/25 bg-black/35 px-2 py-0.5 font-mono text-[0.58rem] tracking-[0.14em] text-[#F0E3C8] backdrop-blur">
                {item.meta}
              </span>
            )}
            <span className="absolute inset-x-0 bottom-0 block p-3">
              <span className="block font-serif text-lg font-semibold leading-tight text-[#FBF7EC]">{item.text}</span>
              {item.sub && <span className="mt-1 block text-xs text-[#D9E4DB]/80">{item.sub}</span>}
            </span>
          </button>
        ))}
      </div>

      {/* 底部渐隐：让环形前缘自然融入夜空，而不是被容器硬切 */}
      {!staticLayout && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-20"
          style={{ background: 'linear-gradient(to top, rgba(5,10,8,.92), transparent)' }}
        />
      )}
    </div>
  );
};

export default CircularGallery;
