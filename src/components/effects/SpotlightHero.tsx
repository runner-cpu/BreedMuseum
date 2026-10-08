import { useCallback, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ArrowRight, Search } from 'lucide-react';
import { provincePaths, mapViewBox } from '@/data/chinaMap';
import { useSettings } from '@/contexts/AppSettings';
import { publicAsset } from '@/lib/publicAsset';
import { Button } from '@/components/ui/button';

// 各省份高亮配色（聚光时显示的彩色地图）
const palette = [
  '#d4a853', '#e08a4a', '#c97b63', '#a85c7a', '#6b5b95',
  '#4a7a9a', '#3a8a7a', '#5a9a5a', '#8aa050', '#b09040',
];
const colorFor = (i: number) => palette[i % palette.length];

interface SpotlightHeroProps {
  titleTop: string;
  titleBottom: string;
  descLeft: string;
  descRight: string;
  badge: string;
  cta: string;
  searchPh: string;
  searchBtn: string;
  onExplore: () => void;
  onSearch: (q: string) => void;
}

/**
 * 光标聚光地图英雄区：
 * 底层为中国地图淡色轮廓，上层为彩色填充地图，
 * 通过跟随光标的径向聚光遮罩局部揭示彩色地图。
 */
const SpotlightHero = ({
  titleTop,
  titleBottom,
  descLeft,
  descRight,
  badge,
  cta,
  searchPh,
  searchBtn,
  onExplore,
  onSearch,
}: SpotlightHeroProps) => {
  const { t } = useSettings();
  const reduceMotion = useReducedMotion();
  const [pos, setPos] = useState({ x: '50%', y: '50%' });
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  const onMove = useCallback((e: React.MouseEvent) => {
    const el = ref.current;
    if (!el || reduceMotion) return;
    const r = el.getBoundingClientRect();
    setPos({ x: `${e.clientX - r.left}px`, y: `${e.clientY - r.top}px` });
  }, [reduceMotion]);

  return (
    <section
      ref={ref}
      onMouseMove={onMove}
      className="relative h-[calc(100dvh-7rem)] min-h-[600px] w-full overflow-hidden bg-black"
    >
      {/* 底图：高原牧场大场景插画（项目原创 SVG，浅色地图轮廓压在其上） */}
      <img
        src={publicAsset('brand/plateau-hero.svg')}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover"
      />
      {/* 压暗层：保证标题与地图线条在亮部仍可读 */}
      <div aria-hidden="true" className="absolute inset-0 bg-gradient-to-b from-black/70 via-black/45 to-black/80" />

      {/* 基础图：中国地图淡色轮廓（完整显示，含海南等省份） */}
      <div aria-hidden="true" className="absolute inset-0 flex items-center justify-center">
        <svg
          viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
          className="w-full h-full opacity-70"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.values(provincePaths).map((d, i) => (
            <path key={i} d={d} fill="rgba(150,175,220,0.07)" stroke="rgba(150,175,220,0.5)" strokeWidth="0.7" />
          ))}
        </svg>
      </div>

      {/* 聚光图：彩色填充地图，随光标揭示 */}
      <div
        aria-hidden="true"
        className="spotlight-reveal absolute inset-0 flex items-center justify-center"
        style={{ '--mx': pos.x, '--my': pos.y } as React.CSSProperties}
      >
        <svg
          viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.values(provincePaths).map((d, i) => (
            <path key={i} d={d} fill={colorFor(i)} stroke="rgba(255,255,255,0.6)" strokeWidth="0.5" opacity="0.92" />
          ))}
        </svg>
      </div>

      {/* 中央标题与入口 */}
      <div className="absolute inset-0 flex flex-col items-center justify-center px-6 text-center">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#d4a853]" />
          {badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="font-serif font-bold text-white text-balance leading-tight [text-shadow:0_2px_24px_rgba(0,0,0,0.65)]"
        >
          <span className="block text-3xl md:text-6xl">{titleTop}</span>
          <span className="block text-3xl md:text-6xl bg-gradient-to-r from-[#d4a853] via-[#e8c98a] to-[#d4a853] bg-clip-text text-transparent">
            {titleBottom}
          </span>
        </motion.h1>

        <motion.form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q);
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 w-full max-w-md flex items-center gap-2 bg-white/10 border border-white/20 rounded-full px-3 py-1.5 backdrop-blur"
        >
          <Search className="w-4 h-4 text-white/50 shrink-0" />
          <input
            type="search"
            aria-label={t('hero.searchAria')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPh}
            className="h-11 flex-1 min-w-0 bg-transparent text-sm text-white placeholder:text-white/65 outline-none px-1"
          />
          <Button
            type="submit"
            size="sm"
            className="min-h-11 bg-[#d4a853] text-[#1a3a2a] hover:bg-[#d4a853]/90 rounded-full shrink-0"
          >
            {searchBtn}
          </Button>
        </motion.form>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="mt-6"
        >
          <Button
            size="lg"
            onClick={onExplore}
            className="bg-[#d4a853] text-[#1a3a2a] hover:bg-[#d4a853]/90 font-medium px-7"
          >
            {cta}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </motion.div>
      </div>

      {/* 底部左侧描述 */}
      <div className="absolute bottom-6 left-6 md:bottom-10 md:left-10 max-w-xs">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs md:text-sm text-white/60 leading-relaxed text-pretty"
        >
          {descLeft}
        </motion.p>
      </div>

      {/* 底部右侧描述 */}
      <div className="hidden md:block absolute bottom-6 right-6 md:bottom-10 md:right-10 max-w-xs text-right">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs md:text-sm text-white/60 leading-relaxed text-pretty"
        >
          {descRight}
        </motion.p>
      </div>
    </section>
  );
};

export default SpotlightHero;
