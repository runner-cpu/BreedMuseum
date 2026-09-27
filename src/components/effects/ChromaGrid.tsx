import React, { useCallback, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import CountUp from '@/components/common/CountUp';

export interface ChromaItem {
  title: string;
  subtitle: string;
  handle?: string;
  borderColor: string;
  gradient: string;
  url?: string;
  /** 数字标题是否启用滚动动画 */
  countUp?: boolean;
}

const colMap: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

const Card: React.FC<{ item: ChromaItem; index: number; onClick: () => void }> = ({ item, index, onClick }) => {
  const [pos, setPos] = useState({ x: '50%', y: '50%' });
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setPos({ x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` });
  }, []);

  return (
    <motion.button
      type="button"
      ref={ref}
      onClick={onClick}
      onMouseMove={onMove}
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      transition={{ duration: 0.5, delay: index * 0.08 }}
      whileHover={{ y: -6 }}
      className="group relative overflow-hidden rounded-xl border p-6 text-left h-full"
      style={{ borderColor: item.borderColor, background: item.gradient }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover:opacity-100"
        style={
          {
            background:
              'radial-gradient(circle 200px at var(--mx) var(--my), rgba(255,255,255,0.28), transparent 70%)',
            '--mx': pos.x,
            '--my': pos.y,
          } as React.CSSProperties
        }
      />
      <div className="relative z-10">
        <p className="text-3xl md:text-4xl font-serif font-bold text-white tabular-nums leading-none">
          {item.countUp && /^\d+$/.test(item.title) ? <CountUp end={Number(item.title)} /> : item.title}
        </p>
        <p className="text-sm text-white/80 mt-3">{item.subtitle}</p>
        {item.handle && <p className="text-xs text-white/50 mt-2">{item.handle}</p>}
      </div>
    </motion.button>
  );
};

interface ChromaGridProps {
  items: ChromaItem[];
  columns?: number;
  onNavigate?: (url: string) => void;
}

const ChromaGrid = ({ items, columns = 4, onNavigate }: ChromaGridProps) => {
  const navigate = useNavigate();
  const colClass = colMap[columns] ?? 'md:grid-cols-4';

  return (
    <div className={`grid grid-cols-2 ${colClass} gap-4`}>
      {items.map((item, i) => (
        <Card
          key={i}
          item={item}
          index={i}
          onClick={() => {
            if (item.url) {
              onNavigate ? onNavigate(item.url) : navigate(item.url);
            }
          }}
        />
      ))}
    </div>
  );
};

export default ChromaGrid;