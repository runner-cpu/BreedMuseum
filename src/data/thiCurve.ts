/**
 * THI 曲线采样：给首页叙事屏（屏②）提供“用真实模型算出来的”曲线数据。
 *
 * 只做一件事：固定湿度，按温度采样原始 THI，并按畜种阈值切分等级。
 * 曲线是模型输出，不是手画的示意，因此可以与决策台互相印证。
 */
import { SPECIES_CONFIG, type PastureSpecies, type StressLevel } from './pastureThi';

/** THI 原始公式（无海拔 / 畜龄修正），与决策台展示的公式完全一致 */
export const rawThi = (temperature: number, humidity: number): number =>
  temperature - (0.55 - 0.55 * (humidity / 100)) * (temperature - 14.5);

export interface CurvePoint {
  /** 摄氏温度 */
  t: number;
  /** 该温度下的原始 THI */
  thi: number;
  level: StressLevel;
}

export interface ThiCurve {
  points: CurvePoint[];
  minT: number;
  maxT: number;
  minThi: number;
  maxThi: number;
  /** 各等级在本曲线上的起止温度（用于文案与阈值标注） */
  crossings: Array<{ level: StressLevel; from: number | null; to: number | null }>;
}

export const classify = (thi: number, species: PastureSpecies): StressLevel => {
  const cfg = SPECIES_CONFIG[species];
  if (thi < cfg.comfortMax) return 'comfort';
  if (thi < cfg.alertMax) return 'alert';
  if (thi < cfg.extremeFrom) return 'danger';
  return 'extreme';
};

/**
 * 采样一条 THI 曲线。
 * @param species 畜种（决定阈值）
 * @param humidity 固定湿度（%）
 * @param minT / maxT 温度采样区间
 * @param steps 采样点数（含两端）
 */
export const sampleThiCurve = (
  species: PastureSpecies,
  humidity = 60,
  minT = 0,
  maxT = 35,
  steps = 36,
): ThiCurve => {
  const points: CurvePoint[] = [];
  for (let i = 0; i < steps; i += 1) {
    const t = minT + ((maxT - minT) * i) / (steps - 1);
    const thi = rawThi(t, humidity);
    points.push({ t: Number(t.toFixed(2)), thi: Number(thi.toFixed(2)), level: classify(thi, species) });
  }

  const thiValues = points.map((p) => p.thi);
  const order: StressLevel[] = ['comfort', 'alert', 'danger', 'extreme'];
  const crossings = order.map((level) => {
    const atLevel = points.filter((p) => p.level === level);
    return {
      level,
      from: atLevel.length ? atLevel[0].t : null,
      to: atLevel.length ? atLevel[atLevel.length - 1].t : null,
    };
  });

  return {
    points,
    minT,
    maxT,
    minThi: Math.min(...thiValues),
    maxThi: Math.max(...thiValues),
    crossings,
  };
};
