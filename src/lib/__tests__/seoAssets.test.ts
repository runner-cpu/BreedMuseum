import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const publicPath = (name: string) => resolve(process.cwd(), 'public', name);

describe('static discovery assets', () => {
  it.each(['robots.txt', 'sitemap.xml', 'site.webmanifest', 'privacy.html'])('%s exists and is non-empty', (name) => {
    const content = readFileSync(publicPath(name), 'utf8');
    expect(content.trim().length).toBeGreaterThan(20);
  });

  it('sitemap points at the public Pages origin', () => {
    const sitemap = readFileSync(publicPath('sitemap.xml'), 'utf8');
    expect(sitemap).toContain('runner-cpu.github.io/BreedMuseum');
    expect(sitemap).toContain('https://runner-cpu.github.io/BreedMuseum/audit/');
    expect(sitemap).toContain('https://runner-cpu.github.io/BreedMuseum/privacy.html');
    expect(sitemap).not.toContain('#/about');
  });
});
