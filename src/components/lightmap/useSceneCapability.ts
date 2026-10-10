/**
 * WebGL 可用性探测（只在浏览器执行；SSR/测试环境返回 false）。
 * 结果缓存一次，避免每次渲染都创建临时 canvas。
 */
import { useEffect, useState } from 'react';

let cached: boolean | null = null;

export function detectWebGL(): boolean {
  if (typeof document === 'undefined') return false;
  if (cached !== null) return cached;
  try {
    const canvas = document.createElement('canvas');
    const context =
      canvas.getContext('webgl2') ??
      canvas.getContext('webgl') ??
      canvas.getContext('experimental-webgl');
    cached = Boolean(context);
  } catch {
    cached = false;
  }
  return cached;
}

/** 尊重用户的动效偏好（E2E 全局 reducedMotion: 'reduce'）。 */
export function preferReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(preferReducedMotion);
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduced(query.matches);
    query.addEventListener('change', onChange);
    return () => query.removeEventListener('change', onChange);
  }, []);
  return reduced;
}
