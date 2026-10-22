import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createElement, useEffect, useMemo, useRef, type RefObject } from 'react';
import './ScrollFloat.css';

gsap.registerPlugin(ScrollTrigger);

type HeadingTag = 'h1' | 'h2' | 'h3' | 'p' | 'span';

export interface ScrollFloatProps {
  children: string;
  /** 自定义滚动容器；不传则自动寻找最近的纵向滚动祖先（本站为 `main`） */
  scrollContainerRef?: RefObject<HTMLElement | null>;
  containerClassName?: string;
  textClassName?: string;
  animationDuration?: number;
  ease?: string;
  scrollStart?: string;
  scrollEnd?: string;
  stagger?: number;
  /** 渲染标签，默认 h2；页面已有一级标题时传 h3/p 保持标题层级正确 */
  as?: HeadingTag;
  /** 首屏标题用一次性入场；默认自动判断是否已在视口内 */
  once?: boolean;
  /** 供 `aria-labelledby` 引用的锚点 */
  id?: string;
  /** 纯装饰：由外层标题提供可读名称时，避免重复朗读 */
  decorative?: boolean;
}

/** 找到最近的可滚动祖先；找不到时返回 null。 */
const resolveScroller = (el: HTMLElement): HTMLElement | null => {
  let node = el.parentElement;
  while (node) {
    const style = getComputedStyle(node);
    const scrollable = /(auto|scroll)/.test(style.overflowY);
    if (scrollable && node.scrollHeight > node.clientHeight + 1) return node;
    node = node.parentElement;
  }
  return null;
};

/**
 * 滚动逐字浮现标题。
 *
 * 与原始片段的差异：
 * - 自动寻找本站真正的滚动容器（`<main>`），否则 ScrollTrigger 监听 window 永远不触发；
 * - 已经位于首屏的标题改用一次性入场，避免打开页面时停在半透明状态；
 * - `prefers-reduced-motion` 下直接显示最终状态，不建立 ScrollTrigger；
 * - 视觉字符对读屏隐藏、用 `aria-label` 提供整句，避免逐字朗读；
 * - 组件卸载时 kill 掉自己的补间与 ScrollTrigger，避免路由切换后残留。
 */
const ScrollFloat = ({
  children,
  scrollContainerRef,
  containerClassName = '',
  textClassName = '',
  animationDuration = 0.9,
  ease = 'back.inOut(2)',
  scrollStart = 'top bottom-=10%',
  scrollEnd = 'bottom bottom-=30%',
  stagger = 0.03,
  as = 'h2',
  once = false,
  id,
  decorative = false,
}: ScrollFloatProps) => {
  const containerRef = useRef<HTMLElement>(null);

  const splitText = useMemo(
    () =>
      children.split('').map((char, index) => (
        <span className="scroll-float-char" key={`${char}-${index}`} aria-hidden="true">
          {char === ' ' ? '\u00A0' : char}
        </span>
      )),
    [children],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;
    const chars = el.querySelectorAll('.scroll-float-char');
    if (!chars.length) return undefined;

    const reduceMotion =
      typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) {
      gsap.set(chars, { opacity: 1, yPercent: 0, scaleX: 1, scaleY: 1 });
      return undefined;
    }

    const from = { opacity: 0, yPercent: 90, scaleY: 1.9, scaleX: 0.75, transformOrigin: '50% 0%' };
    const to = { duration: animationDuration, ease, opacity: 1, yPercent: 0, scaleY: 1, scaleX: 1, stagger };

    const scroller = scrollContainerRef?.current ?? resolveScroller(el);
    const rect = el.getBoundingClientRect();
    const startsInView = rect.top < window.innerHeight * 0.92 && rect.bottom > 0;

    // 首屏标题没有滚动行程可用，直接播放入场；其余标题交给 ScrollTrigger。
    if (!scroller || startsInView || once) {
      const tween = gsap.fromTo(chars, from, to);
      return () => tween.kill();
    }

    const tween = gsap.fromTo(chars, from, {
      ...to,
      scrollTrigger: { trigger: el, scroller, start: scrollStart, end: scrollEnd, scrub: 0.6 },
    });

    return () => {
      tween.scrollTrigger?.kill();
      tween.kill();
    };
  }, [children, scrollContainerRef, animationDuration, ease, scrollStart, scrollEnd, stagger, once]);

  return createElement(
    as,
    {
      ref: containerRef,
      className: `scroll-float ${containerClassName}`.trim(),
      ...(decorative ? { 'aria-hidden': true } : { 'aria-label': children }),
      id,
    },
    <span className={`scroll-float-text ${textClassName}`.trim()}>{splitText}</span>,
  );
};

export default ScrollFloat;
