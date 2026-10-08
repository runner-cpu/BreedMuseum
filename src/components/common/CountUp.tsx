import React from 'react';

interface CountUpProps {
  /** 最终展示的数字（组件始终渲染该真实值） */
  end: number;
  /** 保留的调用接口兼容位；当前实现不再使用归零计数动画 */
  duration?: number;
}

/**
 * 数值展示组件（稳定版）。
 *
 * 历史实现从 0 开始计数、依赖 IntersectionObserver 触发动画；在整页截图、
 * 后台标签页暂停 requestAnimationFrame、观察器未触达或自定义滚动容器等
 * 场景下，数字会停留在初始值 0，出现“首屏数据看板显示 0”的展示事故。
 * 展示准确性优先于计数动效，因此组件始终渲染真实终值，不再归零动画。
 */
const CountUp: React.FC<CountUpProps> = ({ end }) => (
  <span className="tabular-nums">{end}</span>
);

export default CountUp;
