import { ArrowRight, Search } from 'lucide-react';
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from 'motion/react';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import ScrollFloat from '@/components/effects/ScrollFloat';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/AppSettings';
import { mapViewBox, provincePaths } from '@/data/chinaMap';

// 序厅暗场用馆藏品牌墨绿，聚光层只揭示一种含义：金色版图 = 馆藏覆盖省域。
// 旧实现按省份下标轮换十种颜色，既不编码任何字段，也和站内墨绿/宣纸/金色令牌脱节。
/*
 * 底层轮廓不能太淡：指针未进入英雄区时没有任何聚光，若填充只有 7% 不透明度，
 * 首屏看起来就是一块空黑。现在白描边 + 12% 填充让中国轮廓静态可读，
 * 聚光仍负责把经过的区域提成金色。
 */
const HERO_BASE_FILL = 'rgba(198, 214, 203, 0.10)';
const HERO_BASE_STROKE = 'rgba(214, 228, 218, 0.40)';
/**
 * 首屏地图改用「青铜—鼠尾草」双色，而不是通体金黄：
 * 旧实现整块 #c79a45 在金与绿之间摇摆，既压不住标题，也和站内 accent 脱节。
 */
const HERO_REVEAL_FILL = '#B0894E';
const HERO_REVEAL_STROKE = 'rgba(246, 238, 220, 0.50)';

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
 * 底层为中国地图淡色轮廓，上层为金色版图，
 * 通过跟随光标的径向聚光遮罩局部揭示。
 *
 * 触屏 / `prefers-reduced-motion` 下遮罩整体展开（见 light-map-page.css），
 * 不依赖指针移动也能读到完整版图。
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
  const pointerX = useMotionValue(0);
  const pointerY = useMotionValue(0);
  const springX = useSpring(pointerX, { stiffness: 130, damping: 24, mass: 0.35 });
  const springY = useSpring(pointerY, { stiffness: 130, damping: 24, mass: 0.35 });
  const [q, setQ] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  useLayoutEffect(() => {
    scrollContainerRef.current = ref.current?.closest('main') ?? null;
  }, []);
  const { scrollYProgress } = useScroll({ target: ref, container: scrollContainerRef, offset: ['start start', 'end start'] });
  const mapScale = useTransform(scrollYProgress, [0, 1], [1, 1.12]);
  const mapY = useTransform(scrollYProgress, [0, 1], [0, -46]);
  const mapOpacity = useTransform(scrollYProgress, [0, 1], [1, 0.68]);
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -34]);
  const titleOpacity = useTransform(scrollYProgress, [0, 0.85], [1, 0.18]);
  const spotlightX = useTransform(springX, (value) => value === 0 ? '50%' : `${value}px`);
  const spotlightY = useTransform(springY, (value) => value === 0 ? '50%' : `${value}px`);

  const onMove = useCallback((e: React.PointerEvent) => {
    const el = ref.current;
    if (!el || reduceMotion || e.pointerType !== 'mouse') return;
    const r = el.getBoundingClientRect();
    pointerX.set(e.clientX - r.left);
    pointerY.set(e.clientY - r.top);
  }, [reduceMotion]);

  const onLeave = useCallback(() => {
    if (reduceMotion || !ref.current) return;
    pointerX.set(ref.current.clientWidth * 0.5);
    pointerY.set(ref.current.clientHeight * 0.5);
  }, [reduceMotion]);

  return (
    <section
      ref={ref}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      className="spotlight-hero relative h-[calc(100dvh-7rem)] min-h-[600px] w-full overflow-hidden"
      style={{ background: '#080D0B' }}
    >
      {/* 深墨绿地图舞台：让中国轮廓成为首屏主角。 */}
      <div aria-hidden="true" className="absolute inset-0" style={{ background: 'radial-gradient(circle at 52% 45%,rgba(64,118,92,.34),transparent 36%),radial-gradient(circle at 80% 18%,rgba(176,137,78,.16),transparent 26%),linear-gradient(180deg,#14251d,#0b1512 62%,#080d0b)' }} />
      <div aria-hidden="true" className="pointer-events-none absolute inset-0 opacity-30 [background-image:radial-gradient(circle,rgb(var(--stage-fg-rgb)/.28)_0_1px,transparent_1.5px)] [background-size:84px_84px]" />

      {/* 基础图：中国地图淡色轮廓（完整显示，含海南等省份） */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 flex items-center justify-center"
        style={{ scale: reduceMotion ? 1 : mapScale, y: reduceMotion ? 0 : mapY, opacity: reduceMotion ? 1 : mapOpacity }}
      >
        <svg
          viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
          className="w-full h-full opacity-70"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.values(provincePaths).map((d, i) => (
            <path key={i} d={d} fill={HERO_BASE_FILL} stroke={HERO_BASE_STROKE} strokeWidth="0.7" />
          ))}
        </svg>
      </motion.div>

      {/* 聚光图：金色版图，随光标揭示 */}
      <motion.div
        aria-hidden="true"
        className="spotlight-reveal absolute inset-0 flex items-center justify-center"
        style={{ '--mx': spotlightX, '--my': spotlightY, scale: reduceMotion ? 1 : mapScale, y: reduceMotion ? 0 : mapY } as React.CSSProperties}
      >
        <svg
          viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
          className="w-full h-full"
          preserveAspectRatio="xMidYMid meet"
        >
          {Object.values(provincePaths).map((d, i) => (
            <path key={i} d={d} fill={HERO_REVEAL_FILL} stroke={HERO_REVEAL_STROKE} strokeWidth="0.5" opacity="0.92" />
          ))}
        </svg>
      </motion.div>

      {/* 中央标题与入口 */}
      <motion.div
        className="spotlight-hero-copy absolute inset-0 flex flex-col items-center justify-center px-6 text-center"
        style={{ y: reduceMotion ? 0 : titleY, opacity: reduceMotion ? 1 : titleOpacity }}
      >
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/10 border border-white/20 text-xs text-white/80 mb-6"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#D8B26A]" />
          {badge}
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          aria-label={`${titleTop}${titleBottom}`}
          className="font-serif font-bold text-balance leading-tight"
          style={{ color: '#f5f4ee', textShadow: '0 2px 24px rgba(0,0,0,.65)' }}
        >
          <ScrollFloat
            as="span"
            decorative
            once
            containerClassName="block whitespace-nowrap text-[clamp(1.55rem,7.2vw,3.75rem)]"
            stagger={0.035}
            animationDuration={0.75}
          >
            {titleTop}
          </ScrollFloat>
          <ScrollFloat
            as="span"
            decorative
            once
            containerClassName="block whitespace-nowrap text-[clamp(1.55rem,7.2vw,3.75rem)]"
            textClassName="hero-title-gold"
            stagger={0.035}
            animationDuration={0.75}
          >
            {titleBottom}
          </ScrollFloat>
        </motion.h1>

        <motion.form
          onSubmit={(e) => {
            e.preventDefault();
            onSearch(q);
          }}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35 }}
          className="mt-8 w-full max-w-md flex items-center gap-2 rounded-full px-3 py-1.5 backdrop-blur"
          style={{ background: 'rgba(255,255,255,.1)', border: '1px solid rgba(255,255,255,.2)' }}
        >
          <Search className="w-4 h-4 shrink-0 text-white/60" />
          <input
            type="search"
            aria-label={t('hero.searchAria')}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder={searchPh}
            className="h-11 flex-1 min-w-0 bg-transparent text-sm outline-none px-1"
            style={{ color: '#f5f4ee' }}
          />
          <Button
            type="submit"
            size="sm"
            className="min-h-11 bg-[#D8B26A] text-[#14251d] hover:bg-[#E6C486] rounded-full shrink-0"
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
            className="bg-[#D8B26A] text-[#14251d] hover:bg-[#E6C486] font-medium px-7"
          >
            {cta}
            <ArrowRight className="w-4 h-4 ml-1.5" />
          </Button>
        </motion.div>
      </motion.div>

      {/* 底部左侧描述 */}
      <div className="absolute bottom-6 left-6 z-20 max-w-xs md:bottom-10 md:left-10">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="text-xs leading-relaxed text-pretty md:text-sm"
          style={{ color: 'rgba(245,244,238,.72)' }}
        >
          {descLeft}
        </motion.p>
      </div>

      {/* 底部右侧描述 */}
      <div className="absolute bottom-6 right-6 z-20 hidden max-w-xs text-right md:bottom-10 md:right-10 md:block">
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="text-xs leading-relaxed text-pretty md:text-sm"
          style={{ color: 'rgba(245,244,238,.72)' }}
        >
          {descRight}
        </motion.p>
      </div>
    </section>
  );
};

export default SpotlightHero;
