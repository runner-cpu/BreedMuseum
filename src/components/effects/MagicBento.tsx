import { motion } from 'motion/react';
import { type CSSProperties, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import './MagicBento.css';

export interface BentoCard {
  icon: ReactNode;
  title: string;
  description: string;
  label?: string;
  meta?: string;
  to?: string;
  /** 主入口卡片：宽屏占两列，并展示更大的标题 */
  feature?: boolean;
}

interface MagicBentoProps {
  cards: BentoCard[];
  /** 发光颜色，格式 "r, g, b" */
  glowColor?: string;
  spotlightRadius?: number;
  particleCount?: number;
  enableStars?: boolean;
  enableSpotlight?: boolean;
  enableBorderGlow?: boolean;
  enableTilt?: boolean;
  enableMagnetism?: boolean;
  clickEffect?: boolean;
  onNavigate?: (to: string) => void;
  className?: string;
  /** 深色舞台（首页）或跟随站内主题（看板） */
  tone?: 'dark' | 'stage';
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

interface Particle {
  left: string;
  top: string;
  size: number;
  delay: number;
  duration: number;
  opacity: number;
}

/**
 * 纯视觉的星尘布局。用确定性的哈希序列而不是 `Math.random()`：
 * 位置不需要密码学随机性，固定序列还能让同一张卡片在重渲染/截图时保持稳定。
 */
const starLayout = (cardIndex: number, count: number): Particle[] => {
  let seed = 2166136261 ^ (cardIndex + 1) * 2654435761;
  const next = () => {
    seed ^= seed << 13;
    seed ^= seed >>> 17;
    seed ^= seed << 5;
    return ((seed >>> 0) % 100000) / 100000;
  };
  return Array.from({ length: count }, () => ({
    left: `${(next() * 100).toFixed(2)}%`,
    top: `${(next() * 100).toFixed(2)}%`,
    size: Number((next() * 1.6 + 0.8).toFixed(2)),
    delay: Number((next() * 2.4).toFixed(2)),
    duration: Number((2.4 + next() * 1.8).toFixed(2)),
    opacity: Number((0.2 + next() * 0.55).toFixed(2)),
  }));
};

/**
 * 魔法便当盒功能卡片。
 *
 * 交互层次（逐层叠加，但都不拦截点击）：
 * 1. 卡片内星尘粒子缓慢明灭；
 * 2. 指针进入网格后有一层全局聚光，单卡再叠一圈跟随指针的边框辉光；
 * 3. 卡片随指针做最多 7° 的 3D 倾斜，并沿指针方向产生磁吸位移；
 * 4. 点击时从落点扩散一圈金色波纹，然后执行导航。
 *
 * 全部动画在 `prefers-reduced-motion` 下关闭；卡片本身始终是一个原生
 * `<button>`，键盘 Enter/Space 与触摸点击走同一条 `onNavigate` 路径。
 */
const MagicBento = ({
  cards,
  glowColor = '216, 178, 106',
  spotlightRadius = 420,
  particleCount = 14,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  enableTilt = true,
  enableMagnetism = true,
  clickEffect = true,
  onNavigate,
  className = '',
  tone = 'stage',
}: MagicBentoProps) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [spot, setSpot] = useState({ x: 0, y: 0, o: 0 });
  const [ripples, setRipples] = useState<Record<number, Ripple[]>>({});
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReducedMotion(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, []);

  const particles = useMemo<Record<number, Particle[]>>(
    () => Object.fromEntries(cards.map((_, index) => [index, starLayout(index, particleCount)])),
    [cards, particleCount],
  );

  const resetCard = useCallback((index: number) => {
    const el = cardRefs.current[index];
    if (!el) return;
    el.style.setProperty('--mx', '50%');
    el.style.setProperty('--my', '50%');
    el.style.setProperty('--tilt-x', '0deg');
    el.style.setProperty('--tilt-y', '0deg');
    el.style.setProperty('--magnet-x', '0px');
    el.style.setProperty('--magnet-y', '0px');
  }, []);

  const onGridMove = (event: React.MouseEvent<HTMLDivElement>) => {
    const el = gridRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setSpot({ x: event.clientX - rect.left, y: event.clientY - rect.top, o: 1 });
  };

  const onCardMove = (event: React.MouseEvent<HTMLButtonElement>) => {
    const el = event.currentTarget;
    const rect = el.getBoundingClientRect();
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    el.style.setProperty('--mx', `${px}px`);
    el.style.setProperty('--my', `${py}px`);
    if (reducedMotion) return;
    const nx = px / Math.max(1, rect.width) - 0.5;
    const ny = py / Math.max(1, rect.height) - 0.5;
    if (enableTilt) {
      el.style.setProperty('--tilt-y', `${(nx * 7).toFixed(2)}deg`);
      el.style.setProperty('--tilt-x', `${(-ny * 7).toFixed(2)}deg`);
    }
    if (enableMagnetism) {
      el.style.setProperty('--magnet-x', `${(nx * 10).toFixed(2)}px`);
      el.style.setProperty('--magnet-y', `${(ny * 10).toFixed(2)}px`);
    }
  };

  const onCardClick = (event: React.MouseEvent<HTMLButtonElement>, card: BentoCard, index: number) => {
    if (clickEffect && !reducedMotion) {
      const rect = event.currentTarget.getBoundingClientRect();
      const ripple = { id: Date.now() + index, x: event.clientX - rect.left, y: event.clientY - rect.top };
      setRipples((prev) => ({ ...prev, [index]: [...(prev[index] ?? []), ripple] }));
      window.setTimeout(() => {
        setRipples((prev) => ({
          ...prev,
          [index]: (prev[index] ?? []).filter((item) => item.id !== ripple.id),
        }));
      }, 640);
    }
    if (card.to) onNavigate?.(card.to);
  };

  const isDark = tone === 'dark';
  const panel = isDark ? 'rgba(12, 25, 20, 0.7)' : 'var(--museum-panel)';
  const line = isDark ? 'rgba(167, 196, 178, 0.16)' : 'var(--museum-line)';
  const foreground = isDark ? '#F2F5EF' : 'var(--museum-fg)';
  const muted = isDark ? 'rgba(212, 226, 216, 0.68)' : 'var(--museum-muted)';

  return (
    <div
      ref={gridRef}
      onMouseMove={onGridMove}
      onMouseLeave={() => setSpot((value) => ({ ...value, o: 0 }))}
      className={`relative grid grid-cols-2 gap-3 md:grid-cols-3 ${className}`}
      style={{ perspective: '1100px' }}
    >
      {enableSpotlight && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-10 rounded-2xl transition-opacity duration-300"
          style={{
            opacity: reducedMotion ? 0 : spot.o,
            background: `radial-gradient(circle ${spotlightRadius}px at ${spot.x}px ${spot.y}px, rgba(${glowColor}, 0.13), transparent 66%)`,
          }}
        />
      )}

      {cards.map((card, index) => (
        <motion.button
          key={`${card.title}-${index}`}
          ref={(el) => {
            cardRefs.current[index] = el;
          }}
          type="button"
          initial={reducedMotion ? false : { opacity: 0 }}
          whileInView={reducedMotion ? undefined : { opacity: 1 }}
          viewport={{ once: true, amount: 0.25 }}
          transition={{ duration: 0.55, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
          onMouseMove={onCardMove}
          onMouseLeave={() => resetCard(index)}
          onClick={(event) => onCardClick(event, card, index)}
          className={`magic-bento-card group relative flex h-full flex-col overflow-hidden rounded-2xl border p-4 text-left transition-[background-color,border-color] duration-300 sm:p-5 ${
            card.feature ? 'col-span-2 min-h-[13rem] md:col-span-2 md:min-h-[15rem]' : 'min-h-[10.5rem]'
          } ${isDark ? 'hover:bg-[rgba(19,38,30,0.9)]' : 'hover:bg-[var(--museum-panel-raised)]'}`}
          style={
            {
              borderColor: line,
              background: panel,
              color: foreground,
              '--bento-glow': glowColor,
              transform:
                'perspective(1100px) rotateX(var(--tilt-x, 0deg)) rotateY(var(--tilt-y, 0deg)) translate3d(var(--magnet-x, 0px), var(--magnet-y, 0px), 0)',
              transformStyle: 'preserve-3d',
              transition: 'transform 180ms ease-out, background-color 300ms ease, border-color 300ms ease',
              '--mx': '50%',
              '--my': '50%',
            } as CSSProperties
          }
        >
          {/* 跟随指针的边框辉光 */}
          {enableBorderGlow && (
            <span
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(circle 210px at var(--mx) var(--my), rgba(${glowColor}, 0.22), transparent 72%)`,
              }}
            />
          )}
          {/* 顶部细光带：暗场里给卡片一条清晰的边界 */}
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-6 top-0 h-px"
            style={{ background: `linear-gradient(90deg, transparent, rgba(${glowColor}, .55), transparent)` }}
          />

          {enableStars &&
            !reducedMotion &&
            (particles[index] ?? []).map((particle, particleIndex) => (
              <motion.span
                key={particleIndex}
                aria-hidden="true"
                className="pointer-events-none absolute rounded-full"
                style={{
                  left: particle.left,
                  top: particle.top,
                  width: particle.size,
                  height: particle.size,
                  background: isDark ? '#E8F0E6' : 'var(--stage-gold)',
                }}
                animate={{ opacity: [particle.opacity * 0.3, particle.opacity, particle.opacity * 0.3] }}
                transition={{ duration: particle.duration, delay: particle.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

          {(ripples[index] ?? []).map((ripple) => (
            <motion.span
              key={ripple.id}
              aria-hidden="true"
              className="pointer-events-none absolute rounded-full"
              style={{
                left: ripple.x - 24,
                top: ripple.y - 24,
                width: 48,
                height: 48,
                background: `rgba(${glowColor}, .32)`,
              }}
              initial={{ scale: 0, opacity: 0.55 }}
              animate={{ scale: 4.6, opacity: 0 }}
              transition={{ duration: 0.62, ease: 'easeOut' }}
            />
          ))}

          <span className="relative z-20 flex items-start justify-between gap-3">
            <span
              className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border"
              style={{ borderColor: line, color: isDark ? '#E4C384' : 'var(--stage-gold)' }}
            >
              {card.icon}
            </span>
            {card.meta && (
              <span className="pt-1 font-mono text-[0.6rem] tracking-[0.16em]" style={{ color: muted }}>
                {card.meta}
              </span>
            )}
          </span>

          <span className="relative z-20 mt-auto block pt-5">
            {card.label && (
              <span className="mb-1 block font-mono text-[0.6rem] uppercase tracking-[0.22em]" style={{ color: muted }}>
                {card.label}
              </span>
            )}
            <span
              className={`block font-serif font-semibold tracking-tight ${card.feature ? 'text-2xl sm:text-3xl' : 'text-base'}`}
            >
              {card.title}
            </span>
            <span
              className={`mt-2 block text-pretty ${card.feature ? 'max-w-[46ch] text-sm leading-6' : 'text-xs leading-5'}`}
              style={{ color: muted }}
            >
              {card.description}
            </span>
          </span>
        </motion.button>
      ))}
    </div>
  );
};

export default MagicBento;
