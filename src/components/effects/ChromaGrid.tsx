import { motion } from 'motion/react';
import { type CSSProperties, useCallback, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CountUp from '@/components/common/CountUp';

export interface ChromaItem {
  /** 主数字或主标题，例如 1,186 */
  title: string;
  subtitle: string;
  /** 底部补充说明：口径、单位或更新时间 */
  handle?: string;
  /** 卡片主色（边框与径向光晕） */
  borderColor: string;
  /** 卡片背景渐变 */
  gradient: string;
  /** 右侧小图标 */
  icon?: React.ReactNode;
  url?: string;
  /** 纯数字标题启用滚动动画 */
  countUp?: boolean;
  /** 数字标题的格式化（千分位等），与站点语言保持一致 */
  format?: (value: number) => string;
}

interface ChromaGridProps {
  items: ChromaItem[];
  columns?: number;
  onNavigate?: (url: string) => void;
  className?: string;
}

const colMap: Record<number, string> = {
  2: 'md:grid-cols-2',
  3: 'md:grid-cols-3',
  4: 'md:grid-cols-4',
};

/**
 * 色光数据卡：指针扫过时，一道同色光斑跟随移动，边框与数字同时提亮。
 *
 * 每张卡的光斑位置是本地的（只重绘自己），避免整张网格随鼠标重渲染。
 * 数字用 `CountUp`，在减少动画偏好下直接落终值。
 */
const Card = ({ item, index, onClick }: { item: ChromaItem; index: number; onClick: () => void }) => {
  const [pos, setPos] = useState({ x: '50%', y: '50%' });
  const [active, setActive] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);

  const onMove = useCallback((event: React.MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    setPos({ x: `${event.clientX - rect.left}px`, y: `${event.clientY - rect.top}px` });
  }, []);

  const numeric = item.countUp && /^\d+$/.test(item.title.replace(/,/g, ''));

  return (
    <motion.button
      type="button"
      ref={ref}
      onClick={onClick}
      onMouseMove={onMove}
      onMouseEnter={() => setActive(true)}
      onMouseLeave={() => setActive(false)}
      onFocus={() => setActive(true)}
      onBlur={() => setActive(false)}
      initial={{ opacity: 0, y: 22 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.5, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      className="group relative h-full min-h-[9.5rem] overflow-hidden rounded-2xl border p-4 text-left sm:p-5"
      style={
        {
          borderColor: active ? item.borderColor : 'rgba(255,255,255,.14)',
          background: item.gradient,
          boxShadow: active ? `0 18px 46px -22px ${item.borderColor}` : '0 12px 32px -26px rgba(0,0,0,.9)',
          transition: 'border-color 260ms ease, box-shadow 260ms ease',
          '--mx': pos.x,
          '--my': pos.y,
        } as CSSProperties
      }
    >
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 transition-opacity duration-300"
        style={{
          opacity: active ? 1 : 0,
          background: `radial-gradient(circle 230px at var(--mx) var(--my), ${item.borderColor}3D, transparent 72%)`,
        }}
      />
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-px"
        style={{ background: `linear-gradient(90deg, transparent, ${item.borderColor}, transparent)`, opacity: active ? 0.9 : 0.35 }}
      />
      <span className="relative z-10 flex h-full flex-col">
        <span className="flex items-start justify-between gap-2">
          <span className="font-mono text-[0.62rem] uppercase tracking-[0.18em] text-white/55">
            {String(index + 1).padStart(2, '0')}
          </span>
          {item.icon && <span style={{ color: item.borderColor }}>{item.icon}</span>}
        </span>
        <span className="mt-4 block font-mono text-3xl font-semibold leading-none tabular-nums text-white sm:text-[2.1rem]">
          {numeric ? <CountUp end={Number(item.title.replace(/,/g, ''))} format={item.format} /> : item.title}
        </span>
        <span className="mt-2 block text-sm font-medium text-white/90">{item.subtitle}</span>
        {item.handle && <span className="mt-auto block pt-3 text-[0.68rem] leading-5 text-white/55">{item.handle}</span>}
      </span>
    </motion.button>
  );
};

const ChromaGrid = ({ items, columns = 4, onNavigate, className = '' }: ChromaGridProps) => {
  const navigate = useNavigate();
  const colClass = colMap[columns] ?? 'md:grid-cols-4';

  return (
    <div className={`grid grid-cols-2 ${colClass} gap-3 ${className}`}>
      {items.map((item, index) => (
        <Card
          key={`${item.title}-${index}`}
          item={item}
          index={index}
          onClick={() => {
            if (item.url) {
              if (onNavigate) onNavigate(item.url);
              else navigate(item.url);
            }
          }}
        />
      ))}
    </div>
  );
};

export default ChromaGrid;
