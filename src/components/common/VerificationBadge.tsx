import type { Breed } from '@/data/breeds';
import { cn } from '@/lib/utils';
import { getVerificationVerdict, type VerificationLevel } from '@/data/verification';

/**
 * 三态核验徽章（全站唯一渲染入口）。
 *
 * 判定逻辑在 `@/data/verification`，本组件只负责呈现：
 * 徽章必须始终带文字（不能只用颜色表达状态），保证色觉障碍用户可读。
 *
 * 配色走 stage 语义令牌，因此浅色（宣纸）与深色（墨绿夜色）下都保持可读对比；
 * `official` 用金色描边 + 金色文字，`pending` 用虚线边框表示「尚未确证」。
 */

const STYLES: Record<VerificationLevel, string> = {
  official: 'border-stage-gold/70 bg-stage-gold/15 text-stage-gold',
  editorial: 'border-stage-border bg-stage-soft text-stage-fg/85',
  pending: 'border-dashed border-stage-border bg-transparent text-stage-muted',
};

const MARKS: Record<VerificationLevel, string> = {
  official: '🏛',
  editorial: '📄',
  pending: '⏳',
};

export interface VerificationBadgeProps {
  breed: Breed;
  className?: string;
  /** 紧凑模式用于卡片流；完整模式用于档案抽屉与详情页头部 */
  compact?: boolean;
}

export function VerificationBadge({ breed, className, compact = false }: VerificationBadgeProps) {
  const verdict = getVerificationVerdict(breed);
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] leading-tight',
        STYLES[verdict.level],
        className,
      )}
      title={verdict.detail}
      data-verification={verdict.level}
    >
      <span aria-hidden="true">{MARKS[verdict.level]}</span>
      {verdict.label}
      {!compact && <span className="sr-only">：{verdict.detail}</span>}
    </span>
  );
}

/** 徽章图例（档案库页头 / 关于页共用）。 */
export function VerificationLegend({ className }: { className?: string }) {
  return (
    <ul className={cn('flex flex-wrap items-center gap-3 text-[11px] text-stage-muted', className)}>
      {(['official', 'editorial', 'pending'] as const).map((level) => (
        <li key={level} className="inline-flex items-center gap-1.5">
          <span
            className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5', STYLES[level])}
          >
            <span aria-hidden="true">{MARKS[level]}</span>
            {getVerificationVerdictByLevel(level).label}
          </span>
          <span className="hidden sm:inline">{getVerificationVerdictByLevel(level).detail}</span>
        </li>
      ))}
    </ul>
  );
}

/** 按等级取文案（图例用，不需要具体记录）。 */
function getVerificationVerdictByLevel(level: VerificationLevel) {
  if (level === 'official') {
    return {
      label: '官方已核验',
      detail: '名称与名录身份可追溯至 940 号公告或 2024 名录官方文件。',
    };
  }
  if (level === 'editorial') {
    return {
      label: '编辑整理',
      detail: '来自项目整理数据集，描述为编辑口径。',
    };
  }
  return {
    label: '待专项核验',
    detail: '产区或资料未核验，暂不落点。',
  };
}
