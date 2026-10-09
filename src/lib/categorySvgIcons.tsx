import React from 'react';

interface IconProps {
  className?: string;
  style?: React.CSSProperties;
}

const base = (children: React.ReactNode) => ({ className, style }: IconProps) => (
  <svg
    viewBox="0 0 32 32"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.8}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    aria-hidden="true"
  >
    {children}
  </svg>
);

/** 猪：圆身、大耳、卷尾、拱嘴 */
export const PigIcon = base(
  <>
    <path d="M6 20c0-5 4-9 10-9s10 4 10 9c0 3-2 5-5 5H11c-3 0-5-2-5-5Z" />
    <path d="M11 11c-2-2-5-2-6 0 1 2 4 2 6 0Z" />
    <path d="M21 11c2-2 5-2 6 0-1 2-4 2-6 0Z" />
    <circle cx="13" cy="19" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="19" r="1" fill="currentColor" stroke="none" />
    <path d="M15 22c1 .8 1.6.8 2 0" />
    <path d="M26 18c2 .5 2 3 0 3.5" />
  </>,
);

/** 牛：头部、双角、鼻环 */
export const CattleIcon = base(
  <>
    <path d="M9 13c0-4 3-7 7-7s7 3 7 7v6c0 3-2 5-7 5s-7-2-7-5v-6Z" />
    <path d="M7 8c-3 1-4 4-3 7 3-1 4-3 4-6" />
    <path d="M25 8c3 1 4 4 3 7-3-1-4-3-4-6" />
    <circle cx="13" cy="14" r="1.2" fill="currentColor" stroke="none" />
    <circle cx="19" cy="14" r="1.2" fill="currentColor" stroke="none" />
    <path d="M13 19h6" />
    <path d="M16 22v2" />
    <path d="M14 24a2 2 0 0 0 4 0" />
  </>,
);

/** 羊：蓬松卷毛身体、小头 */
export const SheepIcon = base(
  <>
    <path d="M10 14c-2-1-3-3-2-5 1-1 3-1 4 0" />
    <path d="M22 14c2-1 3-3 2-5-1-1-3-1-4 0" />
    <path d="M8 16c-2 1-3 3-2 5 1 1 3 1 4 0" />
    <path d="M24 16c2 1 3 3 2 5-1 1-3 1-4 0" />
    <path d="M12 12c0-2 2-3 4-3s4 1 4 3v8c0 2-2 3-4 3s-4-1-4-3v-8Z" />
    <circle cx="14" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="18" cy="15" r="1" fill="currentColor" stroke="none" />
    <path d="M15 18h2" />
  </>,
);

/** 鸡：身体、鸡冠、尖喙、双腿 */
export const ChickenIcon = base(
  <>
    <path d="M9 20c0-6 3-10 7-10s7 4 7 10c0 2-1 3-3 3H12c-2 0-3-1-3-3Z" />
    <path d="M12 10c0-2 1-3 2-3s2 1 2 3" />
    <path d="M14 7c0-1 .5-2 1-2s1 1 1 2" />
    <path d="M23 16c2 0 3-1 3-2-1 0-2 .5-3 1" />
    <circle cx="20" cy="13" r="1" fill="currentColor" stroke="none" />
    <path d="M13 23v3M18 23v3" />
  </>,
);

/** 鸭：身体、扁喙 */
export const DuckIcon = base(
  <>
    <path d="M8 19c0-5 3-9 8-9s8 4 8 9c0 2-1 4-4 4H12c-3 0-4-2-4-4Z" />
    <path d="M13 10c0-2 1-4 3-4s3 2 3 4" />
    <path d="M24 15c2 0 3 1 3 2-1 0-2 0-3-.5" />
    <circle cx="19" cy="12" r="1" fill="currentColor" stroke="none" />
    <path d="M13 23v3M18 23v3" />
  </>,
);

/** 马：头部、鬃毛、长脸 */
export const HorseIcon = base(
  <>
    <path d="M11 6c-2 2-3 5-3 8 0 4 3 7 8 7s8-3 8-7c0-3-1-6-3-8" />
    <path d="M8 14c-2 1-3 3-2 5 2-1 3-2 3-4" />
    <path d="M24 14c2 1 3 3 2 5-2-1-3-2-3-4" />
    <path d="M11 18c1 1 3 2 5 2s4-1 5-2" />
    <circle cx="13" cy="13" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="13" r="1" fill="currentColor" stroke="none" />
    <path d="M14 21v3M18 21v3" />
  </>,
);

/** 骆驼：身体、驼峰、长颈 */
export const CamelIcon = base(
  <>
    <path d="M5 21c0-4 3-7 7-7h2c2 0 3 1 3 3v4" />
    <path d="M17 21v-6c0-4 3-7 6-7" />
    <path d="M23 8c1-1 3-1 3 1-1 1-3 1-3-1Z" />
    <path d="M12 14c1-3 3-5 5-5" />
    <path d="M7 21v2M22 21v2" />
  </>,
);

/** 兔：长耳、圆身 */
export const RabbitIcon = base(
  <>
    <path d="M13 4c-1 3-1 6 0 9" />
    <path d="M19 4c1 3 1 6 0 9" />
    <path d="M9 16c0-4 3-7 7-7s7 3 7 7c0 3-2 5-7 5s-7-2-7-5Z" />
    <circle cx="13" cy="15" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="15" r="1" fill="currentColor" stroke="none" />
    <path d="M15 18h2" />
  </>,
);

/** 鹅：长颈、身体 */
export const GooseIcon = base(
  <>
    <path d="M9 22c0-3 2-5 7-5s7 2 7 5" />
    <path d="M16 17V8c0-2 1-3 3-3s2 1 2 3" />
    <path d="M21 8c1 0 2 .5 2 1.5-.5.5-1.5.5-2 .5" />
    <circle cx="19" cy="9" r="1" fill="currentColor" stroke="none" />
    <path d="M12 22v3M20 22v3" />
  </>,
);

/** 鸽：鸟身、冠羽 */
export const PigeonIcon = base(
  <>
    <path d="M8 20c0-5 3-9 8-9s7 4 7 9c0 2-1 3-3 3H11c-2 0-3-1-3-3Z" />
    <path d="M16 11c0-2 1-4 3-4" />
    <path d="M23 16c2 0 3-1 3-2-1 0-2 .5-3 1" />
    <circle cx="20" cy="13" r="1" fill="currentColor" stroke="none" />
    <path d="M13 23v3M18 23v3" />
  </>,
);

/** 其他：爪印 */
export const OtherIcon = base(
  <>
    <ellipse cx="16" cy="20" rx="5" ry="4" />
    <circle cx="10" cy="13" r="2" />
    <circle cx="16" cy="11" r="2" />
    <circle cx="22" cy="13" r="2" />
  </>,
);

/** 驴：长耳、矮身、鬃毛 */
export const DonkeyIcon = base(
  <>
    <path d="M10 7c-2 1-3 4-3 7 0 4 3 7 8 7s8-3 8-7c0-3-1-6-3-7" />
    <path d="M7 6c-1 2-1 4 0 6 1-1 1-4 0-6Z" />
    <path d="M19 6c1 2 1 4 0 6-1-1-1-4 0-6Z" />
    <path d="M11 20c1 1 3 2 5 2s4-1 5-2" />
    <circle cx="13" cy="14" r="1" fill="currentColor" stroke="none" />
    <circle cx="19" cy="14" r="1" fill="currentColor" stroke="none" />
    <path d="M14 22v3M18 22v3" />
  </>,
);

/** 鹿：鹿角、长脸 */
export const DeerIcon = base(
  <>
    <path d="M16 13c-3 0-5 2-5 5s2 5 5 5 5-2 5-5-2-5-5-5Z" />
    <path d="M13 8c-2-2-4-2-5 0 1 1 2 2 4 2" />
    <path d="M19 8c2-2 4-2 5 0-1 1-2 2-4 2" />
    <path d="M13 8v5M19 8v5" />
    <circle cx="14" cy="17" r="1" fill="currentColor" stroke="none" />
    <circle cx="18" cy="17" r="1" fill="currentColor" stroke="none" />
    <path d="M15 20h2" />
  </>,
);

/** 蜂：身体条纹、双翅、触角 */
export const BeeIcon = base(
  <>
    <ellipse cx="16" cy="19" rx="5" ry="7" />
    <path d="M11 17h10M11 21h10" />
    <path d="M11 13c-3-3-7-3-8 0 1 3 5 4 8 2" />
    <path d="M21 13c3-3 7-3 8 0-1 3-5 4-8 2" />
    <path d="M14 12c0-2 .5-4 1-5M18 12c0-2-.5-4-1-5" />
  </>,
);

/** 特种畜禽：兽爪与羽迹组合 */
export const SpecialIcon = base(
  <>
    <ellipse cx="13" cy="21" rx="4.5" ry="3.5" />
    <circle cx="8" cy="15" r="1.8" />
    <circle cx="13" cy="13" r="1.8" />
    <circle cx="18" cy="15" r="1.8" />
    <path d="M21 22c2-1 3-3 3-5 0-1-.5-2-1.5-2.5" />
    <path d="M23 25c1.5-.5 2.5-1.5 3-3" />
  </>,
);

export const categorySvgIcons: Record<string, React.FC<IconProps>> = {
  猪: PigIcon,
  牛: CattleIcon,
  羊: SheepIcon,
  鸡: ChickenIcon,
  鸭: DuckIcon,
  马: HorseIcon,
  驴: DonkeyIcon,
  骆驼: CamelIcon,
  兔: RabbitIcon,
  鹅: GooseIcon,
  鸽: PigeonIcon,
  鹿: DeerIcon,
  蜂: BeeIcon,
  特种畜禽: SpecialIcon,
  其他: OtherIcon,
};

export function getCategorySvgIcon(category: string): React.FC<IconProps> {
  return categorySvgIcons[category] ?? OtherIcon;
}

/** 渲染统一风格的 SVG 简笔画品种类别图标，与左侧导航栏使用同一套 SVG */
export function renderCategorySvgIcon(category: string, color: string, size = 28): React.ReactNode {
  const Icon = getCategorySvgIcon(category);
  return <Icon style={{ color, width: size, height: size }} />;
}