import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicPath = (name: string) => resolve(process.cwd(), 'public', name);

describe('static discovery assets', () => {
  it.each(['robots.txt', 'sitemap.xml', 'site.webmanifest', 'privacy.html'])('%s exists and is non-empty', (name) => {
    const content = readFileSync(publicPath(name), 'utf8');
    expect(content.trim().length).toBeGreaterThan(20);
  });

  it('sitemap points at the public Pages origin and the current routes', () => {
    const sitemap = readFileSync(publicPath('sitemap.xml'), 'utf8');
    expect(sitemap).toContain('runner-cpu.github.io/BreedMuseum');
    expect(sitemap).toContain('https://runner-cpu.github.io/BreedMuseum/audit/');
    expect(sitemap).toContain('https://runner-cpu.github.io/BreedMuseum/privacy.html');
    // 地图、百科、数据看板、品种对比 + 互动厅总览与三个装置子页；百科详情按需生成，不进 sitemap
    expect(sitemap).toContain('#/encyclopedia');
    expect(sitemap).toContain('#/explore');
    expect(sitemap).toContain('#/dashboard');
    expect(sitemap).toContain('#/compare');
    expect(sitemap).toContain('#/arcade');
    for (const exhibit of ['find-home', 'identify', 'quiz']) {
      expect(sitemap).toContain('#/arcade/' + exhibit);
    }
    // 已移除页面与兼容旧路由不进入 sitemap
    for (const legacy of ['#/about', '#/breed/']) {
      expect(sitemap).not.toContain(legacy);
    }
  });
});
