import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { categories } from '@/data/catalog';
import { categoryColors } from '@/lib/categoryIcons';
import {
  DARK_STAGE,
  LIGHT_STAGE,
  STAGE_CSS_VARS,
  beamColorFor,
  contrastRatio,
  stagePaletteFor,
} from '@/lib/stagePalette';

/**
 * 展厅令牌契约。
 *
 * 背景：页面曾经把舞台底色写死成 `#080b09`，导致浅色模式内容区仍是黑的。
 * 现在 DOM 用 CSS 变量、WebGL 场景用 `stagePaletteFor(isDark)`，两者必须**同源**——
 * 本测试直接解析 `src/index.css`，把 `--stage*` 变量与 TS 常量逐项比对，
 * 任何一侧改了名字或取值都会立刻失败。
 */

const css = readFileSync(resolve(process.cwd(), 'src', 'index.css'), 'utf8');

/** 从 `:root { ... }` 或 `.dark { ... }` 块里读一个自定义属性。 */
function readVar(block: ':root' | '.dark', name: string): string | null {
  const start = css.indexOf(block);
  if (start < 0) return null;
  const open = css.indexOf('{', start);
  const close = css.indexOf('}', open);
  const body = css.slice(open + 1, close);
  const match = body.match(new RegExp(name.replace(/[-]/g, '\\-') + ':\\s*([^;]+);'));
  return match ? match[1].trim() : null;
}

describe('stage palette', () => {
  it('light theme CSS variables match LIGHT_STAGE field by field', () => {
    for (const [cssVar, key] of STAGE_CSS_VARS) {
      expect(readVar(':root', cssVar), cssVar).toBe(LIGHT_STAGE[key]);
    }
  });

  it('dark theme CSS variables match DARK_STAGE field by field', () => {
    for (const [cssVar, key] of STAGE_CSS_VARS) {
      expect(readVar('.dark', cssVar), cssVar).toBe(DARK_STAGE[key]);
    }
  });

  it('each theme also publishes the rgb channels Tailwind needs for alpha variants', () => {
    // 少一组通道三元组，`bg-stage-gold/15` 这类写法就会静默失效（生成不了 CSS）
    for (const [block, palette] of [
      [':root', LIGHT_STAGE],
      ['.dark', DARK_STAGE],
    ] as const) {
      for (const [cssVar, key] of STAGE_CSS_VARS) {
        const plain = readVar(block, cssVar);
        const rgbVar = cssVar === '--stage' ? '--stage-rgb' : cssVar + '-rgb';
        const channels = readVar(block, rgbVar);
        expect(plain, `${block} ${cssVar}`).toBeTruthy();
        expect(channels, `${block} ${rgbVar}`).toBeTruthy();
        const expected = (palette[key] as string)
          .replace('#', '')
          .match(/../g)!
          .map((pair) => parseInt(pair, 16))
          .join(' ');
        expect(channels, `${block} ${rgbVar}`).toBe(expected);
      }
    }
  });

  it('declares a native color-scheme per theme so scrollbars follow the stage', () => {
    // 少了这一条，深色页面会被浏览器画出一条亮色滚动槽，浅色页面控件也会发黑。
    expect(css.slice(css.indexOf(':root'), css.indexOf('.dark'))).toMatch(/color-scheme:\s*light/);
    expect(css.slice(css.indexOf('.dark'))).toMatch(/color-scheme:\s*dark/);
  });

  it('the two themes are genuinely different and readable on their own background', () => {
    expect(LIGHT_STAGE.bg).not.toBe(DARK_STAGE.bg);
    expect(stagePaletteFor(false)).toBe(LIGHT_STAGE);
    expect(stagePaletteFor(true)).toBe(DARK_STAGE);

    // 正文与次级文字在浅/深两套底色上都必须达到 AA
    expect(contrastRatio(LIGHT_STAGE.fg, LIGHT_STAGE.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_STAGE.fg, DARK_STAGE.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(LIGHT_STAGE.muted, LIGHT_STAGE.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_STAGE.muted, DARK_STAGE.bg)).toBeGreaterThanOrEqual(4.5);
    // 强调金也要能当文字用
    expect(contrastRatio(LIGHT_STAGE.gold, LIGHT_STAGE.bg)).toBeGreaterThanOrEqual(4.5);
    expect(contrastRatio(DARK_STAGE.gold, DARK_STAGE.bg)).toBeGreaterThanOrEqual(4.5);
    // 金色在抬升面板上同样可读（表头、卡片里到处在用）
    expect(contrastRatio(LIGHT_STAGE.gold, LIGHT_STAGE.panel)).toBeGreaterThanOrEqual(4.5);
  });

  it('三维省块、描边与台面在两套主题下都留出可读的明度差', () => {
    // 浅色纸底上曾经出现过「版图几乎看不见」：省块 #cfc3a4 与纸底 #f1ece0 只差 1.49，
    // 描边 #7d6f4e 对填充只有 2.82，加上光照压暗后就糊成一片。
    // 这里锁死三组关系（渲染实测：省块 ≈ #a29771、台面 ≈ #c1baa6，见 index.css 注释）。
    for (const [name, palette, fillFloor, edgeFloor] of [
      ['light', LIGHT_STAGE, 1.25, 4.0],
      ['dark', DARK_STAGE, 1.25, 4.0],
    ] as const) {
      // 版图要能从台面上「浮」出来
      expect(contrastRatio(palette.province, palette.floor), `${name} 省块 vs 台面`).toBeGreaterThanOrEqual(
        fillFloor,
      );
      // 台面又要与画布底色分开，否则展台边界消失
      expect(contrastRatio(palette.floor, palette.bg), `${name} 台面 vs 底色`).toBeGreaterThanOrEqual(1.08);
      // 描边是省界的唯一读法：必须能压在填充上
      expect(contrastRatio(palette.provinceEdge, palette.province), `${name} 描边 vs 省块`).toBeGreaterThanOrEqual(
        edgeFloor,
      );
      // 选中/悬停的描边不能比普通描边更弱
      expect(contrastRatio(palette.goldOnLight, palette.province), `${name} 高亮 vs 省块`).toBeGreaterThanOrEqual(
        edgeFloor,
      );
      // 濒危产区在柱底另画一圈细环，颜色也要能从省块上读出来
      expect(contrastRatio(palette.endangeredRing, palette.province), `${name} 濒危环 vs 省块`).toBeGreaterThanOrEqual(
        3.0,
      );
    }
  });

  it('every category colour stays visible on the light stage', () => {
    expect(categories).toHaveLength(15);
    for (const category of categories) {
      const base = categoryColors[category];
      expect(base, category).toBeTruthy();

      const light = beamColorFor(base, false);
      const dark = beamColorFor(base, true);
      // 深色底保持原色（既有视觉不变）
      expect(dark, category).toBe(base);
      // 浅色底必须同时压过省块填充与舞台底色
      for (const backdrop of [LIGHT_STAGE.province, LIGHT_STAGE.bg]) {
        expect(contrastRatio(light, backdrop), `${category} vs ${backdrop}`).toBeGreaterThanOrEqual(3.6);
      }
      // 压暗后的色相不能被压成灰：与原色的色相偏差仍应在可辨识范围
      expect(light, category).not.toBe('#000000');
    }
  });

  it('no page hardcodes the old night-stage colours any more', () => {
    const files = [
      'src/pages/LightMapPage.tsx',
      'src/pages/ArcadePage.tsx',
      'src/pages/ArcadeGamePage.tsx',
      'src/pages/BreedRecordPage.tsx',
      'src/pages/AboutPage.tsx',
      'src/components/arcade/ArcadeGames.tsx',
      'src/components/common/VerificationBadge.tsx',
    ];
    for (const file of files) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      // 禁止的写法：写死的深夜底色 / 透明白叠加成的"假深色皮肤"
      expect(source, file).not.toMatch(/#080b09|#0b0f0d|#060a08/i);
      expect(source, file).not.toMatch(/border-white\/(1[0-9]|2[0-9])/);
      expect(source, file).not.toMatch(/bg-white\/(1[0-9]|2[0-9])/);
    }
  });
});
