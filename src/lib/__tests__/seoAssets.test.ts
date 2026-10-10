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
    // 互动厅总览 + 三个装置子页 / 馆史与库房；档案页按需生成，不进 sitemap
    expect(sitemap).toContain('#/arcade');
    for (const exhibit of ['find-home', 'identify', 'quiz']) {
      expect(sitemap).toContain('#/arcade/' + exhibit);
    }
    expect(sitemap).toContain('#/about');
    // 旧路由已重定向，不再出现在 sitemap
    for (const legacy of ['#/map', '#/encyclopedia', '#/dashboard', '#/compare']) {
      expect(sitemap).not.toContain(legacy);
    }
  });
});
