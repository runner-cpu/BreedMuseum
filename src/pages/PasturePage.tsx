import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Thermometer, Droplets, Mountain, CalendarClock, AlertTriangle, Info, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import {
  AGE_LABELS,
  LEVEL_ADVICE,
  LEVEL_COLORS,
  LEVEL_LABELS,
  SPECIES_CONFIG,
  SPECIES_LABELS,
  evaluateThi,
  type PastureSpecies,
  type StressLevel,
  type ThiInput,
} from '@/data/pastureThi';
import { breeds } from '@/data/breeds';
import { useSettings } from '@/contexts/AppSettings';

/** 与畜种对应的馆藏品种快捷入口（点击进入品种详情） */
const SPECIES_BREED_HINTS: Record<PastureSpecies, string[]> = {
  yak: ['qinghai-plateau-yak', 'huanhu-yak', 'yushu-yak', 'maihua-yak'],
  sheep: ['qinghai-black-sheep', 'oula-sheep', 'zeku-sheep', 'xizang-sheep'],
  goat: ['chaidamu-goat', 'chaidamurong-goat', 'hexi-cashmere-goat'],
  chicken: ['haidong-chicken', 'tibetan-chicken'],
  pig: ['huzhu-pig', 'tibetan-pig'],
  horse: ['datong-horse', 'yushu-horse', 'menyuan-horse'],
  camel: ['chaidamu-bactrian-camel', 'qinghai-camel'],
};

const GAUGE_MIN = 5;
const GAUGE_MAX = 35;

/** 四级图例的区间文案（按当前畜种阈值实时生成） */
const LEVEL_RANGE_TEXT: Record<StressLevel, (s: typeof SPECIES_CONFIG[PastureSpecies]) => string> = {
  comfort: (s) => `< ${s.comfortMax}`,
  alert: (s) => `${s.comfortMax}–${s.alertMax}`,
  danger: (s) => `${s.alertMax}–${s.extremeFrom}`,
  extreme: (s) => `≥ ${s.extremeFrom}`,
};

/** 半圆仪表盘：分区随畜种阈值动态划分 + 指针 + 有效 THI 数值 */
const ThiGauge: React.FC<{ value: number; level: StressLevel; species: typeof SPECIES_CONFIG[PastureSpecies] }> = ({ value, level, species }) => {
  const clamped = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value));
  const ratio = (clamped - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN);
  const angle = -180 + ratio * 180;
  const cx = 160;
  const cy = 150;
  const r = 118;

  const polar = (deg: number, radius: number) => {
    const rad = (deg * Math.PI) / 180;
    return { x: cx + radius * Math.cos(rad), y: cy + radius * Math.sin(rad) };
  };

  const arc = (from: number, to: number) => {
    const p1 = polar(from, r);
    const p2 = polar(to, r);
    const large = to - from > 180 ? 1 : 0;
    return `M ${p1.x} ${p1.y} A ${r} ${r} 0 ${large} 1 ${p2.x} ${p2.y}`;
  };

  // 分区边界直接采用当前畜种阈值：舒适 / 警戒 / 危险 / 极端
  const zones: Array<{ from: number; to: number; color: string }> = [
    { from: GAUGE_MIN, to: species.comfortMax, color: LEVEL_COLORS.comfort },
    { from: species.comfortMax, to: species.alertMax, color: LEVEL_COLORS.alert },
    { from: species.alertMax, to: species.extremeFrom, color: LEVEL_COLORS.danger },
    { from: species.extremeFrom, to: GAUGE_MAX, color: LEVEL_COLORS.extreme },
  ];
  const toDeg = (v: number) => -180 + ((v - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)) * 180;
  const ticks = [GAUGE_MIN, species.comfortMax, species.alertMax, species.extremeFrom, GAUGE_MAX];

  return (
    <figure className="flex flex-col items-center">
      <svg viewBox="0 0 320 178" className="w-full max-w-[320px]" role="img" aria-label={`有效 THI ${value}，应激等级${LEVEL_LABELS[level]}`}>
        {zones.map((zone) => (
          <path
            key={zone.from}
            d={arc(toDeg(zone.from), toDeg(zone.to))}
            stroke={zone.color}
            strokeWidth={16}
            fill="none"
            strokeLinecap="butt"
            opacity={0.9}
          />
        ))}
        {ticks.map((tick) => {
          const deg = toDeg(tick);
          const outer = polar(deg, r + 16);
          const inner = polar(deg, r + 24);
          const label = polar(deg, r + 40);
          return (
            <g key={tick}>
              <line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke="hsl(var(--muted-foreground))" strokeWidth={1.5} />
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize={10} fill="hsl(var(--muted-foreground))">{tick}</text>
            </g>
          );
        })}
        {/* 指针 */}
        <line
          x1={cx}
          y1={cy}
          x2={polar(angle, r - 14).x}
          y2={polar(angle, r - 14).y}
          stroke={LEVEL_COLORS[level]}
          strokeWidth={5}
          strokeLinecap="round"
        />
        <circle cx={cx} cy={cy} r={9} fill={LEVEL_COLORS[level]} />
        <text x={cx} y={cy - 34} textAnchor="middle" fontSize={34} fontWeight={700} fill="hsl(var(--foreground))">{value.toFixed(1)}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={12} fill="hsl(var(--muted-foreground))">有效 THI</text>
      </svg>
      <figcaption
        className="mt-1 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white"
        style={{ backgroundColor: LEVEL_COLORS[level] }}
      >
        应激等级：{LEVEL_LABELS[level]}
      </figcaption>
    </figure>
  );
};

const NumberField: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
}> = ({ label, icon, value, min, max, step = 1, unit, onChange }) => (
  <div className="bg-card border border-border rounded-xl p-4">
    <label className="flex items-center gap-2 text-sm font-medium text-foreground">
      {icon}
      {label}
      <span className="ml-auto tabular-nums text-primary font-semibold">{value} {unit}</span>
    </label>
    <input
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      aria-label={label}
      onChange={(e) => onChange(Number(e.target.value))}
      className="mt-3 w-full accent-[hsl(var(--primary))]"
    />
    <div className="mt-2 flex items-center gap-2">
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={`${label}（数值输入）`}
        onChange={(e) => {
          const next = Number(e.target.value);
          if (Number.isFinite(next)) onChange(Math.min(max, Math.max(min, next)));
        }}
        className="min-h-11 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground"
      />
      <span className="text-xs text-muted-foreground">{unit}</span>
    </div>
  </div>
);

const PasturePage: React.FC = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [input, setInput] = useState<ThiInput>({ species: 'yak', temperature: 18, humidity: 55, altitude: 3200, age: 'adult' });

  const result = useMemo(() => evaluateThi(input), [input]);
  const advice = LEVEL_ADVICE[result.level];
  const hints = SPECIES_BREED_HINTS[input.species]
    .map((id) => breeds.find((b) => b.id === id))
    .filter((b): b is NonNullable<typeof b> => Boolean(b));

  const update = <K extends keyof ThiInput>(key: K, value: ThiInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-serif font-bold text-foreground border-l-4 border-primary pl-3"
      >
        {t('pasture.title')}
      </motion.h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t('pasture.intro')}</p>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* 输入面板 */}
        <section aria-label={t('pasture.inputPanel')} className="space-y-4">
          <div className="bg-card border border-border rounded-xl p-4">
            <span className="text-sm font-medium text-foreground">{t('pasture.species')}</span>
            <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
              {(Object.keys(SPECIES_CONFIG) as PastureSpecies[]).map((id) => (
                <button
                  key={id}
                  type="button"
                  aria-pressed={input.species === id}
                  onClick={() => update('species', id)}
                  className={
                    'min-h-11 rounded-lg border px-3 text-sm transition-colors ' +
                    (input.species === id
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-secondary')
                  }
                >
                  {SPECIES_LABELS[id]}
                </button>
              ))}
            </div>
          </div>

          <NumberField label={t('pasture.temperature')} icon={<Thermometer className="w-4 h-4 text-primary" />} value={input.temperature} min={-30} max={45} unit="℃" onChange={(v) => update('temperature', v)} />
          <NumberField label={t('pasture.humidity')} icon={<Droplets className="w-4 h-4 text-primary" />} value={input.humidity} min={0} max={100} unit="%" onChange={(v) => update('humidity', v)} />
          <NumberField label={t('pasture.altitude')} icon={<Mountain className="w-4 h-4 text-primary" />} value={input.altitude} min={0} max={5500} step={50} unit="m" onChange={(v) => update('altitude', v)} />

          <div className="bg-card border border-border rounded-xl p-4">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
              <CalendarClock className="w-4 h-4 text-primary" />
              {t('pasture.age')}
            </span>
            <div className="mt-3 flex gap-2">
              {(Object.keys(AGE_LABELS) as Array<ThiInput['age']>).map((age) => (
                <button
                  key={age}
                  type="button"
                  aria-pressed={input.age === age}
                  onClick={() => update('age', age)}
                  className={
                    'min-h-11 flex-1 rounded-lg border px-3 text-sm transition-colors ' +
                    (input.age === age
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border bg-background text-foreground hover:bg-secondary')
                  }
                >
                  {AGE_LABELS[age]}
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 结果面板 */}
        <section aria-label={t('pasture.resultPanel')} className="space-y-4">
          {/* 大数字 + 分级徽章 + 四级图例 + 公式悬浮说明 */}
          <div
            className="rounded-xl border p-4 md:p-6"
            style={{ borderColor: LEVEL_COLORS[result.level], backgroundColor: `${LEVEL_COLORS[result.level]}14` }}
          >
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
              <div>
                <p className="text-xs text-muted-foreground">{t('pasture.effectiveThi')}</p>
                <p className="font-serif text-5xl md:text-6xl font-bold leading-none tabular-nums" style={{ color: LEVEL_COLORS[result.level] }}>
                  {result.effective.toFixed(1)}
                </p>
              </div>
              <div className="flex flex-col gap-1.5">
                <span
                  className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white"
                  style={{ backgroundColor: LEVEL_COLORS[result.level] }}
                >
                  {LEVEL_LABELS[result.level]}
                </span>
                <span className="text-xs text-muted-foreground">
                  {t('pasture.rawThi')} {result.base.toFixed(1)} · {t('pasture.altitudeAdj')} −{result.altitudeAdjustment.toFixed(1)} · {t('pasture.ageAdj')} +{result.ageAdjustment.toFixed(1)}
                </span>
              </div>
              <div className="ml-auto self-start">
                <details className="group text-xs">
                  <summary className="inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-border bg-background px-3 text-muted-foreground hover:text-foreground">
                    <Info className="w-3.5 h-3.5" />
                    {t('pasture.formulaToggle')}
                  </summary>
                  <p className="mt-2 max-w-xs rounded-lg border border-border bg-background p-3 leading-relaxed text-muted-foreground md:max-w-sm">
                    {t('pasture.formula')}
                  </p>
                </details>
              </div>
            </div>
            {/* 四级图例：当前档位高亮 */}
            <ul className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-2" aria-label={t('pasture.legendLabel')}>
              {(['comfort', 'alert', 'danger', 'extreme'] as StressLevel[]).map((lv) => (
                <li
                  key={lv}
                  aria-current={lv === result.level ? 'true' : undefined}
                  className={
                    'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ' +
                    (lv === result.level ? 'border-current font-semibold text-foreground' : 'border-border text-muted-foreground')
                  }
                  style={lv === result.level ? { borderColor: LEVEL_COLORS[lv], color: LEVEL_COLORS[lv] } : undefined}
                >
                  <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: LEVEL_COLORS[lv] }} aria-hidden="true" />
                  {LEVEL_LABELS[lv]}
                  <span className="ml-auto tabular-nums">{LEVEL_RANGE_TEXT[lv](result.species)}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 md:p-6">
            <ThiGauge value={result.effective} level={result.level} species={result.species} />
          </div>

          {/* 决策流程图：输入 → 公式 → 畜种修正 → 等级判定 → 建议 */}
          <div className="bg-card border border-border rounded-xl p-4 md:p-5">
            <h2 className="text-sm font-semibold text-foreground mb-3">{t('pasture.pipelineTitle')}</h2>
            <ol className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs" aria-label={t('pasture.pipelineTitle')}>
              {[
                t('pasture.pipeStep1'),
                t('pasture.pipeStep2'),
                t('pasture.pipeStep3'),
                t('pasture.pipeStep4'),
                t('pasture.pipeStep5'),
              ].map((step, index) => (
                <li key={step} className="relative rounded-lg border border-border bg-background px-3 py-2.5 leading-relaxed">
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: index === 3 ? LEVEL_COLORS[result.level] : '#6b8fb5' }}
                  >
                    {index + 1}
                  </span>
                  <span className="ml-1.5 text-foreground/90">{step}</span>
                </li>
              ))}
            </ol>
          </div>

          <div className="bg-card border border-border rounded-xl p-4 md:p-6" aria-live="polite">
            <h2 className="text-base font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" style={{ color: LEVEL_COLORS[result.level] }} />
              {t('pasture.adviceTitle').replace('{level}', LEVEL_LABELS[result.level])}
            </h2>
            <ul className="mt-3 space-y-2 text-sm text-foreground/90 list-disc pl-5">
              {advice.map((item) => <li key={item}>{item}</li>)}
            </ul>
            {result.notes.length > 0 && (
              <ul className="mt-4 space-y-2 border-t border-border pt-3 text-xs text-muted-foreground">
                {result.notes.map((note) => (
                  <li key={note} className="flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
                    {note}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {hints.length > 0 && (
            <div className="bg-card border border-border rounded-xl p-4 md:p-6">
              <h2 className="text-base font-semibold text-foreground">{t('pasture.relatedBreeds')}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {hints.map((breed) => (
                  <button
                    key={breed.id}
                    type="button"
                    onClick={() => navigate(`/map?breed_id=${breed.id}`)}
                    className="min-h-11 rounded-lg border border-border bg-background px-3 text-sm hover:bg-secondary transition-colors"
                  >
                    {breed.name}
                    <span className="ml-1.5 text-xs text-muted-foreground">{breed.province}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="rounded-xl border border-dashed border-border p-4 flex items-center justify-between gap-3 flex-wrap">
            <p className="text-sm text-muted-foreground">{t('pasture.toRecommend')}</p>
            <button
              type="button"
              onClick={() => navigate('/recommend')}
              className="min-h-11 inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              {t('pasture.openRecommend')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default PasturePage;
