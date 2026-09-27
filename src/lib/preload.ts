import type { Breed } from '@/data/breeds';

// 图片预加载缓存：已加载的图片URL集合，避免重复请求
const loadedSet = new Set<string>();

/**
 * 预加载单个图片URL到浏览器缓存。
 * 返回 Promise，resolve 表示加载完成（成功或失败均 resolve，避免阻塞）。
 */
export function preloadImage(url: string): Promise<void> {
  if (!url || loadedSet.has(url)) return Promise.resolve();
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      loadedSet.add(url);
      resolve();
    };
    img.onerror = () => {
      resolve();
    };
    img.src = url;
  });
}

/**
 * 批量预加载品种图片（默认并发限制）。
 */
export function preloadBreedImages(breeds: Breed[], limit?: number): Promise<void[]> {
  const list = typeof limit === 'number' ? breeds.slice(0, limit) : breeds;
  return Promise.all(list.map((b) => preloadImage(b.image)));
}

export function isImagePreloaded(url: string): boolean {
  return loadedSet.has(url);
}