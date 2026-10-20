import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { ChinaMap } from '@/components/ChinaMap';
import { BreedImage } from '@/components/common/BreedImage';
import { useSettings } from '@/contexts/AppSettings';
import { visibleBreeds } from '@/data/visibleBreeds';
import {
  generateFindHomeRounds,
  generateIdentifyRounds,
  generateQuiz,
  haversineKm,
  PROVINCE_CENTROIDS,
  type QuizQuestion,
} from '@/lib/arcade/quizGenerator';
import { categoryLabel, fill, optionLabel, provinceLabel } from '@/lib/displayLabels';
import { cn } from '@/lib/utils';

/**
 * 互动厅三台展教装置（组件层）。
 *
 * 每台装置是**独立子页面**（`/arcade/:game`）的内容出口，由 `ArcadeGamePage` 挂载；
 * 一次只渲染一台，题面不再挤在一起。
 *
 * 三台装置都贴着「当前网站」的出题口径：
 * - 找家挑战在真实中国地图上点省份作答（不再是 8 个固定按钮），
 *   只有已核验产区的省份可点击，答错按 haversine 算距离；
 * - 识图挑战用馆藏真实照片问“属于哪一类”，因为照片的品种级身份仍待核验，
 *   但类别是可靠的；
 * - 知识问答轮转类别 / 产区 / 保护身份 / 濒危口径四类题。
 */

const PANEL = 'rounded-2xl border border-stage-border bg-stage-panel p-5 text-stage-fg';
const GHOST_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stage-border px-3 text-sm text-stage-fg hover:bg-stage-soft';
const OPTION_BUTTON =
  'min-h-11 rounded-lg border px-3 text-sm transition-colors border-stage-border text-stage-fg hover:bg-stage-soft disabled:cursor-default';

/* ------------------------------------------------------------------ */
/* 装置一：找家挑战                                                     */
/* ------------------------------------------------------------------ */

function FindHomeGame() {
  const { t, language } = useSettings();
  const [seed, setSeed] = useState(() => 20261009);
  const [roundIndex, setRoundIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);

  const rounds = useMemo(() => generateFindHomeRounds(seed, 3), [seed]);
  const round = rounds[roundIndex];
  const finished = roundIndex >= rounds.length;

  const submit = (province: string) => {
    if (!round || feedback) return;
    const correct = province === round.answerProvince;
    const distance = correct
      ? 0
      : haversineKm(PROVINCE_CENTROIDS[province] ?? [0, 0], round.answerCoordinate);
    setFeedback({
      correct,
      text: correct
        ? fill(t('arcade.findHomeCorrect'), { province: provinceLabel(round.answerProvince, language) })
        : fill(t('arcade.findHomeWrong'), {
            clicked: provinceLabel(province, language),
            km: distance.toLocaleString(language === 'en' ? 'en-US' : 'zh-CN'),
          }),
    });
  };

  const next = () => {
    setFeedback(null);
    setRoundIndex((index) => index + 1);
  };

  const restart = () => {
    setSeed(seed + 1);
    setRoundIndex(0);
    setFeedback(null);
  };

  if (finished) {
    return (
      <div className={PANEL}>
        <p className="text-sm">{t('arcade.findHomeResult')}</p>
        <ul className="mt-3 space-y-1 text-sm">
          {rounds.map((item) => (
            <li key={item.breed.id}>
              <Link
                className="inline-flex min-h-9 items-center gap-1.5 underline underline-offset-4 hover:text-stage-gold"
                to={'/encyclopedia?breed=' + encodeURIComponent(item.breed.id)}
              >
                {language === 'en' ? item.breed.englishName : item.breed.name} · {provinceLabel(item.answerProvince, language)}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" onClick={restart} className={cn(GHOST_BUTTON, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('arcade.restart')}
        </button>
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <BreedImage
          src={round.breed.image}
          alt={fill(t('arcade.findHomeBreedImage'), { name: language === 'en' ? round.breed.englishName : round.breed.name })}
          category={round.breed.category}
          breedName={round.breed.name}
          className="aspect-[4/3] w-full shrink-0 rounded-xl sm:w-48"
          sizes="(min-width: 640px) 12rem, 100vw"
        />
        <div className="min-w-0 flex-1">
          <p className="text-base leading-7">
            {fill(t('arcade.findHomePrompt'), {
              index: roundIndex + 1,
              total: rounds.length,
              name: language === 'en' ? round.breed.englishName : round.breed.name,
            })}
          </p>
          <p className="mt-1 text-xs text-stage-muted">{t('arcade.findHomePickProvince')}</p>
          {feedback && (
            <p
              role="status"
              className={cn(
                'mt-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
                feedback.correct
                  ? 'border-emerald-600/50 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300'
                  : 'border-stage-gold/60 bg-stage-gold/12 text-stage-fg',
              )}
            >
              {feedback.correct ? <Check className="h-4 w-4 shrink-0" aria-hidden="true" /> : <X className="h-4 w-4 shrink-0" aria-hidden="true" />}
              {feedback.text}
            </p>
          )}
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <button type="button" onClick={next} disabled={!feedback} className={cn(GHOST_BUTTON, feedback ? '' : 'opacity-40')}>
              {t('arcade.next')}
            </button>
            <Link className="text-xs underline underline-offset-4 hover:text-stage-gold" to={'/encyclopedia?breed=' + encodeURIComponent(round.breed.id)}>
              {t('arcade.openBreed')}
            </Link>
          </div>
        </div>
      </div>

      <div
        className="museum-map-canvas mt-4 overflow-hidden rounded-xl border border-stage-border"
        role="group"
        aria-label={t('arcade.answerGroupProvince')}
      >
        <ChinaMap
          breeds={visibleBreeds}
          selectedProvince={feedback ? (feedback.correct ? round.answerProvince : null) : null}
          selectedBreed={null}
          focusedProvince={feedback?.correct ? round.answerProvince : null}
          onProvinceClick={submit}
          onBreedClick={() => undefined}
          onClearSelection={() => undefined}
          showProvinceLabels={false}
          showCoordinateNote={false}
        />
      </div>
      <p className="mt-2 text-xs text-stage-muted">{t('arcade.findHomeHint')}</p>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 装置二：识图挑战                                                     */
/* ------------------------------------------------------------------ */

function IdentifyGame() {
  const { t, language } = useSettings();
  const [seed, setSeed] = useState(() => 771);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);

  const rounds = useMemo(() => generateIdentifyRounds(seed, 6), [seed]);
  const round = rounds[index];
  const finished = index >= rounds.length;

  const submit = (optionId: string) => {
    if (choice) return;
    setChoice(optionId);
  };

  const next = () => {
    setChoice(null);
    setIndex((value) => value + 1);
  };

  const restart = () => {
    setSeed(seed + 1);
    setIndex(0);
    setChoice(null);
  };

  if (finished) {
    return (
      <div className={PANEL}>
        <p className="text-sm">{t('arcade.identifyResult')}</p>
        <button type="button" onClick={restart} className={cn(GHOST_BUTTON, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('arcade.restart')}
        </button>
      </div>
    );
  }

  const revealed = Boolean(choice);

  return (
    <div className={PANEL}>
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
        <div className="w-full shrink-0 overflow-hidden rounded-xl bg-stage-soft sm:w-64">
          <BreedImage
            src={round.breed.image}
            alt={t('arcade.identifyPhotoAlt')}
            category={round.breed.category}
            breedName={round.breed.name}
            className="aspect-[4/3] w-full"
            sizes="(min-width: 640px) 16rem, 100vw"
            eager
          />
        </div>
        <div className="min-w-0 flex-1 space-y-2">
          <p className="text-base leading-7">{t('arcade.identifyPrompt')}</p>
          <p className="text-xs text-stage-muted">
            {fill(t('arcade.identifyProgress'), { index: index + 1, total: rounds.length })}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('arcade.answerGroupCategory')}>
        {round.options.map((option) => {
          const isAnswer = option.id === round.answerId;
          const isChoice = option.id === choice;
          return (
            <button
              key={option.id}
              type="button"
              disabled={revealed}
              onClick={() => submit(option.id)}
              className={cn(
                OPTION_BUTTON,
                revealed && isAnswer && 'border-emerald-600/60 bg-emerald-500/12 font-semibold',
                revealed && isChoice && !isAnswer && 'border-stage-gold/70 bg-stage-gold/12',
              )}
            >
              {language === 'en' ? (option.labelEn || optionLabel(option.label, language)) : option.label}
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm text-stage-fg/90">
            {language === 'en' ? round.explanationEn : round.explanation}
          </p>
          <p className="text-xs text-stage-muted">{t('arcade.identifySameCategory')}</p>
          <div className="flex flex-wrap gap-2">
            {visibleBreeds
              .filter((breed) => breed.category === round.answerId)
              .slice(0, 3)
              .map((breed) => (
                <Link
                  key={breed.id}
                  to={'/encyclopedia?breed=' + encodeURIComponent(breed.id)}
                  className="inline-flex min-h-9 items-center rounded-full border border-stage-border px-3 text-xs hover:bg-stage-soft"
                >
                  {language === 'en' ? breed.englishName : breed.name}
                </Link>
              ))}
          </div>
          <button type="button" onClick={next} className={GHOST_BUTTON}>
            {t('arcade.next')}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 装置三：知识问答                                                     */
/* ------------------------------------------------------------------ */

function QuizGame() {
  const { t, language } = useSettings();
  const [seed, setSeed] = useState(() => 2026);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);
  const [score, setScore] = useState(0);

  const questions: QuizQuestion[] = useMemo(() => generateQuiz(seed, 5), [seed]);
  const question = questions[index];
  const finished = index >= questions.length;

  const submit = (optionId: string) => {
    if (choice) return;
    setChoice(optionId);
    if (optionId === question.answerId) setScore((value) => value + 1);
  };

  const next = () => {
    setChoice(null);
    setIndex((value) => value + 1);
  };

  const restart = () => {
    setSeed(seed + 1);
    setIndex(0);
    setChoice(null);
    setScore(0);
  };

  if (finished) {
    return (
      <div className={PANEL}>
        <p className="text-base">
          {fill(t('arcade.quizScore'), { score, total: questions.length })}
        </p>
        <button type="button" onClick={restart} className={cn(GHOST_BUTTON, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          {t('arcade.restart')}
        </button>
      </div>
    );
  }

  const revealed = Boolean(choice);

  return (
    <div className={PANEL}>
      <p className="text-base leading-7">{language === 'en' ? question.promptEn : question.prompt}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label={t('arcade.answerGroupAnswer')}>
        {question.options.map((option) => {
          const isAnswer = option.id === question.answerId;
          const isChoice = option.id === choice;
          return (
            <button
              key={option.id}
              type="button"
              disabled={revealed}
              onClick={() => submit(option.id)}
              className={cn(
                OPTION_BUTTON,
                revealed && isAnswer && 'border-emerald-600/60 bg-emerald-500/12 font-semibold',
                revealed && isChoice && !isAnswer && 'border-stage-gold/70 bg-stage-gold/12',
              )}
            >
              {language === 'en' ? (option.labelEn || optionLabel(option.label, language)) : option.label}
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm text-stage-fg/90">
            {language === 'en' ? question.explanationEn : question.explanation}
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={'/encyclopedia?breed=' + encodeURIComponent(question.subject.id)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-stage-border px-3 text-xs hover:bg-stage-soft"
            >
              {fill(t('arcade.quizOpenBreed'), { name: question.subject.name })}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button type="button" onClick={next} className={GHOST_BUTTON}>
              {t('arcade.next')}
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-stage-muted">
        {fill(t('arcade.quizProgress'), { index: index + 1, total: questions.length, score })}
      </p>
      <span className="sr-only">{language}</span>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 装置切换器的内容出口                                                  */
/* ------------------------------------------------------------------ */

export const ARCADE_GAME_COMPONENTS = {
  'find-home': FindHomeGame,
  identify: IdentifyGame,
  quiz: QuizGame,
} as const;
