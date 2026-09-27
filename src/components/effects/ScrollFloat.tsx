import { useEffect, useRef, useState } from 'react';

interface ScrollFloatProps {
  text: string;
  /** 字符逐个浮现的间隔（秒） */
  stagger?: number;
  className?: string;
}

/**
 * 滚动出现：文字进入视口时逐字上浮淡入。
 */
const ScrollFloat = ({ text, stagger = 0.04, className = '' }: ScrollFloatProps) => {
  const ref = useRef<HTMLSpanElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          io.disconnect();
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const chars = Array.from(text);

  return (
    <span ref={ref} className={className}>
      {chars.map((ch, i) => (
        <span
          key={i}
          className="inline-block will-change-transform"
          style={{
            transform: visible ? 'translateY(0)' : 'translateY(0.6em)',
            opacity: visible ? 1 : 0,
            transition: 'transform 0.6s cubic-bezier(0.2,0.8,0.2,1), opacity 0.6s ease',
            transitionDelay: `${i * stagger}s`,
          }}
        >
          {ch === ' ' ? '\u00A0' : ch}
        </span>
      ))}
    </span>
  );
};

export default ScrollFloat;