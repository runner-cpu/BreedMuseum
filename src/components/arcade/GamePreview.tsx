import { Check, MapPin, ScanEye } from 'lucide-react';
import type { CSSProperties } from 'react';
import { BreedImage } from '@/components/common/BreedImage';
import { HOME_FEATURED } from '@/data/homeHighlights';
import { mapViewBox, provincePaths } from '@/data/chinaMap';
import { useSettings } from '@/contexts/AppSettings';
import { cn } from '@/lib/utils';

/**
 * 互动厅三台装置的封面预览。
 *
 * 旧实现把三个类别剪影摆在一个横条里：剪影本身是 80×80 的手绘轮廓，
 * 放大到 70px 后细节糊成一团，三张卡又都长着同一副面孔，
 * 观众分不清"找家"和"问答"到底差在哪。现在每台装置各画各的操作界面：
 * - 找家挑战：真实的省界版图 + 三个待定位的产区针脚；
 * - 识图挑战：一张馆藏照片 + 取景框；
 * - 知识问答：三道选项，其中一道已勾选。
 *
 * 三个预览都按 16:10 铺满卡片上沿，不再在卡片里留一条窄横条。
 */

const PINS: ReadonlyArray<{ province: string; delay: string }> = [
  { province: '黑龙江', delay: '0ms' },
  { province: '四川', delay: '420ms' },
  { province: '广东', delay: '840ms' },
];

/** 经纬度 → 省界 SVG 坐标，与 `src/data/chinaMap.ts` 的投影保持一致。 */
const project = (lon: number, lat: number) => ({
  x: ((lon - 73) / (135 - 73)) * mapViewBox.width,
  y: ((54 - lat) / (54 - 18)) * mapViewBox.height,
});

const PIN_COORDS: Record<string, { x: number; y: number }> = {
  黑龙江: project(126.6, 45.8),
  四川: project(104.1, 30.7),
  广东: project(113.3, 23.1),
};

const IDENTIFY_PREVIEW = HOME_FEATURED.find((breed) => breed.category === '鸡') ?? HOME_FEATURED[0];

const QUIZ_OPTIONS = [
  { letter: 'A', textKey: 'arcade.previewQuizA', correct: true },
  { letter: 'B', textKey: 'arcade.previewQuizB', correct: false },
  { letter: 'C', textKey: 'arcade.previewQuizC', correct: false },
] as const;

interface GamePreviewProps {
  gameId: 'find-home' | 'identify' | 'quiz';
  className?: string;
}

export function GamePreview({ gameId, className }: GamePreviewProps) {
  const { t } = useSettings();

  return (
    <div
      aria-hidden="true"
      className={cn('relative h-full w-full overflow-hidden', className)}
      style={{
        // 内联而不是 Tailwind 任意值：`rgb(var(--x) / 0.16)` 里的斜杠会被 Tailwind
        // 当成透明度分隔符，整条渐变会被丢弃（实测 backgroundImage 为 none）。
        backgroundImage:
          'radial-gradient(circle at 30% 20%, rgb(var(--stage-gold-rgb) / 0.16), transparent 58%), linear-gradient(160deg, var(--stage-soft), var(--stage-panel))',
      }}
    >
      {gameId === 'find-home' && <MapPreview />}
      {gameId === 'identify' && <IdentifyPreview />}
      {gameId === 'quiz' && <QuizPreview t={t} />}
    </div>
  );
}

function MapPreview() {
  return (
    <div className="absolute inset-0 flex items-center justify-center px-4 py-3">
      <svg
        viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`}
        className="h-full w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        <g>
          {Object.values(provincePaths).map((d, index) => (
            <path
              key={index}
              d={d}
              fill="rgb(var(--stage-gold-rgb) / 0.2)"
              stroke="rgb(var(--stage-gold-rgb) / 0.62)"
              strokeWidth="1.6"
              strokeLinejoin="round"
            />
          ))}
        </g>
        {PINS.map(({ province, delay }) => {
          const point = PIN_COORDS[province];
          if (!point) return null;
          return (
            <g key={province} transform={`translate(${point.x} ${point.y})`}>
              <circle
                r="26"
                fill="none"
                stroke="rgb(var(--stage-signal-rgb) / 0.75)"
                strokeWidth="2"
                className="animate-ping motion-reduce:animate-none"
                style={
                  {
                    animationDelay: delay,
                    animationDuration: '2.6s',
                    transformBox: 'fill-box',
                    transformOrigin: 'center',
                  } as CSSProperties
                }
              />
              <circle r="10" fill="var(--stage-signal)" stroke="var(--stage-panel)" strokeWidth="3" />
            </g>
          );
        })}
      </svg>
      <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-stage-gold/35 bg-stage-panel/85 px-2.5 py-1 text-[10px] tracking-[0.14em] text-stage-gold backdrop-blur">
        <MapPin className="h-3 w-3" aria-hidden="true" />
        3 / 3
      </span>
    </div>
  );
}

function IdentifyPreview() {
  return (
    <div className="absolute inset-0">
      <BreedImage
        src={IDENTIFY_PREVIEW.image}
        alt=""
        category={IDENTIFY_PREVIEW.category}
        breedName={IDENTIFY_PREVIEW.name}
        sizes="(min-width: 1024px) 30vw, 90vw"
        className="h-full w-full"
        imgClassName="transition-transform duration-700 group-hover:scale-[1.05]"
      />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,rgb(10_10_26/0.05),rgb(10_10_26/0.55))]" />
      {/* 取景框：四角描边，暗示“识别这张照片” */}
      <div className="pointer-events-none absolute inset-5 rounded-lg border border-white/45 [mask-image:linear-gradient(#000,#000)]">
        <span className="absolute -left-px -top-px h-5 w-5 rounded-tl-lg border-l-2 border-t-2 border-stage-gold" />
        <span className="absolute -right-px -top-px h-5 w-5 rounded-tr-lg border-r-2 border-t-2 border-stage-gold" />
        <span className="absolute -bottom-px -left-px h-5 w-5 rounded-bl-lg border-b-2 border-l-2 border-stage-gold" />
        <span className="absolute -bottom-px -right-px h-5 w-5 rounded-br-lg border-b-2 border-r-2 border-stage-gold" />
      </div>
      <span className="pointer-events-none absolute bottom-3 left-1/2 flex -translate-x-1/2 items-center gap-1.5 rounded-full border border-white/25 bg-[#0a0a1a]/60 px-2.5 py-1 text-[10px] tracking-[0.14em] text-[#f5f0e8] backdrop-blur">
        <ScanEye className="h-3 w-3" aria-hidden="true" />
        ?
      </span>
    </div>
  );
}

function QuizPreview({ t }: { t: (key: string) => string }) {
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-5 py-4">
      {QUIZ_OPTIONS.map((option) => (
        <div
          key={option.letter}
          className={cn(
            'flex items-center gap-2.5 rounded-lg border px-3 py-2 text-xs transition-colors',
            option.correct
              ? 'border-stage-gold/70 bg-stage-gold/15 text-stage-fg'
              : 'border-stage-border/70 bg-stage-panel/55 text-stage-muted',
          )}
        >
          <span
            className={cn(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded-full font-mono text-[10px]',
              option.correct ? 'bg-stage-gold text-stage-accent-fg' : 'bg-stage-soft text-stage-muted',
            )}
          >
            {option.letter}
          </span>
          <span className="truncate">{t(option.textKey)}</span>
          {option.correct && <Check className="ml-auto h-3.5 w-3.5 shrink-0 text-stage-gold" aria-hidden="true" />}
        </div>
      ))}
    </div>
  );
}
