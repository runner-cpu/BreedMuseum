import React from 'react';
import { LEVEL_COLORS, LEVEL_LABELS, SPECIES_CONFIG, type PastureSpecies, type StressLevel } from '@/data/pastureThi';
import { useSettings } from '@/contexts/AppSettings';

/** 仪表盘量程：与 THI 模型的有效区间一致（5–35） */
export const GAUGE_MIN = 5;
export const GAUGE_MAX = 35;

export type SpeciesThresholds = (typeof SPECIES_CONFIG)[PastureSpecies];

/** 深色叙事背景上的组件配色（首页滚动叙事专用） */
export type Tone = 'default' | 'dark';

/** 四级图例的区间文案（按当前畜种阈值实时生成） */
export const LEVEL_RANGE_TEXT: Record<StressLevel, (s: SpeciesThresholds) => string> = {
  comfort: (s) => `< ${s.comfortMax}`,
  alert: (s) => `${s.comfortMax}–${s.alertMax}`,
  danger: (s) => `${s.alertMax}–${s.extremeFrom}`,
  extreme: (s) => `≥ ${s.extremeFrom}`,
};

const POINTER_TONE: Record<Tone, string> = {
  default: 'bg-foreground ring-2 ring-background',
  dark: 'bg-white ring-2 ring-black/40',
};

const TICK_TEXT_TONE: Record<Tone, string> = {
  default: 'text-muted-foreground',
  dark: 'text-white/60',
};

/**
 * 绿→黄→橙→红分级色带：按当前畜种阈值划分四段宽度，
 * 指针指示有效 THI 所在位置，一眼看出处于哪一档。
 */
export const GradeBar: React.FC<{
  value: number;
  level: StressLevel;
  species: SpeciesThresholds;
  tone?: Tone;
}> = ({ value, level, species, tone = 'default' }) => {
  const { t } = useSettings();
  const segments: Array<{ lv: StressLevel; from: number; to: number }> = [
    { lv: 'comfort', from: GAUGE_MIN, to: species.comfortMax },
    { lv: 'alert', from: species.comfortMax, to: species.alertMax },
    { lv: 'danger', from: species.alertMax, to: species.extremeFrom },
    { lv: 'extreme', from: species.extremeFrom, to: GAUGE_MAX },
  ];
  const span = GAUGE_MAX - GAUGE_MIN;
  const clamped = Math.min(GAUGE_MAX, Math.max(GAUGE_MIN, value));
  const pointer = ((clamped - GAUGE_MIN) / span) * 100;

  return (
    <div aria-label={t('pasture.gradeBarLabel')} role="img">
      <div className="relative">
        <div className="flex h-4 w-full overflow-hidden rounded-full">
          {segments.map((seg) => (
            <div
              key={seg.lv}
              className="h-full"
              style={{
                width: `${((seg.to - seg.from) / span) * 100}%`,
                backgroundColor: LEVEL_COLORS[seg.lv],
                opacity: seg.lv === level ? 1 : 0.35,
              }}
            />
          ))}
        </div>
        <span
          aria-hidden="true"
          className={`absolute -top-1 h-6 w-1 -translate-x-1/2 rounded-full ${POINTER_TONE[tone]}`}
          style={{ left: `${pointer}%` }}
        />
      </div>
      <div className={`mt-1.5 flex justify-between text-[10px] tabular-nums ${TICK_TEXT_TONE[tone]}`}>
        <span>{GAUGE_MIN}</span>
        <span>{species.comfortMax}</span>
        <span>{species.alertMax}</span>
        <span>{species.extremeFrom}</span>
        <span>{GAUGE_MAX}</span>
      </div>
    </div>
  );
};

/** 半圆仪表盘：分区随畜种阈值动态划分 + 指针 + 有效 THI 数值 */
export const ThiGauge: React.FC<{
  value: number;
  level: StressLevel;
  species: SpeciesThresholds;
  tone?: Tone;
}> = ({ value, level, species, tone = 'default' }) => {
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
  const tickColor = tone === 'dark' ? 'rgba(255,255,255,0.55)' : 'hsl(var(--muted-foreground))';
  const valueColor = tone === 'dark' ? '#ffffff' : 'hsl(var(--foreground))';

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
              <line x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} stroke={tickColor} strokeWidth={1.5} />
              <text x={label.x} y={label.y + 4} textAnchor="middle" fontSize={10} fill={tickColor}>{tick}</text>
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
        <text x={cx} y={cy - 34} textAnchor="middle" fontSize={34} fontWeight={700} fill={valueColor}>{value.toFixed(1)}</text>
        <text x={cx} y={cy - 12} textAnchor="middle" fontSize={12} fill={tickColor}>有效 THI</text>
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

/** 带滑杆与数值输入的环境参数字段（明暗两种配色） */
export const NumberField: React.FC<{
  label: string;
  icon: React.ReactNode;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (value: number) => void;
  tone?: Tone;
}> = ({ label, icon, value, min, max, step = 1, unit, onChange, tone = 'default' }) => {
  const dark = tone === 'dark';
  return (
    <div className={dark ? 'rounded-xl border border-white/15 bg-white/[0.04] p-4' : 'bg-card border border-border rounded-xl p-4'}>
      <label className={`flex items-center gap-2 text-sm font-medium ${dark ? 'text-white/85' : 'text-foreground'}`}>
        {icon}
        {label}
        <span className={`ml-auto tabular-nums font-semibold ${dark ? 'text-[#e8c98a]' : 'text-primary'}`}>{value} {unit}</span>
      </label>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        aria-label={label}
        onChange={(e) => onChange(Number(e.target.value))}
        className={dark ? 'mt-3 w-full accent-[#d4a853]' : 'mt-3 w-full accent-[hsl(var(--primary))]'}
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
          className={
            dark
              ? 'min-h-11 w-28 rounded-lg border border-white/20 bg-white/5 px-3 text-sm text-white'
              : 'min-h-11 w-28 rounded-lg border border-border bg-background px-3 text-sm text-foreground'
          }
        />
        <span className={`text-xs ${dark ? 'text-white/55' : 'text-muted-foreground'}`}>{unit}</span>
      </div>
    </div>
  );
};
