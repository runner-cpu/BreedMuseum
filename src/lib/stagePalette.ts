/**
 * 展厅调色板（浅色 / 深色两套），DOM 与 SVG 光图共用的唯一色彩事实源。
 *
 * 为什么需要它：页面曾经把舞台底色写死成 `#080b09`，导致浅色模式下内容区仍是黑的；
 * 旧版场景曾各自硬编码颜色。现在两套令牌集中在这里，并同步注入 CSS 变量
 * （`--stage*`，见 `src/index.css` 的说明注释与 `stagePalette.test.ts` 的漂移断言），
 * 于是 DOM 上的 `bg-stage` 与 SVG 地图里的省块 / 产区环永远同一套颜色。
 *
 * 本轮配色修订（2026-10）：
 * - 旧浅色令牌是「宣纸 + 芥末金 + 橄榄绿」，大面积 #845c10 / #1d3a2d 让地图整块发黄发脏；
 *   现在改成「暖纸 + 墨绿 + 青铜 + 朱砂」：金色只做细节点缀，交互主色走墨绿 `accent`，
 *   「当前选择」走朱砂 `signal`，避免同一屏出现两种大面积暖黄。
 * - 深色令牌从发灰的墨绿提到近黑石墨绿，正文与面板之间拉开明度，地图省块不再糊成一片。
 */

export interface StagePalette {
  /** 页面舞台底色 = 光图画布底色 */
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
  /** 点缀金（眉题、序号、装饰线；不再承担大面积填充） */
  gold: string;
  /** 交互主色（按钮、链接、激活项） */
  accent: string;
  /** 压在 accent 上的前景色 */
  accentFg: string;
  /** 信号色（当前选择、错误提示）；只用于小面积状态 */
  signal: string;
  /** 浅色舞台上「够金但够深」的高亮色（选中/悬停的地图标记用它） */
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
   * 深 / 浅主题判别位（保留给需要叠加效果的视觉层）：深色底 = 'additive'，浅色底 = 'normal'。
   *
   * 它同时决定强调色的**混合方式**：深色底用加性混合，浅色底退回正常混合，
   * 避免在纸面上把类别色洗成白色。
   */
  beamBlending: 'additive' | 'normal';
  /** 叠加视觉层的整体不透明度基准 */
  beamOpacity: number;
  /** 三维：星尘（浅色底改为纸面颗粒） */
  stardust: string;
  stardustOpacity: number;
  stardustCount: number;
}

export const DARK_STAGE: StagePalette = {
  /**
   * 午夜藏蓝：参考原站的 `#0a0a1a` 夜空与 `#15203c` 卡片，
   * 把过去偏灰的墨绿换成更冷的蓝调，金色 `#D4A853` 才压得住。
   * 面板之间靠 4–6 个明度点分层，地图省块与画布能分开。
   */
  bg: '#0A0A1A',
  panel: '#15203C',
  soft: '#101827',
  border: '#2E3C5C',
  fg: '#F2EEE3',
  muted: '#AEB8C8',
  gold: '#D4A853',
  accent: '#9CC97A',
  accentFg: '#0B1524',
  signal: '#F0A184',
  goldOnLight: '#D8B26A',
  province: '#203354',
  provinceEmissive: '#3E5B84',
  provinceEdge: '#93ACCF',
  endangeredRing: '#E0925F',
  floor: '#131E33',
  fogDensity: 0.032,
  shadow: '#05070F',
  beamBlending: 'additive',
  beamOpacity: 0.95,
  stardust: '#AEBBD4',
  stardustOpacity: 0.5,
  stardustCount: 600,
};

export const LIGHT_STAGE: StagePalette = {
  /**
   * 宣纸暖米 + 黄铜：取自原站的 `#f5f0e8` 纸底与 `#d4a853` 金，
   * 省块用沙金而不是橄榄绿，地图与金色标题终于同一套色温。
   */
  bg: '#F5F0E8',
  panel: '#FBF7EF',
  soft: '#EDE4D3',
  border: '#D3C6AE',
  fg: '#232323',
  muted: '#5B5343',
  gold: '#8A5A18',
  accent: '#325016',
  accentFg: '#F7F2E6',
  signal: '#A4472F',
  goldOnLight: '#6B4410',
  province: '#D5C29B',
  provinceEmissive: '#8C7A4E',
  provinceEdge: '#5E4C2B',
  endangeredRing: '#9C3B22',
  /**
   * 展台台面。比省块更深一档：浅色底上省块与台面本来就只差 1.3 左右，
   * 台面再浅就与画面底色糊在一起，展台边界消失、整块版图看着浮在纸里。
   */
  floor: '#E8DCC4',
  fogDensity: 0.008,
  shadow: '#6B6252',
  beamBlending: 'normal',
  beamOpacity: 1,
  stardust: '#9A8F79',
  stardustOpacity: 0.18,
  stardustCount: 220,
};

/* ------------------------------------------------------------------ */
/* 可读色：把亮色种类色压到与纸底/省块有足够对比；暗色底则反向提亮       */
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
const DARK_INK = '#0B120F';

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
 * 混色会把所有颜色压到同一条深绿线上，15 色的最小两两 RGB 距离会大幅塌缩，
 * 光图上剩下的就是一片灰绿。改成「只动 L、保留 H/S」并按原明度在达标线内
 * 线性留出行次后，15 色仍能读出彼此。
 *
 * 深色模式走 `readableOnDark`：提升明度而不是保留原色——旧实现直接把品牌原色
 * 画到近黑画布上，骆驼 #8B4513、鸽 #708090 这类深色点位几乎看不见。
 */
export function readableOnLight(hex: string, target = 3.2): string {
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
    const floor = 0.24;
    const scaled = Math.max(floor, Math.min(cap, floor + lightness * (cap - floor)));
    return hslToHex(hue, saturation, scaled);
  }
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const candidate = mix(hex, LIGHT_INK, t);
    if (meets(candidate)) return candidate;
  }
  return mix(hex, LIGHT_INK, 0.95);
}

/** 深色底可读化：保持色相，逐步提亮，直到两种暗背景都读得清。 */
export function readableOnDark(hex: string, target = 3.2): string {
  const backdrops = [DARK_STAGE.province, DARK_STAGE.panel];
  const meets = (candidate: string) =>
    backdrops.every((backdrop) => contrastRatio(candidate, backdrop) >= target);
  if (meets(hex)) return hex;

  const [hue, saturation, lightness] = rgbToHsl(hex);
  for (let l = lightness; l <= 0.92; l += 0.005) {
    const candidate = hslToHex(hue, Math.min(1, saturation), l);
    if (meets(candidate)) return candidate;
  }
  for (let t = 0.05; t <= 0.95; t += 0.05) {
    const candidate = mix(hex, DARK_INK, t);
    if (meets(candidate)) return candidate;
  }
  return '#F2F6F0';
}

/** 按主题返回「能在该主题舞台上被看清」的种类色。 */
export const beamColorFor = (hex: string, isDark: boolean): string =>
  isDark ? readableOnDark(hex) : readableOnLight(hex);

/** CSS 变量名 → 令牌键，供 SettingsProvider 注入与测试比对。 */
export const STAGE_CSS_VARS: Array<[string, keyof StagePalette]> = [
  ['--stage', 'bg'],
  ['--stage-panel', 'panel'],
  ['--stage-soft', 'soft'],
  ['--stage-border', 'border'],
  ['--stage-fg', 'fg'],
  ['--stage-muted', 'muted'],
  ['--stage-gold', 'gold'],
  ['--stage-accent', 'accent'],
  ['--stage-accent-fg', 'accentFg'],
  ['--stage-signal', 'signal'],
];

export const stagePaletteFor = (isDark: boolean): StagePalette => (isDark ? DARK_STAGE : LIGHT_STAGE);
