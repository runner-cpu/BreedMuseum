import { ArrowRight, Check, MapPin, RotateCcw, Trophy, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
 *
 * 2026-10 界面重做：三台装置统一成「进度条 + 计分 + 选项卡 + 即时反馈 + 结算回顾」
 * 这一套答题界面范式（Duolingo / Kahoot / Quizlet 的通用骨架），
 * 而不是旧版「一段文字 + 一排 44px 按钮」。
 */

const CARD =
  'relative overflow-hidden rounded-3xl border border-stage-border bg-stage-panel text-stage-fg shadow-[0_16px_40px_-24px_rgba(18,40,32,.45)]';
const PRIMARY_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-stage-accent px-5 text-sm font-semibold text-stage-accent-fg transition hover:opacity-90 active:scale-[.99] disabled:cursor-not-allowed disabled:opacity-40';
const GHOST_BUTTON =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-stage-border px-4 text-sm text-stage-fg transition hover:border-stage-accent hover:text-stage-accent disabled:cursor-not-allowed disabled:opacity-40';
const OPTION_BUTTON =
  'group flex w-full items-start gap-3 rounded-2xl border px-4 py-3.5 text-left text-sm leading-6 transition-colors ' +
  'border-stage-border bg-stage text-stage-fg hover:border-stage-accent hover:bg-stage-soft ' +
  'focus-visible:outline-none disabled:cursor-default';

/** A/B/C/D 选项序号：视觉锚点比纯文字更容易扫读，也更接近主流答题界面。 */
const OPTION_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F'];

/* ------------------------------------------------------------------ */
/* 共用骨架：进度、计分、选项、反馈、结算                                  */
/* ------------------------------------------------------------------ */

function GameHeader({
  title,
  roundIndex,
  total,
  score,
  tone = 'accent',
}: {
  title: string;
  roundIndex: number;
  total: number;
  score: number;
  tone?: 'accent' | 'signal';
}) {
  const { t } = useSettings();
  const current = Math.min(roundIndex + 1, total);
  const percent = total === 0 ? 0 : Math.round(((current - 1) / total) * 100);

  return (
    <header className="space-y-3">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-stage-gold">{title}</p>
          <p className="mt-1 text-sm text-stage-muted">
            {fill(t('arcade.roundOf'), { index: current, total })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-stage-border px-3 py-1 font-mono text-xs text-stage-muted">
            <Trophy className="h-3.5 w-3.5 text-stage-gold" aria-hidden="true" />
            {t('arcade.score')} <strong className="text-stage-fg">{score}</strong>
          </span>
        </div>
      </div>
      <div
        className="h-1.5 w-full overflow-hidden rounded-full bg-stage-soft"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={Math.max(0, current - 1)}
        aria-label={fill(t('arcade.progressAria'), { index: current, total })}
      >
        <span
          className={cn('block h-full rounded-full transition-[width] duration-500', tone === 'signal' ? 'bg-stage-signal' : 'bg-stage-accent')}
          style={{ width: `${percent}%` }}
        />
      </div>
    </header>
  );
}

function Feedback({
  correct,
  title,
  detail,
  children,
}: {
  correct: boolean;
  title: string;
  detail?: string;
  children?: React.ReactNode;
}) {
  const Icon = correct ? Check : X;
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-3 rounded-2xl border px-4 py-3 text-sm',
        correct ? 'border-stage-accent/45 bg-stage-accent/10' : 'border-stage-signal/45 bg-stage-signal/10',
      )}
    >
      <span
        className={cn(
          'mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full',
          correct ? 'bg-stage-accent text-stage-accent-fg' : 'bg-stage-signal text-stage-panel',
        )}
        aria-hidden="true"
      >
        <Icon className="h-3.5 w-3.5" strokeWidth={3} />
      </span>
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn('font-semibold', correct ? 'text-stage-accent' : 'text-stage-signal')}>{title}</p>
        {detail && <p className="text-stage-fg/85">{detail}</p>}
        {children}
      </div>
    </div>
  );
}

function ResultScreen({
  title,
  score,
  total,
  review,
  onRestart,
  footnote,
}: {
  title: string;
  score: number;
  total: number;
  review?: React.ReactNode;
  onRestart: () => void;
  footnote?: string;
}) {
  const { t } = useSettings();
  const percent = total === 0 ? 0 : Math.round((score / total) * 100);
  return (
    <div className={cn(CARD, 'p-5 sm:p-7')}>
      <div className="flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-[0.62rem] uppercase tracking-[0.22em] text-stage-gold">{t('arcade.resultEyebrow')}</p>
          <h2 className="mt-1 font-serif text-2xl">{title}</h2>
          <p className="mt-1 text-sm text-stage-muted">{fill(t('arcade.resultAccuracy'), { percent })}</p>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-mono text-5xl font-semibold tabular-nums text-stage-accent">{score}</span>
          <span className="font-mono text-lg text-stage-muted">/ {total}</span>
        </div>
      </div>
      <div className="mt-4 h-2 w-full overflow-hidden rounded-full bg-stage-soft">
        <span className="block h-full rounded-full bg-stage-accent transition-[width] duration-700" style={{ width: `${percent}%` }} />
      </div>
      {review && (
        <div className="mt-6 border-t border-stage-border pt-4">
          <p className="text-xs font-medium tracking-[0.14em] text-stage-muted">{t('arcade.resultReview')}</p>
          <div className="mt-3">{review}</div>
        </div>
      )}
      {footnote && <p className="mt-4 text-xs leading-5 text-stage-muted">{footnote}</p>}
      <button type="button" onClick={onRestart} className={cn(PRIMARY_BUTTON, 'mt-5 w-full sm:w-auto')}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        {t('arcade.restart')}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 装置一：找家挑战                                                     */
/* ------------------------------------------------------------------ */

function FindHomeGame() {
  const { t, language } = useSettings();
  const [seed, setSeed] = useState(() => 20261009);
  const [roundIndex, setRoundIndex] = useState(0);
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string; detail: string } | null>(null);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<Array<{ province: string; correct: boolean }>>([]);

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
      detail: fill(t('arcade.findHomeAnswered'), {
        clicked: provinceLabel(province, language),
        province: provinceLabel(round.answerProvince, language),
      }),
    });
    setScore((value) => value + (correct ? 1 : 0));
    setAnswers((list) => [...list, { province, correct }]);
  };

  const next = () => {
    setFeedback(null);
    setRoundIndex((index) => index + 1);
  };

  const restart = () => {
    setSeed(seed + 1);
    setRoundIndex(0);
    setFeedback(null);
    setScore(0);
    setAnswers([]);
  };

  if (finished) {
    return (
      <ResultScreen
        title={t('arcade.findHomeResult')}
        score={score}
        total={rounds.length}
        onRestart={restart}
        review={
          <ul className="space-y-2">
            {rounds.map((item, index) => (
              <li key={item.breed.id} className="flex items-start gap-3 rounded-xl border border-stage-border px-3 py-2.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    answers[index]?.correct ? 'bg-stage-accent text-stage-accent-fg' : 'bg-stage-signal text-stage-panel',
                  )}
                  aria-hidden="true"
                >
                  {index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <Link
                    className="inline-flex items-center gap-1.5 text-sm font-medium underline decoration-stage-border underline-offset-4 hover:text-stage-accent"
                    to={'/encyclopedia?breed=' + encodeURIComponent(item.breed.id)}
                  >
                    {language === 'en' ? item.breed.englishName : item.breed.name}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                  <p className="mt-0.5 text-xs text-stage-muted">
                    {provinceLabel(item.answerProvince, language)}
                    {answers[index]?.correct ? ` · ${t('arcade.resultCorrectShort')}` : ` · ${t('arcade.resultWrongShort')}`}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  return (
    <div className={cn(CARD, 'space-y-4 p-4 sm:p-6')}>
      <GameHeader title={t('arcade.findHome')} roundIndex={roundIndex} total={rounds.length} score={score} />

      <div className="grid gap-4 sm:grid-cols-[11rem_minmax(0,1fr)] sm:items-start">
        <div className="overflow-hidden rounded-2xl border border-stage-border bg-stage-soft">
          <BreedImage
            src={round.breed.image}
            alt={fill(t('arcade.findHomeBreedImage'), { name: language === 'en' ? round.breed.englishName : round.breed.name })}
            category={round.breed.category}
            breedName={round.breed.name}
            className="aspect-[4/3] w-full"
            sizes="(min-width: 640px) 11rem, 100vw"
          />
        </div>
        <div className="min-w-0 space-y-2">
          <p className="text-lg leading-8">
            {fill(t('arcade.findHomePrompt'), {
              index: roundIndex + 1,
              total: rounds.length,
              name: language === 'en' ? round.breed.englishName : round.breed.name,
            })}
          </p>
          <p className="inline-flex items-center gap-1.5 rounded-full border border-stage-border px-2.5 py-1 text-xs text-stage-muted">
            <MapPin className="h-3.5 w-3.5 text-stage-gold" aria-hidden="true" />
            {t('arcade.findHomePickProvince')}
          </p>
          {feedback && (
            <Feedback correct={feedback.correct} title={feedback.text} detail={feedback.detail}>
              <div className="mt-2 flex flex-wrap items-center gap-3">
                <button type="button" onClick={next} className={PRIMARY_BUTTON}>
                  {t('arcade.next')}
                  <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
                <Link className="text-xs underline underline-offset-4 hover:text-stage-accent" to={'/encyclopedia?breed=' + encodeURIComponent(round.breed.id)}>
                  {t('arcade.openBreed')}
                </Link>
              </div>
            </Feedback>
          )}
        </div>
      </div>

      <div
        className="museum-map-canvas overflow-hidden rounded-2xl border border-stage-border bg-stage"
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
      <p className="text-xs text-stage-muted">{t('arcade.findHomeHint')}</p>
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
  const [score, setScore] = useState(0);

  const rounds = useMemo(() => generateIdentifyRounds(seed, 6), [seed]);
  const round = rounds[index];
  const finished = index >= rounds.length;

  const submit = (optionId: string) => {
    if (choice) return;
    setChoice(optionId);
    if (optionId === round.answerId) setScore((value) => value + 1);
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
      <ResultScreen
        title={t('arcade.identifyResult')}
        score={score}
        total={rounds.length}
        onRestart={restart}
        footnote={t('arcade.identifySameCategory')}
      />
    );
  }

  const revealed = Boolean(choice);
  const correct = choice === round.answerId;

  return (
    <div className={cn(CARD, 'space-y-4 p-4 sm:p-6')}>
      <GameHeader title={t('arcade.identify')} roundIndex={index} total={rounds.length} score={score} />

      <div className="grid gap-4 sm:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] sm:items-start">
        <div className="overflow-hidden rounded-2xl border border-stage-border bg-stage-soft">
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
        <div className="min-w-0 space-y-3">
          <p className="text-lg leading-8">{t('arcade.identifyPrompt')}</p>
          <div className="flex flex-wrap gap-2" role="group" aria-label={t('arcade.answerGroupCategory')}>
            {round.options.map((option, optionIndex) => {
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
                    'sm:w-[calc(50%-0.375rem)]',
                    revealed && isAnswer && 'border-stage-accent bg-stage-accent/12 font-semibold',
                    revealed && isChoice && !isAnswer && 'border-stage-signal bg-stage-signal/12',
                  )}
                >
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold',
                      revealed && isAnswer
                        ? 'border-stage-accent bg-stage-accent text-stage-accent-fg'
                        : revealed && isChoice
                          ? 'border-stage-signal bg-stage-signal text-stage-panel'
                          : 'border-stage-border text-stage-muted group-hover:border-stage-accent',
                    )}
                    aria-hidden="true"
                  >
                    {OPTION_LETTERS[optionIndex]}
                  </span>
                  <span className="min-w-0">{language === 'en' ? (option.labelEn || optionLabel(option.label, language)) : option.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {choice && (
        <Feedback
          correct={correct}
          title={correct ? t('arcade.correctLabel') : t('arcade.wrongLabel')}
          detail={language === 'en' ? round.explanationEn : round.explanation}
        >
          <p className="mt-1 text-xs text-stage-muted">
            {fill(t('arcade.correctAnswerIs'), { answer: language === 'en' ? (round.options.find((o) => o.id === round.answerId)?.labelEn ?? round.answerId) : round.answerId })}
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {visibleBreeds
              .filter((breed) => breed.category === round.answerId)
              .slice(0, 3)
              .map((breed) => (
                <Link
                  key={breed.id}
                  to={'/encyclopedia?breed=' + encodeURIComponent(breed.id)}
                  className="inline-flex min-h-9 items-center rounded-full border border-stage-border px-3 text-xs hover:border-stage-accent hover:text-stage-accent"
                >
                  {language === 'en' ? breed.englishName : breed.name}
                </Link>
              ))}
            <button type="button" onClick={next} className={PRIMARY_BUTTON}>
              {t('arcade.next')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </Feedback>
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
  const [answers, setAnswers] = useState<boolean[]>([]);

  const questions: QuizQuestion[] = useMemo(() => generateQuiz(seed, 5), [seed]);
  const question = questions[index];
  const finished = index >= questions.length;

  const submit = (optionId: string) => {
    if (choice) return;
    setChoice(optionId);
    const correct = optionId === question.answerId;
    if (correct) setScore((value) => value + 1);
    setAnswers((list) => [...list, correct]);
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
    setAnswers([]);
  };

  if (finished) {
    return (
      <ResultScreen
        title={fill(t('arcade.quizScore'), { score, total: questions.length })}
        score={score}
        total={questions.length}
        onRestart={restart}
        review={
          <ul className="space-y-2">
            {questions.map((item, questionIndex) => (
              <li key={`${item.kind}-${questionIndex}`} className="flex items-start gap-3 rounded-xl border border-stage-border px-3 py-2.5">
                <span
                  className={cn(
                    'mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-bold',
                    answers[questionIndex] ? 'bg-stage-accent text-stage-accent-fg' : 'bg-stage-signal text-stage-panel',
                  )}
                  aria-hidden="true"
                >
                  {questionIndex + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-6">{language === 'en' ? item.promptEn : item.prompt}</p>
                  <Link
                    className="mt-1 inline-flex items-center gap-1 text-xs text-stage-muted underline decoration-stage-border underline-offset-4 hover:text-stage-accent"
                    to={'/encyclopedia?breed=' + encodeURIComponent(item.subject.id)}
                  >
                    {fill(t('arcade.quizOpenBreed'), { name: item.subject.name })}
                    <ArrowRight className="h-3 w-3" aria-hidden="true" />
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        }
      />
    );
  }

  const revealed = Boolean(choice);
  const correct = choice === question.answerId;

  return (
    <div className={cn(CARD, 'space-y-4 p-4 sm:p-6')}>
      <GameHeader title={t('arcade.quiz')} roundIndex={index} total={questions.length} score={score} />

      <p className="text-lg leading-8">{language === 'en' ? question.promptEn : question.prompt}</p>

      <div className="grid gap-2.5 sm:grid-cols-2" role="group" aria-label={t('arcade.answerGroupAnswer')}>
        {question.options.map((option, optionIndex) => {
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
                revealed && isAnswer && 'border-stage-accent bg-stage-accent/12 font-semibold',
                revealed && isChoice && !isAnswer && 'border-stage-signal bg-stage-signal/12',
              )}
            >
              <span
                className={cn(
                  'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-lg border text-[11px] font-bold',
                  revealed && isAnswer
                    ? 'border-stage-accent bg-stage-accent text-stage-accent-fg'
                    : revealed && isChoice
                      ? 'border-stage-signal bg-stage-signal text-stage-panel'
                      : 'border-stage-border text-stage-muted group-hover:border-stage-accent',
                )}
                aria-hidden="true"
              >
                {OPTION_LETTERS[optionIndex]}
              </span>
              <span className="min-w-0">{language === 'en' ? (option.labelEn || optionLabel(option.label, language)) : option.label}</span>
            </button>
          );
        })}
      </div>

      {choice && (
        <Feedback
          correct={correct}
          title={correct ? t('arcade.correctLabel') : t('arcade.wrongLabel')}
          detail={language === 'en' ? question.explanationEn : question.explanation}
        >
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <Link
              to={'/encyclopedia?breed=' + encodeURIComponent(question.subject.id)}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-stage-border px-3 text-xs hover:border-stage-accent hover:text-stage-accent"
            >
              {fill(t('arcade.quizOpenBreed'), { name: question.subject.name })}
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button type="button" onClick={next} className={PRIMARY_BUTTON}>
              {t('arcade.next')}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </Feedback>
      )}
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
