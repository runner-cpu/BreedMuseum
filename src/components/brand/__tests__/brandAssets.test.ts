import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';

const files = ['museum-mark.svg', 'museum-wordmark.svg', 'favicon.svg', 'breed-placeholder.svg'];

for (const name of files) {
  it(`${name} is a self-contained titled SVG`, () => {
    const svg = readFileSync(join(process.cwd(), 'public', 'brand', name), 'utf8');
    expect(svg).toMatch(/^<svg[^>]+viewBox=/);
    expect(svg).toMatch(/<title>/);
    expect(svg).not.toMatch(/<script|javascript:|<foreignObject|https?:\/\/(?!www\.w3\.org\/2000\/svg)/i);
  });
}
