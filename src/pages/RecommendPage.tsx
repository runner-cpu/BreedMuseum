import React, { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { Mountain, Target, Home, Sparkles, ArrowRight, Award } from 'lucide-react';
import {
  ALTITUDE_BANDS,
  MODE_LABELS,
  PURPOSE_LABELS,
  recommendBreeds,
  type AltitudeBand,
  type HusbandryMode,
  type Purpose,
  type RecommendInput,
} from '@/data/breedRecommend';
import { useSettings } from '@/contexts/AppSettings';

const PurposeIcon: Record<Purpose, string> = {
  meat: '🥩',
  milk: '🥛',
  wool: '🧶',
  labor: '🐎',
  egg: '🥚',
};

const RecommendPage: React.FC = () => {
  const { t } = useSettings();
  const navigate = useNavigate();
  const [input, setInput] = useState<RecommendInput>({ altitude: 'high', purpose: 'meat', mode: 'grazing' });
  const [submitted, setSubmitted] = useState<RecommendInput | null>(null);

  const results = useMemo(() => (submitted ? recommendBreeds(submitted) : []), [submitted]);

  const update = <K extends keyof RecommendInput>(key: K, value: RecommendInput[K]) =>
    setInput((prev) => ({ ...prev, [key]: value }));

  return (
    <div className="max-w-5xl mx-auto p-4 md:p-8">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-serif font-bold text-foreground border-l-4 border-primary pl-3"
      >
        {t('recommend.title')}
      </motion.h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t('recommend.intro')}</p>

      <section className="mt-6 bg-card border border-border rounded-xl p-4 md:p-6 space-y-5" aria-label={t('recommend.title')}>
        <div>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Mountain className="w-4 h-4 text-primary" />
            {t('recommend.altitude')}
          </span>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2">
            {(Object.keys(ALTITUDE_BANDS) as AltitudeBand[]).map((band) => (
              <button
                key={band}
                type="button"
                aria-pressed={input.altitude === band}
                onClick={() => update('altitude', band)}
                className={
                  'min-h-11 rounded-lg border px-3 text-sm transition-colors ' +
                  (input.altitude === band
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-secondary')
                }
              >
                {ALTITUDE_BANDS[band].label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Target className="w-4 h-4 text-primary" />
            {t('recommend.purpose')}
          </span>
          <div className="mt-3 grid grid-cols-2 md:grid-cols-5 gap-2">
            {(Object.keys(PURPOSE_LABELS) as Purpose[]).map((purpose) => (
              <button
                key={purpose}
                type="button"
                aria-pressed={input.purpose === purpose}
                onClick={() => update('purpose', purpose)}
                className={
                  'min-h-11 rounded-lg border px-3 text-sm transition-colors ' +
                  (input.purpose === purpose
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-secondary')
                }
              >
                <span aria-hidden="true" className="mr-1">{PurposeIcon[purpose]}</span>
                {PURPOSE_LABELS[purpose]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Home className="w-4 h-4 text-primary" />
            {t('recommend.mode')}
          </span>
          <div className="mt-3 flex gap-2">
            {(Object.keys(MODE_LABELS) as HusbandryMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={input.mode === mode}
                onClick={() => update('mode', mode)}
                className={
                  'min-h-11 flex-1 rounded-lg border px-3 text-sm transition-colors ' +
                  (input.mode === mode
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border bg-background text-foreground hover:bg-secondary')
                }
              >
                {MODE_LABELS[mode]}
              </button>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => setSubmitted({ ...input })}
          className="min-h-11 inline-flex items-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
        >
          <Sparkles className="w-4 h-4" />
          {t('recommend.run')}
        </button>
      </section>

      {submitted && (
        <section className="mt-6" aria-label={t('recommend.results')} aria-live="polite">
          <h2 className="text-base font-semibold text-foreground mb-3">{t('recommend.results')}</h2>
          {results.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-6 text-sm text-muted-foreground">{t('recommend.empty')}</p>
          ) : (
            <ol className="space-y-3">
              {results.map((rec, index) => (
                <motion.li
                  key={rec.breed.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.06 }}
                  className="bg-card border border-border rounded-xl p-4 md:p-5"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Award className="w-4 h-4 text-primary shrink-0" aria-hidden="true" />
                    <h3 className="text-base font-semibold text-foreground">{rec.breed.name}</h3>
                    <span className="text-xs text-muted-foreground">{rec.breed.category} · {rec.breed.province}</span>
                    <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary tabular-nums">
                      {t('recommend.matchScore')} {rec.score}
                    </span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-muted" role="img" aria-label={`${t('recommend.matchScore')} ${rec.score} / 100`}>
                    <div className="h-full rounded-full bg-primary" style={{ width: `${rec.score}%` }} />
                  </div>
                  <ul className="mt-3 space-y-1.5 text-sm text-foreground/90 list-disc pl-5">
                    {rec.reasons.map((reason) => <li key={reason}>{reason}</li>)}
                  </ul>
                  <button
                    type="button"
                    onClick={() => navigate(`/map?breed_id=${rec.breed.id}`)}
                    className="mt-3 min-h-11 inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    {t('recommend.viewDetail')}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </motion.li>
              ))}
            </ol>
          )}
          <p className="mt-4 text-xs text-muted-foreground">{t('recommend.scopeNote')}</p>
        </section>
      )}
    </div>
  );
};

export default RecommendPage;
