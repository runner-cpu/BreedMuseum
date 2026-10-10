/**
 * 展厅调色板（浅色 / 深色两套），DOM 与 WebGL 共用的唯一色彩事实源。
 *
 * 为什么需要它：页面曾经把舞台底色写死成 `#080b09`，导致浅色模式下内容区仍是黑的；
 * 3D 场景也各自硬编码颜色。现在两套令牌集中在这里，并同步注入 CSS 变量
 * （`--stage*`，见 `src/index.css` 的说明注释与 `stagePalette.test.ts` 的漂移断言），
 * 于是 DOM 上的 `bg-stage` 与三维场景里的省块 / 光束永远同一套颜色。
 */

export interface StagePalette {
  /** 页面舞台底色 = 三维场景画布底色 */
  bg: string;
  /** 抬升面板（卡片、面板、抽屉） */
  panel: string;
  /** 更低一层的内嵌块（表格行、代码块） */
  soft: string;
  border: string;
  /** 主文字 */
  fg: string;
  /** 次级文字 */
  muted: string;
  /** 强调金（浅色下加深，保证纸底对比度） */
  gold: string;
  /** 三维专用：浅色舞台上「够金但够深」的高亮色（选中/悬停的光束用它） */
  goldOnLight: string;
  /** 三维：省块填充 / 自发光 / 描边 */
  province: string;
  provinceEmissive: string;
  provinceEdge: string;
  /** 三维：含编辑口径濒危记录的产区，束底一圈细环用色（须能在省块上读出） */
  endangeredRing: string;
  /** 三维：展台台面（三维场景里的“桌面”，让版图不是浮在虚空里） */
  floor: string;
  /** 三维：雾密度与阴影色 */
  fogDensity: number;
  shadow: string;
  /**
   * 深 / 浅主题判别位（也是三维材质档位）：深色底 = 'additive'，浅色底 = 'normal'。
   *
   * 它同时决定光束的**混合方式**：深色底用加性混合，越叠越亮，密集区自然积出光晕，
   * 这是“光”的读法来源；浅色底必须退回正常混合，否则加性混合会把颜色洗成白色。
   */
  beamBlending: 'additive' | 'normal';
  /** 三维：光束整体不透明度（深色底留一点余量，做呼吸动画的基准值） */
  beamOpacity: number;
  /** 三维：星尘（浅色底改为纸面颗粒） */
  stardust: string;
  stardustOpacity: number;
  stardustCount: number;
}

export const DARK_STAGE: StagePalette = {
  bg: '#0a100e',
  panel: '#121a16',
  soft: '#0e1512',
  border: '#2a3831',
  fg: '#eef2ec',
  muted: '#a8b6ac',
  gold: '#d4a853',
  goldOnLight: '#d4a853',
  province: '#2c4636',
  provinceEmissive: '#40705a',
  provinceEdge: '#86b79a',
  endangeredRing: '#d98a4a',
  floor: '#131c18',
  fogDensity: 0.032,
  shadow: '#050807',
  beamBlending: 'additive',
  beamOpacity: 0.95,
  stardust: '#9fb8a8',
  stardustOpacity: 0.5,
  stardustCount: 600,
};

export const LIGHT_STAGE: StagePalette = {
  bg: '#f1ece0',
  panel: '#fbf8f0',
  soft: '#e9e2d2',
  border: '#d3c8ae',
  fg: '#173b2c',
  muted: '#5c6b60',
  gold: '#845c10',
  goldOnLight: '#5e4108',
  province: '#c2ad78',
  provinceEmissive: '#6f7f68',
  provinceEdge: '#3f3627',
  endangeredRing: '#8a3a12',
  /**
   * 展台台面。比省块更深一档（对纸底 1.21，原 `#e6dcc4` 只有 1.16）：
   * 浅色底上省块与台面本来就只差 1.5 左右，台面再浅就与画面底色糊在一起，
   * 展台边界消失、整块版图看着浮在纸里。
   */
  floor: '#e2d7bb',
  fogDensity: 0.008,
  shadow: '#6b6252',
  beamBlending: 'normal',
  beamOpacity: 1,
  stardust: '#9a8f79',
  stardustOpacity: 0.18,
  stardustCount: 220,
};

/* ------------------------------------------------------------------ */
/* 浅色底上的可读色：把亮色种类色压到与纸底/省块有足够对比                */
/* ------------------------------------------------------------------ */

const hexToRgb = (hex: string): [number, number, number] => {
  const value = hex.replace('#', '');
  return [0, 2, 4].map((offset) => parseInt(value.slice(offset, offset + 2), 16)) as [number, number, number];
};

const rgbToHex = (rgb: readonly number[]): string =>
  '#' + rgb.map((value) => Math.round(Math.max(0, Math.min(255, value))).toString(16).padStart(2, '0')).join('');

const mix = (a: string, b: string, t: number): string => {
  const [ar, ag, ab] = hexToRgb(a);
  const [br, bg, bb] = hexToRgb(b);
  return rgbToHex([ar + (br - ar) * t, ag + (bg - ag) * t, ab + (bb - ab) * t]);
};

/** WCAG 相对亮度。 */
export const relativeLuminance = (hex: string): number => {
  const channels = hexToRgb(hex)
    .map((value) => value / 255)
    .map((value) => (value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
};

/** WCAG 对比度（1–21）。 */
export const contrastRatio = (a: string, b: string): number => {
  const [hi, lo] = [relativeLuminance(a), relativeLuminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

const LIGHT_INK = '#123326';

const rgbToHsl = (hex: string): [number, number, number] => {
  const [r, g, b] = hexToRgb(hex).map((value) => value / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const lightness = (max + min) / 2;
  if (max === min) return [0, 0, lightness];
  const delta = max - min;
  const saturation = lightness > 0.5 ? delta / (2 - max - min) : delta / (max + min);
  let hue: number;
  if (max === r) hue = (g - b) / delta + (g < b ? 6 : 0);
  else if (max === g) hue = (b - r) / delta + 2;
  else hue = (r - g) / delta + 4;
  return [hue / 6, saturation, lightness];
};

const hslToHex = (hue: number, saturation: number, lightness: number): string => {
  const channel = (offset: number): number => {
    const k = (offset + hue * 12) % 12;
    const a = saturation * Math.min(lightness, 1 - lightness);
    return lightness - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
  };
  return rgbToHex([channel(0), channel(8), channel(4)].map((value) => value * 255));
};

/**
 * 浅色底可读化：**保住色相与饱和度，只压明度**，直到与省块填充 / 台面 / 舞台底色
 * 都达到目标对比度；压到底仍不够时才退回「压向墨绿」的兜底路径。
 *
 * 为什么不能用「往墨绿里掺」：类别色板有 15 个色（`categoryIcons.ts`），
 * 明度轴本来就承担了一半的区分度——猪 `#FF6B81` 比骆驼 `#8B4513` 亮得多。
 * 混色会把所有颜色压到同一条深绿线上，实测 15 色的最小两两 RGB 距离从深色底的
 * 31.7 掉到 5.1（鸡/蜂、鸽/其他 几乎重合），光图上剩下的就是一片灰绿。
 * 改成「只动 L、保留 H/S」并按原明度在达标线内线性留出行次后，
 * 15 色仍能读出彼此，且最弱一类对省块的对比还有 4.1（目标 3.6）。
 *
 * 深色模式下按原色返回，保持既有视觉；算法与阈值由
 * `src/lib/__tests__/stagePalette.test.ts` 对全部 15 类逐一断言。
 */
export function readableOnLight(hex: string, target = 3.6): string {
  const backdrops = [LIGHT_STAGE.province, LIGHT_STAGE.floor, LIGHT_STAGE.bg];
  const meets = (candidate: string) =>
    backdrops.every((backdrop) => contrastRatio(candidate, backdrop) >= target);
  if (meets(hex)) return hex;

  const [hue, saturation, lightness] = rgbToHsl(hex);
  /** 该色相/饱和度下「刚好达标」的最高明度。 */
  let cap: number | null = null;
  for (let l = 0.74; l >= 0.02; l -= 0.005) {
    if (meets(hslToHex(hue, saturation, l))) {
      cap = l;
      break;
    }
  }
  if (cap !== null) {
    // 明度下限压住「深色种类全糊成一团」，再按原明度在 [下限, cap] 里分出层次
    const floor = 0.1;
    const scaled = Math.max(floor, Math.min(cap, floor + lightness * (cap - floor)));
    return hslToHex(hue, saturation, scaled);
  }
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const candidate = mix(hex, LIGHT_INK, t);
    if (meets(candidate)) return candidate;
  }
  return mix(hex, LIGHT_INK, 0.95);
}

/** 按主题返回「能在该主题舞台上被看清」的种类色。 */
export const beamColorFor = (hex: string, isDark: boolean): string => (isDark ? hex : readableOnLight(hex));

/** CSS 变量名 → 令牌键，供 SettingsProvider 注入与测试比对。 */
export const STAGE_CSS_VARS: Array<[string, keyof StagePalette]> = [
  ['--stage', 'bg'],
  ['--stage-panel', 'panel'],
  ['--stage-soft', 'soft'],
  ['--stage-border', 'border'],
  ['--stage-fg', 'fg'],
  ['--stage-muted', 'muted'],
  ['--stage-gold', 'gold'],
];

export const stagePaletteFor = (isDark: boolean): StagePalette => (isDark ? DARK_STAGE : LIGHT_STAGE);
