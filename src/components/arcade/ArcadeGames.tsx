import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { breeds } from '@/data/breeds';
import { CategorySilhouette, SILHOUETTE_CATEGORIES } from '@/components/arcade/CategorySilhouette';
import {
  generateFindHomeRounds,
  generateQuiz,
  haversineKm,
  PROVINCE_CENTROIDS,
  type QuizQuestion,
} from '@/lib/arcade/quizGenerator';
import { cn } from '@/lib/utils';

/**
 * 互动厅三台展教装置（组件层）。
 *
 * 每台装置是**独立子页面**（`/arcade/:game`）的内容出口，由 `ArcadeGamePage` 挂载；
 * 一次只渲染一台，题面不再挤在一起。
 *
 * 设计口径（与 /about、总览页的说明一致）：
 * - 每台装置只玩**已核验字段**（类别 / 产区 / 保护状态），待核验记录不出题；
 * - 每局结束都强链档案页，把「答题」变成「进档案看官方来源」的入口；
 * - 全部操作可键盘完成；`prefers-reduced-motion` 下只有状态文字变化，无动画；
 * - 配色走 stage 语义令牌，浅色/深色两套主题下都保证题面与选项对比度充足。
 */

const PANEL = 'rounded-2xl border border-stage-border bg-stage-panel p-5 text-stage-fg';
const GHOST_BUTTON =
  'inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-stage-border px-3 text-sm text-stage-fg hover:bg-stage-soft';
const OPTION_BUTTON =
  'min-h-11 rounded-lg border px-3 text-sm transition-colors border-stage-border text-stage-fg hover:bg-stage-soft disabled:cursor-default';

/** 找家挑战的候选省份：8 个代表性产区，保证键盘可操作且选项长度可控。 */
const PROVINCE_CHOICES = ['内蒙古', '新疆', '西藏', '青海', '云南', '四川', '广东', '黑龙江'];

/* ------------------------------------------------------------------ */
/* 装置一：找家挑战                                                     */
/* ------------------------------------------------------------------ */

function FindHomeGame() {
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
      text: correct ? '答对了——这束光就在你点的省份' : `方向不对：距真实产区约 ${distance.toLocaleString()} 公里`,
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
        <p className="text-sm">本局结束——你找到的每一束光都能点开看官方来源。</p>
        <ul className="mt-3 space-y-1 text-sm">
          {rounds.map((item) => (
            <li key={item.breed.id}>
              <Link
                className="inline-flex min-h-9 items-center gap-1.5 underline underline-offset-4 hover:text-stage-gold"
                to={'/breed/' + item.breed.id}
              >
                {item.breed.name} · {item.answerProvince}
                <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
        <button type="button" onClick={restart} className={cn(GHOST_BUTTON, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="text-base">
          第 {roundIndex + 1} / {rounds.length} 题：
          <span className="ml-1 font-medium">「{round.breed.name}」的家乡在哪个省份？</span>
        </p>
        <span className="text-xs text-stage-muted">{round.breed.category}</span>
      </div>

      <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-center">
        <CategorySilhouette
          category={round.breed.category}
          className="h-20 w-20 shrink-0 text-stage-gold"
        />
        <div className="flex flex-wrap gap-2" role="group" aria-label="选择省份作答">
          {PROVINCE_CHOICES.map((province) => (
            <button
              key={province}
              type="button"
              disabled={Boolean(feedback)}
              onClick={() => submit(province)}
              className={cn('min-h-11 rounded-full px-4 text-sm', OPTION_BUTTON, feedback ? 'opacity-60' : '')}
            >
              {province}
            </button>
          ))}
        </div>
      </div>

      {feedback && (
        <p
          role="status"
          className={cn(
            'mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm',
            feedback.correct
              ? 'border-emerald-600/50 bg-emerald-500/12 text-emerald-800 dark:text-emerald-300'
              : 'border-stage-gold/60 bg-stage-gold/12 text-stage-fg',
          )}
        >
          {feedback.correct ? (
            <Check className="h-4 w-4 shrink-0" aria-hidden="true" />
          ) : (
            <X className="h-4 w-4 shrink-0" aria-hidden="true" />
          )}
          {feedback.text}
        </p>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={next} disabled={!feedback} className={cn(GHOST_BUTTON, feedback ? '' : 'opacity-40')}>
          下一题
        </button>
        <Link className="text-xs underline underline-offset-4 hover:text-stage-gold" to={'/breed/' + round.breed.id}>
          先看这卷档案
        </Link>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* 装置二：识图挑战                                                     */
/* ------------------------------------------------------------------ */

function IdentifyGame() {
  const [seed, setSeed] = useState(() => 771);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);

  const questions = useMemo(
    () => generateQuiz(seed, 6).filter((question) => question.kind === 'silhouette'),
    [seed],
  );
  const question = questions[index];
  const finished = index >= questions.length;
  const coverage = SILHOUETTE_CATEGORIES.length;

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
        <p className="text-sm">本局结束。每一类的代表品种都能在档案库里查到官方来源。</p>
        <button type="button" onClick={restart} className={cn(GHOST_BUTTON, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <p className="text-xs text-stage-muted">
        剪影覆盖 {coverage} 类；照片模式需要已核验授权图片，暂不启用。
      </p>
      <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-center">
        <CategorySilhouette
          category={question.answerId}
          label="待猜类别剪影"
          className="h-32 w-32 shrink-0 text-stage-gold sm:h-40 sm:w-40"
        />
        <div className="space-y-2">
          <p className="text-base">{question.prompt}</p>
          <p className="text-xs text-stage-muted">第 {index + 1} / {questions.length} 题</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="选择类别">
        {question.options.map((option) => {
          const revealed = Boolean(choice);
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
              {option.label}
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm text-stage-fg/90">{question.explanation}</p>
          <div className="flex flex-wrap gap-2">
            {breeds
              .filter((breed) => breed.category === question.answerId)
              .slice(0, 3)
              .map((breed) => (
                <Link
                  key={breed.id}
                  to={'/breed/' + breed.id}
                  className="inline-flex min-h-9 items-center rounded-full border border-stage-border px-3 text-xs hover:bg-stage-soft"
                >
                  {breed.name}
                </Link>
              ))}
          </div>
          <button type="button" onClick={next} className={GHOST_BUTTON}>
            下一题
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
          本局得分 {score} / {questions.length}。
        </p>
        <button type="button" onClick={restart} className={cn(GHOST_BUTTON, 'mt-4')}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          再来一局
        </button>
      </div>
    );
  }

  return (
    <div className={PANEL}>
      <p className="text-base">{question.prompt}</p>
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="选择答案">
        {question.options.map((option) => {
          const revealed = Boolean(choice);
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
              {option.label}
            </button>
          );
        })}
      </div>

      {choice && (
        <div className="mt-4 space-y-3">
          <p role="status" className="text-sm text-stage-fg/90">{question.explanation}</p>
          <div className="flex flex-wrap items-center gap-3">
            <Link
              to={'/breed/' + question.subject.id}
              className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-stage-border px-3 text-xs hover:bg-stage-soft"
            >
              查看「{question.subject.name}」档案
              <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
            <button type="button" onClick={next} className={GHOST_BUTTON}>
              下一题
            </button>
          </div>
        </div>
      )}

      <p className="mt-4 text-xs text-stage-muted">
        第 {index + 1} / {questions.length} 题 · 已答对 {score}
      </p>
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
