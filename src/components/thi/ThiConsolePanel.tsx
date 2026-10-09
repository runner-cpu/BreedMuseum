import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowRight,
  CalendarClock,
  Droplets,
  Info,
  Mountain,
  Thermometer,
  Wand2,
} from 'lucide-react';
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
import { GradeBar, LEVEL_RANGE_TEXT, NumberField, ThiGauge, type Tone } from '@/components/thi/primitives';

/** 与畜种对应的馆藏品种快捷入口（点击进入品种详情） */
export const SPECIES_BREED_HINTS: Record<PastureSpecies, string[]> = {
  yak: ['qinghai-plateau-yak', 'huanhu-yak', 'yushu-yak', 'maihua-yak'],
  sheep: ['qinghai-black-sheep', 'oula-sheep', 'zeku-sheep', 'xizang-sheep'],
  goat: ['chaidamu-goat', 'chaidamurong-goat', 'hexi-cashmere-goat'],
  chicken: ['haidong-chicken', 'tibetan-chicken'],
  pig: ['huzhu-pig', 'tibetan-pig'],
  horse: ['datong-horse', 'yushu-horse', 'menyuan-horse'],
  camel: ['chaidamu-bactrian-camel', 'qinghai-camel'],
};

/** 场景预设：一键填充真实高原场景，让工具“开箱即懂” */
export const SCENARIO_PRESETS: Array<{ key: string; labelKey: string; input: ThiInput }> = [
  { key: 'yushu', labelKey: 'pasture.presetYushu', input: { species: 'yak', temperature: 32, humidity: 45, altitude: 4200, age: 'young' } },
  { key: 'huanhu', labelKey: 'pasture.presetHuanhu', input: { species: 'sheep', temperature: 28, humidity: 55, altitude: 3200, age: 'adult' } },
  { key: 'chaidamu', labelKey: 'pasture.presetChaidamu', input: { species: 'camel', temperature: 38, humidity: 20, altitude: 2800, age: 'adult' } },
];

export const DEFAULT_THI_INPUT: ThiInput = { species: 'yak', temperature: 18, humidity: 55, altitude: 3200, age: 'adult' };

export interface ThiConsolePanelProps {
  /** full：完整决策台（/pasture）；compact：叙事屏内嵌精简版 */
  variant?: 'full' | 'compact';
  /** 深色叙事背景配色 */
  tone?: Tone;
  initialInput?: ThiInput;
  className?: string;
}

/**
 * THI 决策台面板：输入（畜种/温湿度/海拔/畜龄）→ 实时计算 → 大数字 + 分级色带 + 三条优先管理动作。
 * 同时服务 /pasture 完整页与首页滚动叙事屏，避免两处实现漂移。
 */
const ThiConsolePanel: React.FC<ThiConsolePanelProps> = ({
  variant = 'full',
  tone = 'default',
  initialInput,
  className,
}) => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [input, setInput] = useState<ThiInput>(initialInput ?? DEFAULT_THI_INPUT);

  const result = useMemo(() => evaluateThi(input), [input]);
  const advice = LEVEL_ADVICE[result.level];
  const dark = tone === 'dark';
  const compact = variant === 'compact';

  const update = <K extends keyof ThiInput>(key: K, value: ThiInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  const hints = compact
    ? []
    : SPECIES_BREED_HINTS[input.species]
        .map((id) => breeds.find((b) => b.id === id))
        .filter((b): b is NonNullable<typeof b> => Boolean(b));

  const surface = dark
    ? 'rounded-xl border border-white/15 bg-white/[0.04]'
    : 'bg-card border border-border rounded-xl';
  const heading = dark ? 'text-white' : 'text-foreground';
  const subtext = dark ? 'text-white/60' : 'text-muted-foreground';
  const chipIdle = dark
    ? 'border-white/20 bg-white/5 text-white/85 hover:bg-white/10'
    : 'border-border bg-background text-foreground hover:bg-secondary';
  const chipActive = dark
    ? 'border-[#d4a853] bg-[#d4a853] text-[#1a3a2a]'
    : 'border-primary bg-primary text-primary-foreground';

  const speciesButtons = (
    <div className={compact ? 'grid grid-cols-3 sm:grid-cols-4 gap-2' : 'grid grid-cols-2 sm:grid-cols-3 gap-2'}>
      {(Object.keys(SPECIES_CONFIG) as PastureSpecies[]).map((id) => (
        <button
          key={id}
          type="button"
          aria-pressed={input.species === id}
          onClick={() => update('species', id)}
          className={'min-h-11 rounded-lg border px-3 text-sm transition-colors ' + (input.species === id ? chipActive : chipIdle)}
        >
          {SPECIES_LABELS[id]}
        </button>
      ))}
    </div>
  );

  const ageButtons = (
    <div className="flex gap-2">
      {(Object.keys(AGE_LABELS) as Array<ThiInput['age']>).map((age) => (
        <button
          key={age}
          type="button"
          aria-pressed={input.age === age}
          onClick={() => update('age', age)}
          className={'min-h-11 flex-1 rounded-lg border px-3 text-sm transition-colors ' + (input.age === age ? chipActive : chipIdle)}
        >
          {AGE_LABELS[age]}
        </button>
      ))}
    </div>
  );

  const presetButtons = (
    <div className="flex flex-wrap gap-2" aria-label={t('pasture.presetTitle')}>
      <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${subtext}`}>
        <Wand2 className="w-3.5 h-3.5" aria-hidden="true" />
        {t('pasture.presetTitle')}
      </span>
      {SCENARIO_PRESETS.map((preset) => (
        <button
          key={preset.key}
          type="button"
          onClick={() => setInput(preset.input)}
          className={'min-h-9 rounded-full border px-3 text-xs transition-colors ' + chipIdle}
        >
          {t(preset.labelKey)}
        </button>
      ))}
    </div>
  );

  const resultCard = (
    <div
      className={dark ? 'rounded-xl border p-4 md:p-5' : 'rounded-xl border p-4 md:p-6'}
      style={{ borderColor: LEVEL_COLORS[result.level], backgroundColor: `${LEVEL_COLORS[result.level]}14` }}
    >
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <p className={`text-xs ${subtext}`}>{t('pasture.effectiveThi')}</p>
          <p
            className="font-serif text-5xl md:text-6xl font-bold leading-none tabular-nums"
            style={{ color: LEVEL_COLORS[result.level] }}
          >
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
          <span className={`text-xs ${subtext}`}>
            {t('pasture.rawThi')} {result.base.toFixed(1)} · {t('pasture.altitudeAdj')} −{result.altitudeAdjustment.toFixed(1)} · {t('pasture.ageAdj')} +{result.ageAdjustment.toFixed(1)}
          </span>
        </div>
        {!compact && (
          <div className="ml-auto self-start">
            <details className="group text-xs">
              <summary className={'inline-flex min-h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border px-3 ' + (dark ? 'border-white/20 bg-white/5 text-white/70 hover:text-white' : 'border-border bg-background text-muted-foreground hover:text-foreground')}>
                <Info className="w-3.5 h-3.5" />
                {t('pasture.formulaToggle')}
              </summary>
              <p className={'mt-2 max-w-xs rounded-lg border p-3 leading-relaxed md:max-w-sm ' + (dark ? 'border-white/15 bg-black/30 text-white/70' : 'border-border bg-background text-muted-foreground')}>
                {t('pasture.formula')}
              </p>
            </details>
          </div>
        )}
      </div>
      <div className="mt-5">
        <GradeBar value={result.effective} level={result.level} species={result.species} tone={tone} />
      </div>
      {!compact && (
        <ul className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2" aria-label={t('pasture.legendLabel')}>
          {(['comfort', 'alert', 'danger', 'extreme'] as StressLevel[]).map((lv) => (
            <li
              key={lv}
              aria-current={lv === result.level ? 'true' : undefined}
              className={
                'flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs ' +
                (lv === result.level ? 'border-current font-semibold text-foreground' : dark ? 'border-white/15 text-white/60' : 'border-border text-muted-foreground')
              }
              style={lv === result.level ? { borderColor: LEVEL_COLORS[lv], color: LEVEL_COLORS[lv] } : undefined}
            >
              <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: LEVEL_COLORS[lv] }} aria-hidden="true" />
              {LEVEL_LABELS[lv]}
              <span className="ml-auto tabular-nums">{LEVEL_RANGE_TEXT[lv](result.species)}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  const adviceCard = (
    <div className={surface + ' p-4 md:p-6'} aria-live="polite">
      <h2 className={`text-base font-semibold flex items-center gap-2 ${heading}`}>
        <AlertTriangle className="w-4 h-4" style={{ color: LEVEL_COLORS[result.level] }} />
        {t('pasture.adviceTitle').replace('{level}', LEVEL_LABELS[result.level])}
      </h2>
      <p className={`mt-3 text-xs font-medium ${subtext}`}>{t('pasture.adviceTop3')}</p>
      <ol className="mt-2 space-y-2">
        {advice.slice(0, 3).map((item, index) => (
          <li
            key={item}
            className={
              'flex items-start gap-2.5 rounded-lg border px-3 py-2.5 text-sm ' +
              (dark ? 'border-white/15 bg-black/25 text-white/90' : 'border-border bg-background text-foreground/90')
            }
          >
            <span
              className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ backgroundColor: LEVEL_COLORS[result.level] }}
            >
              {index + 1}
            </span>
            {item}
          </li>
        ))}
      </ol>
      {!compact && advice.length > 3 && (
        <div className={`mt-4 border-t pt-3 ${dark ? 'border-white/15' : 'border-border'}`}>
          <p className={`text-xs font-medium ${subtext}`}>{t('pasture.adviceMore')}</p>
          <ul className={`mt-2 space-y-1.5 text-sm list-disc pl-5 ${dark ? 'text-white/80' : 'text-foreground/80'}`}>
            {advice.slice(3).map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      )}
      {!compact && result.notes.length > 0 && (
        <ul className={`mt-4 space-y-2 border-t pt-3 text-xs ${dark ? 'border-white/15 text-white/60' : 'border-border text-muted-foreground'}`}>
          {result.notes.map((note) => (
            <li key={note} className="flex items-start gap-1.5">
              <Info className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              {note}
            </li>
          ))}
        </ul>
      )}
    </div>
  );

  if (compact) {
    return (
      <div className={className}>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="space-y-4">
            <div className={surface + ' p-4'}>
              <span className={`text-sm font-medium ${heading}`}>{t('pasture.species')}</span>
              <div className="mt-3">{speciesButtons}</div>
            </div>
            <NumberField label={t('pasture.temperature')} icon={<Thermometer className="w-4 h-4 text-[#d4a853]" />} value={input.temperature} min={-30} max={45} unit="℃" onChange={(v) => update('temperature', v)} tone={tone} />
            <NumberField label={t('pasture.humidity')} icon={<Droplets className="w-4 h-4 text-[#d4a853]" />} value={input.humidity} min={0} max={100} unit="%" onChange={(v) => update('humidity', v)} tone={tone} />
            <NumberField label={t('pasture.altitude')} icon={<Mountain className="w-4 h-4 text-[#d4a853]" />} value={input.altitude} min={0} max={5500} step={50} unit="m" onChange={(v) => update('altitude', v)} tone={tone} />
            <div className={surface + ' p-4'}>
              <span className={`flex items-center gap-2 text-sm font-medium ${heading}`}>
                <CalendarClock className="w-4 h-4 text-[#d4a853]" />
                {t('pasture.age')}
              </span>
              <div className="mt-3">{ageButtons}</div>
            </div>
            {presetButtons}
          </div>
          <div className="space-y-4">
            {resultCard}
            {adviceCard}
            <button
              type="button"
              onClick={() => navigate('/pasture')}
              className="min-h-11 inline-flex items-center gap-1.5 rounded-lg bg-[#d4a853] px-4 text-sm font-medium text-[#1a3a2a] hover:bg-[#d4a853]/90 transition-colors"
            >
              {t('pasture.openFull')}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* 输入面板 */}
        <section aria-label={t('pasture.inputPanel')} className="space-y-4">
          <div className={surface + ' p-4'}>
            <span className={`text-sm font-medium ${heading}`}>{t('pasture.species')}</span>
            <div className="mt-3">{speciesButtons}</div>
          </div>
          {presetButtons}
          <NumberField label={t('pasture.temperature')} icon={<Thermometer className="w-4 h-4 text-primary" />} value={input.temperature} min={-30} max={45} unit="℃" onChange={(v) => update('temperature', v)} tone={tone} />
          <NumberField label={t('pasture.humidity')} icon={<Droplets className="w-4 h-4 text-primary" />} value={input.humidity} min={0} max={100} unit="%" onChange={(v) => update('humidity', v)} tone={tone} />
          <NumberField label={t('pasture.altitude')} icon={<Mountain className="w-4 h-4 text-primary" />} value={input.altitude} min={0} max={5500} step={50} unit="m" onChange={(v) => update('altitude', v)} tone={tone} />
          <div className={surface + ' p-4'}>
            <span className={`flex items-center gap-2 text-sm font-medium ${heading}`}>
              <CalendarClock className="w-4 h-4 text-primary" />
              {t('pasture.age')}
            </span>
            <div className="mt-3">{ageButtons}</div>
          </div>
        </section>

        {/* 结果面板 */}
        <section aria-label={t('pasture.resultPanel')} className="space-y-4">
          {resultCard}
          <div className={surface + ' p-4 md:p-6'}>
            <ThiGauge value={result.effective} level={result.level} species={result.species} tone={tone} />
          </div>
          <div className={surface + ' p-4 md:p-5'}>
            <h2 className={`text-sm font-semibold mb-3 ${heading}`}>{t('pasture.pipelineTitle')}</h2>
            <ol className="grid grid-cols-2 md:grid-cols-5 gap-2 text-xs" aria-label={t('pasture.pipelineTitle')}>
              {[t('pasture.pipeStep1'), t('pasture.pipeStep2'), t('pasture.pipeStep3'), t('pasture.pipeStep4'), t('pasture.pipeStep5')].map((step, index) => (
                <li key={step} className={'relative rounded-lg border px-3 py-2.5 leading-relaxed ' + (dark ? 'border-white/15 bg-black/25 text-white/85' : 'border-border bg-background')}>
                  <span
                    className="inline-flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ backgroundColor: index === 3 ? LEVEL_COLORS[result.level] : '#6b8fb5' }}
                  >
                    {index + 1}
                  </span>
                  <span className={'ml-1.5 ' + (dark ? 'text-white/85' : 'text-foreground/90')}>{step}</span>
                </li>
              ))}
            </ol>
          </div>
          {adviceCard}
          {hints.length > 0 && (
            <div className={surface + ' p-4 md:p-6'}>
              <h2 className={`text-base font-semibold ${heading}`}>{t('pasture.relatedBreeds')}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {hints.map((breed) => (
                  <button
                    key={breed.id}
                    type="button"
                    onClick={() => navigate(`/map?breed_id=${breed.id}`)}
                    className={'min-h-11 rounded-lg border px-3 text-sm transition-colors ' + chipIdle}
                  >
                    {breed.name}
                    <span className={`ml-1.5 text-xs ${subtext}`}>{breed.province}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <div className={'rounded-xl border border-dashed p-4 flex items-center justify-between gap-3 flex-wrap ' + (dark ? 'border-white/20' : 'border-border')}>
            <p className={`text-sm ${subtext}`}>{t('pasture.toRecommend')}</p>
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

export default ThiConsolePanel;
