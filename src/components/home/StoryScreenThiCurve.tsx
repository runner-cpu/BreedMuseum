import React, { useMemo, useRef } from 'react';
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react';
import { useSettings } from '@/contexts/AppSettings';
import { LEVEL_COLORS, LEVEL_LABELS, type StressLevel } from '@/data/pastureThi';
import { sampleThiCurve } from '@/data/thiCurve';

/**
 * 屏② 量化：THI 曲线由模型实时采样绘制，越过牦牛四档阈值线。
 * 曲线不是示意图——它来自与决策台相同的公式，页面注明采样条件。
 */
const W = 760;
const H = 380;
const PAD = { left: 56, right: 28, top: 34, bottom: 46 };

const StoryScreenThiCurve: React.FC = () => {
  const { t } = useSettings();
  const reduceMotion = useReducedMotion();
  const sectionRef = useRef<HTMLElement>(null);

  // 湿度固定 60%，牦牛阈值——与决策台同源
  const curve = useMemo(() => sampleThiCurve('yak', 60, 0, 35, 36), []);
  const thresholds: Array<{ level: StressLevel; value: number }> = [
    { level: 'comfort', value: 19 },
    { level: 'alert', value: 23 },
    { level: 'danger', value: 26 },
    { level: 'extreme', value: 35 },
  ];

  const { scrollYProgress } = useScroll({
    target: sectionRef,
    offset: ['start end', 'center center'],
  });
  const pathLength = useTransform(scrollYProgress, [0.15, 0.75], [0, 1]);

  const x = (temp: number) => PAD.left + ((temp - curve.minT) / (curve.maxT - curve.minT)) * (W - PAD.left - PAD.right);
  const y = (thi: number) => {
    const lo = Math.floor(curve.minThi) - 1;
    const hi = Math.ceil(curve.maxThi) + 1;
    return PAD.top + (1 - (thi - lo) / (hi - lo)) * (H - PAD.top - PAD.bottom);
  };

  const linePath = curve.points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${x(p.t).toFixed(1)} ${y(p.thi).toFixed(1)}`)
    .join(' ');

  const tempTicks = [0, 5, 10, 15, 20, 25, 30, 35];

  return (
    <section
      ref={sectionRef}
      aria-label={t('story.curveTitle')}
      className="relative bg-black py-20 md:py-28"
    >
      <div className="mx-auto max-w-4xl px-4 md:px-6">
        <h2 className="font-serif text-2xl font-bold leading-tight text-white text-balance md:text-4xl">
          {t('story.curveTitle')}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 text-pretty md:text-base">
          {t('story.curveBody')}
        </p>

        <div className="mt-8 rounded-2xl border border-white/12 bg-white/[0.04] p-4 md:p-6">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={t('story.curveAria')}>
            {/* 阈值带：四档底色 */}
            {thresholds.map((th, i) => {
              const next = i + 1 < thresholds.length ? thresholds[i + 1].value : null;
              const top = next === null ? PAD.top : Math.max(PAD.top, y(next));
              const bottom = y(th.value);
              if (bottom <= top) return null;
              return (
                <rect
                  key={th.level}
                  x={PAD.left}
                  y={top}
                  width={W - PAD.left - PAD.right}
                  height={bottom - top}
                  fill={LEVEL_COLORS[th.level]}
                  opacity={0.08}
                />
              );
            })}

            {/* 坐标轴 */}
            <line x1={PAD.left} y1={H - PAD.bottom} x2={W - PAD.right} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.25)" />
            <line x1={PAD.left} y1={PAD.top} x2={PAD.left} y2={H - PAD.bottom} stroke="rgba(255,255,255,0.25)" />
            {tempTicks.map((temp) => (
              <g key={temp}>
                <line x1={x(temp)} y1={H - PAD.bottom} x2={x(temp)} y2={H - PAD.bottom + 5} stroke="rgba(255,255,255,0.3)" />
                <text x={x(temp)} y={H - PAD.bottom + 20} textAnchor="middle" fontSize={11} fill="rgba(255,255,255,0.55)">
                  {temp}℃
                </text>
              </g>
            ))}

            {/* 阈值横线 + 标签 */}
            {thresholds.map((th) => (
              <g key={th.value}>
                <line
                  x1={PAD.left}
                  y1={y(th.value)}
                  x2={W - PAD.right}
                  y2={y(th.value)}
                  stroke={LEVEL_COLORS[th.level]}
                  strokeWidth={1.4}
                  strokeDasharray="5 4"
                  opacity={0.85}
                />
                <text
                  x={W - PAD.right - 4}
                  y={y(th.value) - 6}
                  textAnchor="end"
                  fontSize={11}
                  fontWeight={600}
                  fill={LEVEL_COLORS[th.level]}
                >
                  {LEVEL_LABELS[th.level]} {th.value}
                </text>
              </g>
            ))}

            {/* 曲线：滚动驱动的描边绘制 */}
            <motion.path
              d={linePath}
              fill="none"
              stroke="#e8c98a"
              strokeWidth={3}
              strokeLinecap="round"
              style={reduceMotion ? undefined : { pathLength }}
            />

            {/* 采样条件说明 */}
            <text x={PAD.left} y={PAD.top - 12} fontSize={11} fill="rgba(255,255,255,0.55)">
              {t('story.curveCaption')}
            </text>
          </svg>

          <dl className="mt-4 grid grid-cols-2 gap-3 text-xs md:grid-cols-4">
            {curve.crossings.map((c) => (
              <div key={c.level} className="rounded-lg border border-white/10 bg-black/30 px-3 py-2">
                <dt className="flex items-center gap-1.5 text-white/60">
                  <span className="h-2 w-2 rounded-full" style={{ backgroundColor: LEVEL_COLORS[c.level] }} aria-hidden="true" />
                  {LEVEL_LABELS[c.level]}
                </dt>
                <dd className="mt-1 font-semibold tabular-nums" style={{ color: LEVEL_COLORS[c.level] }}>
                  {c.from === null ? '—' : c.from === c.to ? `${c.from}℃` : `${c.from}–${c.to}℃`}
                </dd>
              </div>
            ))}
          </dl>
        </div>

        <p className="mt-4 text-xs leading-relaxed text-white/50">
          {t('story.curveFootnote')}
        </p>
      </div>
    </section>
  );
};

export default StoryScreenThiCurve;
