import React, { useEffect, useMemo, useRef, useState } from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, MapPin } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { breeds } from '@/data/breeds';
import { NATIONAL_PROTECTED_BREED_NAMES } from '@/data/nationalProtectionList';
import { provincePaths, mapViewBox } from '@/data/chinaMap';
import CountUp from '@/components/common/CountUp';

const PLATEAU_KEYS = ['青海省', '西藏自治区'];
const protectedSet = new Set<string>(NATIONAL_PROTECTED_BREED_NAMES);
const LOOSE_ONLY = new Set(['林芝藏猪']); // 名称包含匹配但不在公告名单内的记录不点亮

/** 青海 + 西藏的省级轮廓（聚焦高原） */
const plateauPaths = PLATEAU_KEYS.map((key) => provincePaths[key]).filter(Boolean);

/** 出现过的省份按需保留（地图底图完整显示，非高原省份降透明度） */
const otherPaths = Object.entries(provincePaths).filter(([key]) => !PLATEAU_KEYS.includes(key));

/**
 * 屏④ 家底：66 个高原品种 + 13 颗国家级保护星。
 * 数字全部来自 COLLECTION_SUMMARY；金星由 940 号公告名单精确匹配后点亮。
 */
const StoryScreenPlateau: React.FC = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // 13 颗保护星：按公告名单精确命中，并保留有真实坐标（非哨兵）的记录
  const protectedStars = useMemo(
    () =>
      breeds
        .filter((b) => protectedSet.has(b.name) && !LOOSE_ONLY.has(b.name))
        .filter((b) => b.longitude !== 0 || b.latitude !== 0)
        .filter((b) => PLATEAU_KEYS.includes(provinceKey(b.province)))
        .map((b) => ({
          id: b.id,
          name: b.name,
          province: b.province,
          x: ((b.longitude - 73) / (135 - 73)) * mapViewBox.width,
          y: ((54 - b.latitude) / (54 - 18)) * mapViewBox.height,
        })),
    [],
  );

  // 触发顺序：按经度从左到右，视觉上有“依次点亮”的节奏
  const orderedStars = useMemo(
    () => [...protectedStars].sort((a, b) => a.x - b.x),
    [protectedStars],
  );

  return (
    <section
      ref={sectionRef}
      aria-label={t('story.plateauTitle')}
      className="relative bg-black py-20 md:py-28"
    >
      <div className="mx-auto max-w-5xl px-4 md:px-6">
        <h2 className="font-serif text-2xl font-bold leading-tight text-white text-balance md:text-4xl">
          {t('story.plateauTitle')}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 text-pretty md:text-base">
          {t('story.plateauBody')}
        </p>

        <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          {/* 数字卡 */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.07] to-white/[0.02] p-5 md:p-6">
              <p className="text-xs text-white/55">{t('story.plateauStatBreedsLabel')}</p>
              <p
                data-testid="plateau-breed-count"
                className="mt-2 font-serif text-5xl font-bold tabular-nums text-[#e8c98a] md:text-6xl"
              >
                <CountUp end={COLLECTION_SUMMARY.plateau} />
              </p>
              <p className="mt-2 text-xs text-white/60">{t('story.plateauStatBreedsSub')}</p>
            </div>
            <div className="rounded-2xl border border-[#d4a853]/35 bg-gradient-to-br from-[#3d2f12]/60 to-[#1a1206]/60 p-5 md:p-6">
              <p className="text-xs text-white/55">{t('story.plateauStatProtectedLabel')}</p>
              <p
                data-testid="plateau-protected-count"
                className="mt-2 font-serif text-5xl font-bold tabular-nums text-[#d4a853] md:text-6xl"
              >
                <CountUp end={COLLECTION_SUMMARY.plateauNationalProtected} />
              </p>
              <p className="mt-2 text-xs text-white/60">{t('story.plateauStatProtectedSub')}</p>
            </div>
            <button
              type="button"
              onClick={() => navigate('/map?province=青海')}
              className="min-h-11 inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/20 bg-white/5 px-4 text-sm text-white/85 transition-colors hover:bg-white/10"
            >
              <MapPin className="h-4 w-4" aria-hidden="true" />
              {t('story.plateauOpenMap')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          {/* 聚光地图：高原省份高亮 + 金星依次点亮 */}
          <div className="rounded-2xl border border-white/12 bg-white/[0.03] p-3">
            <svg
              viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
              className="h-full w-full"
              role="img"
              aria-label={t('story.plateauMapAria')}
            >
              {otherPaths.map(([key, d]) => (
                <path key={key} d={d} fill="rgba(150,175,220,0.06)" stroke="rgba(150,175,220,0.28)" strokeWidth={0.7} />
              ))}
              {plateauPaths.map((d, i) => (
                <path key={i} d={d} fill="rgba(212,168,83,0.16)" stroke="#d4a853" strokeWidth={1.1} />
              ))}
              {orderedStars.map((star, index) => (
                <g
                  key={star.id}
                  style={
                    reduceMotion
                      ? undefined
                      : {
                          opacity: inView ? 1 : 0,
                          transition: `opacity 0.5s ease ${index * 0.18}s`,
                        }
                  }
                >
                  <circle cx={star.x} cy={star.y} r={7} fill="none" stroke="#d4a853" strokeWidth={1.4} className="protected-pulse" />
                  <circle cx={star.x} cy={star.y} r={3.6} fill="#f0d38a" stroke="#fff5d6" strokeWidth={1.2} />
                </g>
              ))}
            </svg>
            <p className="mt-2 text-center text-[11px] text-white/50">{t('story.plateauMapCaption')}</p>
          </div>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-white/50">{t('story.plateauFootnote')}</p>
      </div>
    </section>
  );
};

/** 简写省份 → 数据里的键（地图用全称） */
function provinceKey(province: string): string {
  if (province === '青海') return '青海省';
  if (province === '西藏') return '西藏自治区';
  return province;
}

export default StoryScreenPlateau;
