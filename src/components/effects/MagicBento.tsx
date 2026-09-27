import { useMemo, useRef, useState, type ReactNode } from 'react';
import { motion } from 'motion/react';

export interface BentoCard {
  icon: ReactNode;
  title: string;
  description: string;
  label?: string;
  to?: string;
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
  clickEffect?: boolean;
  onNavigate?: (to: string) => void;
  className?: string;
}

interface Ripple {
  id: number;
  x: number;
  y: number;
}

/**
 * 魔法便当盒功能卡片：
 * 鼠标跟随光晕 + 星星粒子 + 边框发光 + 点击波纹，无需 WebGL。
 */
const MagicBento = ({
  cards,
  glowColor = '212, 168, 83',
  spotlightRadius = 400,
  particleCount = 12,
  enableStars = true,
  enableSpotlight = true,
  enableBorderGlow = true,
  clickEffect = true,
  onNavigate,
  className = '',
}: MagicBentoProps) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [spot, setSpot] = useState({ x: 0, y: 0, o: 0 });
  const [ripples, setRipples] = useState<Record<number, Ripple[]>>({});

  // 每张卡片的星星粒子（随机位置/延迟，挂载时生成一次）
  const stars = useMemo(
    () =>
      cards.map(() =>
        Array.from({ length: particleCount }, () => ({
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          size: Math.random() * 1.5 + 1,
          delay: Math.random() * 2.4,
          duration: 2 + Math.random() * 1.6,
        })),
      ),
    [cards, particleCount],
  );

  const onGridMove = (e: React.MouseEvent) => {
    const el = gridRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setSpot({ x: e.clientX - r.left, y: e.clientY - r.top, o: 1 });
  };

  const onCardMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    e.currentTarget.style.setProperty('--lx', `${e.clientX - r.left}px`);
    e.currentTarget.style.setProperty('--ly', `${e.clientY - r.top}px`);
  };

  const onCardClick = (e: React.MouseEvent<HTMLButtonElement>, card: BentoCard, idx: number) => {
    if (clickEffect) {
      const r = e.currentTarget.getBoundingClientRect();
      const ripple = { id: Date.now(), x: e.clientX - r.left, y: e.clientY - r.top };
      setRipples((prev) => ({ ...prev, [idx]: [...(prev[idx] ?? []), ripple] }));
      setTimeout(() => {
        setRipples((prev) => ({ ...prev, [idx]: (prev[idx] ?? []).filter((r) => r.id !== ripple.id) }));
      }, 600);
    }
    if (card.to) onNavigate?.(card.to);
  };

  return (
    <div
      ref={gridRef}
      onMouseMove={onGridMove}
      onMouseLeave={() => setSpot((s) => ({ ...s, o: 0 }))}
      className={`relative grid grid-cols-2 md:grid-cols-3 gap-4 ${className}`}
    >
      {/* 全局鼠标跟随光晕 */}
      {enableSpotlight && (
        <div
          className="pointer-events-none absolute inset-0 z-10 transition-opacity duration-300"
          style={{
            opacity: spot.o,
            background: `radial-gradient(circle ${spotlightRadius}px at ${spot.x}px ${spot.y}px, rgba(${glowColor}, 0.14), transparent 65%)`,
          }}
        />
      )}

      {cards.map((card, i) => (
        <motion.button
          key={i}
          type="button"
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: i * 0.06 }}
          whileHover={{ y: -4 }}
          onMouseMove={onCardMove}
          onClick={(e) => onCardClick(e, card, i)}
          className="group relative overflow-hidden rounded-xl border border-white/10 bg-white/5 p-5 md:p-6 text-left transition-colors duration-300 hover:border-[rgba(212,168,83,0.45)] hover:bg-white/10 h-full flex flex-col"
        >
          {/* 边框/内部发光（跟随鼠标） */}
          {enableBorderGlow && (
            <div
              className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
              style={{
                background: `radial-gradient(circle 180px at var(--lx, 50%) var(--ly, 50%), rgba(${glowColor}, 0.28), transparent 70%)`,
              }}
            />
          )}

          {/* 星星粒子 */}
          {enableStars &&
            stars[i]?.map((s, j) => (
              <motion.span
                key={j}
                className="pointer-events-none absolute rounded-full bg-white"
                style={{ left: s.left, top: s.top, width: s.size, height: s.size }}
                animate={{ opacity: [0.12, 0.85, 0.12] }}
                transition={{ duration: s.duration, delay: s.delay, repeat: Infinity, ease: 'easeInOut' }}
              />
            ))}

          {/* 点击波纹 */}
          {(ripples[i] ?? []).map((r) => (
            <motion.span
              key={r.id}
              className="pointer-events-none absolute rounded-full bg-white/40"
              style={{ left: r.x - 20, top: r.y - 20, width: 40, height: 40 }}
              initial={{ scale: 0, opacity: 0.5 }}
              animate={{ scale: 4, opacity: 0 }}
              transition={{ duration: 0.55, ease: 'easeOut' }}
            />
          ))}

          <div className="relative z-10 flex flex-col h-full">
            <div className="w-11 h-11 rounded-lg bg-white/10 border border-white/10 flex items-center justify-center shrink-0 mb-4 text-[#d4a853]">
              {card.icon}
            </div>
            {card.label && (
              <span className="text-[10px] uppercase tracking-wider text-white/40 mb-1">{card.label}</span>
            )}
            <h3 className="text-base font-semibold text-white mb-1 text-balance">{card.title}</h3>
            <p className="text-sm text-white/60 leading-relaxed text-pretty flex-1">{card.description}</p>
          </div>
        </motion.button>
      ))}
    </div>
  );
};

export default MagicBento;
