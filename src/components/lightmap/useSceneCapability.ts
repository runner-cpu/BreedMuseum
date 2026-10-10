/**
 * 场景能力探测（只在浏览器执行；SSR/测试环境按「不可用」处理）。
 * 每个结论缓存一次，避免每次渲染都创建临时 canvas。
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

let cachedSoftware: boolean | null = null;

/**
 * 是否落在「软件光栅」的 WebGL 后端上（SwiftShader / llvmpipe / 纯软栈）。
 *
 * 为什么要分辨：这个场景有两处装饰性开销是给真 GPU 花的——接触阴影每帧会把
 * 整个场景重画一遍再做两次全屏模糊，柱体的半透明混合也要整屏合成。有 GPU 时它们几乎免费，
 * 但在无显卡的 CI runner（Chromium 的 SwiftShader）上，实测页面只能跑到 8–9 fps，
 * 连点击都因为主线程被帧占满而超时。识别出软栈后降级掉这两处装饰。
 */
export function detectSoftwareRenderer(): boolean {
  if (typeof document === 'undefined') return false;
  if (cachedSoftware !== null) return cachedSoftware;
  try {
    const canvas = document.createElement('canvas');
    const context = (canvas.getContext('webgl2') ?? canvas.getContext('webgl')) as WebGLRenderingContext | null;
    const info = context?.getExtension('WEBGL_debug_renderer_info');
    const renderer = info && context ? String(context.getParameter(info.UNMASKED_RENDERER_WEBGL) ?? '') : '';
    cachedSoftware = /swiftshader|llvmpipe|softpipe|software|basic render/i.test(renderer);
  } catch {
    cachedSoftware = false;
  }
  return cachedSoftware;
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
