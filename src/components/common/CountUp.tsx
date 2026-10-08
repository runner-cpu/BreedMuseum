import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

interface CountUpProps {
  /** 最终展示的数字（动画结束后恒为该值） */
  end: number;
  /** 计数动画时长（毫秒）；<=0 或系统偏好减少动画时直接显示终值 */
  duration?: number;
}

const prefersReducedMotion = (): boolean =>
  typeof window !== 'undefined' &&
  typeof window.matchMedia === 'function' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * 数字滚动展示（安全版）。
 *
 * 与旧实现的差异：动画在挂载时立即开始，不依赖 IntersectionObserver
 * （旧版在自定义滚动容器/截图/后台标签页下观察器不触发，数字停在 0），
 * 且带 setTimeout 兜底：无论 rAF 是否被浏览器暂停（后台标签页等），
 * duration + 150ms 后一定落到真实终值。系统开启"减少动画"时直接显示终值。
 */
const CountUp: React.FC<CountUpProps> = ({ end, duration = 900 }) => {
  const reduced = useRef(prefersReducedMotion());
  const [value, setValue] = useState(end);

  // 首帧渲染终值，避免服务端/无 JS 环境下出现空数字
  useLayoutEffect(() => {
    if (reduced.current || !Number.isFinite(end) || duration <= 0) {
      setValue(end);
      return;
    }
    let raf = 0;
    let finished = false;
    const startTime = performance.now();
    setValue(0);
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startTime) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(end * eased));
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      } else {
        finished = true;
      }
    };
    raf = requestAnimationFrame(tick);
    // rAF 在后台标签页会被暂停；兜底保证终值一定出现
    const fallback = window.setTimeout(() => {
      if (!finished) {
        cancelAnimationFrame(raf);
        setValue(end);
      }
    }, duration + 150);
    return () => {
      cancelAnimationFrame(raf);
      clearTimeout(fallback);
    };
  }, [end, duration]);

  // 组件在动画结束前被再次观察时，终值兜底
  useEffect(() => {
    if (value !== end && (reduced.current || duration <= 0)) setValue(end);
  }, [end, duration, value]);

  return <span className="tabular-nums">{value}</span>;
};

export default CountUp;
