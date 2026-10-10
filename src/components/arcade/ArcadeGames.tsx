import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Check, RotateCcw, X } from 'lucide-react';
import { categories } from '@/data/catalog';
import { breeds } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { CategorySilhouette, hasSilhouette, SILHOUETTE_CATEGORIES } from '@/components/arcade/CategorySilhouette';
import {
  generateFindHomeRounds,
  generateQuiz,
  haversineKm,
  PROVINCE_CENTROIDS,
  type QuizQuestion,
} from '@/lib/arcade/quizGenerator';
import { cn } from '@/lib/utils';

/**
 * 互动厅三台展教装置。
 *
 * 设计口径（与 /about 的说明一致）：
 * - 每台装置只玩**已核验字段**（类别 / 产区 / 保护状态），待核验记录不出题；
 * - 每局结束都强链档案页，把「答题」变成「进档案看官方来源」的入口；
 * - 全部操作可键盘完成；`prefers-reduced-motion` 下只有状态文字变化，无动画。
 */

const PANEL =
  'rounded-xl border border-white/12 bg-[#0b0f0d] p-4 text-museum-paper';

/* ------------------------------------------------------------------ */
/* 装置一：找家挑战（3D/平面图交互的省份作答）                            */
/* ------------------------------------------------------------------ */

interface FindHomeProps {
  onAnswered?: (correct: boolean) => void;
}

export function FindHomeGame({ onAnswered }: FindHomeProps) {
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
    onAnswered?.(correct);
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

  return (
    <section className={PANEL} aria-labelledby="arcade-findhome">
      <header className="mb-3 space-y-1">
        <h2 id="arcade-findhome" className="font-serif text-lg">
          找家挑战
        </h2>
        <p className="text-xs text-museum-paper/70">
          给出品种卡，在光图上点出它的家乡省份；点错会告诉你差多少公里。三题一局。
        </p>
      </header>

      {finished ? (
        <div className="space-y-3">
          <p className="text-sm">本局结束——你找到的每一束光都能点开看官方来源。</p>
          <ul className="space-y-1 text-sm">
            {rounds.map((item) => (
              <li key={item.breed.id}>
                <Link
                  className="inline-flex min-h-9 items-center gap-1.5 underline underline-offset-4 hover:text-white"
                  to={'/breed/' + item.breed.id}
                >
                  {item.breed.name} · {item.answerProvince}
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            再来一局
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm">
              第 {roundIndex + 1} / {rounds.length} 题：
              <span className="ml-1 font-medium">「{round.breed.name}」的家乡在哪个省份？</span>
            </p>
            <span className="shrink-0 text-xs text-museum-paper/60">{round.breed.category}</span>
          </div>
          <div className="flex items-center gap-4">
            <CategorySilhouette category={round.breed.category} className="h-16 w-16 text-museum-gold/80" />
            <div className="flex flex-wrap gap-1.5" role="group" aria-label="选择省份作答">
              {PROVINCE_CHOICES.map((province) => (
                <button
                  key={province}
                  type="button"
                  disabled={Boolean(feedback)}
                  onClick={() => submit(province)}
                  className="min-h-9 rounded-full border border-white/20 px-2.5 text-xs hover:bg-white/10 disabled:opacity-50"
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
                'flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm',
                feedback.correct
                  ? 'border-emerald-500/40 bg-emerald-500/10'
                  : 'border-museum-gold/40 bg-museum-gold/10',
              )}
            >
              {feedback.correct ? (
                <Check className="h-4 w-4" aria-hidden="true" />
              ) : (
                <X className="h-4 w-4" aria-hidden="true" />
              )}
              {feedback.text}
            </p>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={next}
              disabled={!feedback}
              className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10 disabled:opacity-40"
            >
              下一题
            </button>
            <Link
              className="text-xs underline underline-offset-4 hover:text-white"
              to={'/breed/' + round.breed.id}
            >
              先看这卷档案
            </Link>
          </div>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 装置二：识图挑战（剪影猜类别）                                        */
/* ------------------------------------------------------------------ */

interface IdentifyProps {
  onAnswered?: (correct: boolean) => void;
}

export function IdentifyGame({ onAnswered }: IdentifyProps) {
  const [seed, setSeed] = useState(() => 771);
  const [index, setIndex] = useState(0);
  const [choice, setChoice] = useState<string | null>(null);

  const questions = useMemo(
    () => generateQuiz(seed, 6).filter((question) => question.kind === 'silhouette'),
    [seed],
  );
  const question = questions[index];
  const finished = index >= questions.length;

  const submit = (optionId: string) => {
    if (choice) return;
    setChoice(optionId);
    onAnswered?.(optionId === question.answerId);
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

  const coverage = SILHOUETTE_CATEGORIES.length;

  return (
    <section className={PANEL} aria-labelledby="arcade-identify">
      <header className="mb-3 space-y-1">
        <h2 id="arcade-identify" className="font-serif text-lg">
          识图挑战
        </h2>
        <p className="text-xs text-museum-paper/70">
          看剪影猜类别（{coverage} 类全覆盖）。照片模式需要已核验授权图片，正在扩充中，暂不启用。
        </p>
      </header>

      {finished ? (
        <div className="space-y-3">
          <p className="text-sm">本局结束。每一类的代表品种都能在档案库里查到官方来源。</p>
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            再来一局
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-4">
            <CategorySilhouette
              category={question.answerId}
              label="待猜类别剪影"
              className="h-24 w-24 text-museum-gold"
            />
            <div className="space-y-1">
              <p className="text-sm">{question.prompt}</p>
              <p className="text-xs text-museum-paper/60">第 {index + 1} / {questions.length} 题</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="选择类别">
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
                    'min-h-11 rounded-lg border px-3 text-sm transition-colors',
                    revealed && isAnswer
                      ? 'border-emerald-500/60 bg-emerald-500/15'
                      : revealed && isChoice
                        ? 'border-museum-gold/60 bg-museum-gold/15'
                        : 'border-white/20 hover:bg-white/10',
                    revealed ? 'cursor-default' : '',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {choice && (
            <div className="space-y-2">
              <p role="status" className="text-sm text-museum-paper/85">
                {question.explanation}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {breeds
                  .filter((breed) => breed.category === question.answerId)
                  .slice(0, 3)
                  .map((breed) => (
                    <Link
                      key={breed.id}
                      to={'/breed/' + breed.id}
                      className="inline-flex min-h-9 items-center rounded-full border border-white/20 px-2.5 text-xs hover:bg-white/10"
                    >
                      {breed.name}
                    </Link>
                  ))}
              </div>
              <button
                type="button"
                onClick={next}
                className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10"
              >
                下一题
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 装置三：知识问答（自动出题）                                          */
/* ------------------------------------------------------------------ */

interface QuizProps {
  onAnswered?: (correct: boolean) => void;
}

export function QuizGame({ onAnswered }: QuizProps) {
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
    const correct = optionId === question.answerId;
    if (correct) setScore((value) => value + 1);
    onAnswered?.(correct);
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

  return (
    <section className={PANEL} aria-labelledby="arcade-quiz">
      <header className="mb-3 space-y-1">
        <h2 id="arcade-quiz" className="font-serif text-lg">
          知识问答
        </h2>
        <p className="text-xs text-museum-paper/70">
          题目由馆藏数据自动生成（类别 / 产区 / 保护状态），每题都能点进档案核对来源。
        </p>
      </header>

      {finished ? (
        <div className="space-y-3">
          <p className="text-sm">
            本局得分 {score} / {questions.length}。
          </p>
          <button
            type="button"
            onClick={restart}
            className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            再来一局
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm">{question.prompt}</p>
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="选择答案">
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
                    'min-h-11 rounded-lg border px-3 text-sm transition-colors',
                    revealed && isAnswer
                      ? 'border-emerald-500/60 bg-emerald-500/15'
                      : revealed && isChoice
                        ? 'border-museum-gold/60 bg-museum-gold/15'
                        : 'border-white/20 hover:bg-white/10',
                    revealed ? 'cursor-default' : '',
                  )}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
          {choice && (
            <div className="space-y-2">
              <p role="status" className="text-sm text-museum-paper/85">
                {question.explanation}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to={'/breed/' + question.subject.id}
                  className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-white/20 px-2.5 text-xs hover:bg-white/10"
                >
                  查看「{question.subject.name}」档案
                  <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                </Link>
                <button
                  type="button"
                  onClick={next}
                  className="inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-white/20 px-3 text-sm hover:bg-white/10"
                >
                  下一题
                </button>
              </div>
            </div>
          )}
          <p className="text-xs text-museum-paper/60">
            第 {index + 1} / {questions.length} 题 · 已答对 {score}
          </p>
        </div>
      )}
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* 页面级汇总与配置                                                      */
/* ------------------------------------------------------------------ */

/** 找家挑战的候选省份：8 个代表性产区，保证键盘可操作且选项长度可控。 */
const PROVINCE_CHOICES = [
  '内蒙古', '新疆', '西藏', '青海', '云南', '四川', '广东', '黑龙江',
];

/** 便于测试与页面复用：全部 15 类都应有剪影。 */
export const silhouetteCoverage = categories.every((category) => hasSilhouette(category));

/** 保护状态判定（统一走 metadata，避免在页面里就地判断）。 */
export const isNationalProtected = (id: string): boolean => {
  const breed = breeds.find((item) => item.id === id);
  return Boolean(breed && getBreedMetadata(breed).protectionStatus === 'national-list');
};

export { SILHOUETTE_CATEGORIES };
