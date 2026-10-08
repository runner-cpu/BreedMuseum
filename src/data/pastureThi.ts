/**
 * 高原牧场环境决策台：THI（温湿指数）计算与应激分级。
 *
 * 公式：THI = T - (0.55 - 0.55 × RH) × (T - 14.5)
 *   T 为摄氏温度，RH 为相对湿度（0–1 小数）。该式是高原畜牧常用的
 *   简化温湿指数，用于分档评估热应激风险。
 *
 * 分级阈值按畜种冷热适应差异设定；海拔修正与畜龄修正用于把低气压、
 * 散热条件与个体耐受力纳入同一口径。所有参数为教学演示口径，
 * 管理建议仅供参考，不替代兽医与地方畜牧部门指导。
 */

export type PastureSpecies = 'yak' | 'sheep' | 'goat' | 'chicken' | 'pig' | 'horse' | 'camel';

export type StressLevel = 'comfort' | 'alert' | 'danger' | 'extreme';

export interface SpeciesConfig {
  id: PastureSpecies;
  /** 舒适上限（THI，低于该值为舒适） */
  comfortMax: number;
  /** 警戒上限（超过该值进入危险档） */
  alertMax: number;
  /** 极端档起点（超过该值进入极端档） */
  extremeFrom: number;
}

export interface ThiInput {
  species: PastureSpecies;
  /** 摄氏温度 */
  temperature: number;
  /** 相对湿度百分比（0–100） */
  humidity: number;
  /** 海拔（米） */
  altitude: number;
  /** 畜龄：成年 / 幼畜 / 老畜 */
  age: 'adult' | 'young' | 'old';
}

export interface ThiResult {
  /** 原始 THI（未修正） */
  base: number;
  /** 海拔与畜龄修正后的有效 THI */
  effective: number;
  level: StressLevel;
  species: SpeciesConfig;
  /** 使用的海拔修正量（有效值 = 原始 - 海拔修正 + 畜龄修正） */
  altitudeAdjustment: number;
  ageAdjustment: number;
  /** 附加提醒（低温、低氧等） */
  notes: string[];
}

export const SPECIES_CONFIG: Record<PastureSpecies, SpeciesConfig> = {
  // 阈值与本式量纲一致（RH=100% 时 THI≈气温；RH=0% 时 THI≈气温−0.55(T−14.5)，
  // 常见高原日间区间对应 8–30）。牦牛耐寒怕热，热应激阈值显著低于其他畜种。
  yak: { id: 'yak', comfortMax: 19, alertMax: 23, extremeFrom: 26 },
  sheep: { id: 'sheep', comfortMax: 21, alertMax: 25, extremeFrom: 28 },
  goat: { id: 'goat', comfortMax: 22, alertMax: 26, extremeFrom: 29 },
  chicken: { id: 'chicken', comfortMax: 24, alertMax: 28, extremeFrom: 31 },
  pig: { id: 'pig', comfortMax: 24, alertMax: 28, extremeFrom: 31 },
  horse: { id: 'horse', comfortMax: 22, alertMax: 26, extremeFrom: 29 },
  camel: { id: 'camel', comfortMax: 24, alertMax: 28, extremeFrom: 31 },
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** 原始 THI（T 摄氏度，humidityPercent 0–100） */
export function computeThi(temperature: number, humidityPercent: number): number {
  const rh = Math.min(100, Math.max(0, humidityPercent)) / 100;
  return round1(temperature - (0.55 - 0.55 * rh) * (temperature - 14.5));
}

/**
 * 海拔修正：海拔越高、空气越稀薄、散热条件越好，实际热应激随海拔下降。
 * 2000 米以下不修正；每升高 1000 米在有效 THI 上减 1.2，封顶 3.6。
 */
export function altitudeAdjustment(altitude: number): number {
  if (altitude <= 2000) return 0;
  return round1(Math.min(3.6, ((altitude - 2000) / 1000) * 1.2));
}

/** 畜龄修正：幼畜与老畜耐受力更弱，等效环境压力上调 */
export function ageAdjustment(age: ThiInput['age']): number {
  if (age === 'young') return 1.5;
  if (age === 'old') return 0.5;
  return 0;
}

export function classifyLevel(effective: number, species: SpeciesConfig): StressLevel {
  if (effective >= species.extremeFrom) return 'extreme';
  if (effective >= species.alertMax) return 'danger';
  if (effective >= species.comfortMax) return 'alert';
  return 'comfort';
}

export function evaluateThi(input: ThiInput): ThiResult {
  const species = SPECIES_CONFIG[input.species];
  const base = computeThi(input.temperature, input.humidity);
  const altAdj = altitudeAdjustment(input.altitude);
  const ageAdj = ageAdjustment(input.age);
  const effective = round1(base - altAdj + ageAdj);
  const notes: string[] = [];
  if (input.temperature <= -10) {
    notes.push('当前气温低于 -10℃，重点关注冷应激：避风、保温、幼畜补饲。');
  }
  if (input.altitude >= 3500) {
    notes.push('海拔 3500 米以上属低氧环境，幼畜与长途驱赶群体需降低运动强度。');
  }
  if (input.humidity >= 85) {
    notes.push('相对湿度 85% 以上会削弱蒸发散热，体感压力高于同温干燥环境。');
  }
  return {
    base,
    effective,
    level: classifyLevel(effective, species),
    species,
    altitudeAdjustment: altAdj,
    ageAdjustment: ageAdj,
    notes,
  };
}

export const LEVEL_LABELS: Record<StressLevel, string> = {
  comfort: '舒适',
  alert: '警戒',
  danger: '危险',
  extreme: '极端',
};

export const LEVEL_COLORS: Record<StressLevel, string> = {
  comfort: '#5b7a5a',
  alert: '#d4a853',
  danger: '#c2410c',
  extreme: '#9f1239',
};

/** 分级管理建议（放牧 + 舍饲通用口径） */
export const LEVEL_ADVICE: Record<StressLevel, string[]> = {
  comfort: [
    '维持现有饲养节律，按常规时段放牧。',
    '保证清洁饮水持续供应，定期清洗水槽。',
    '保持常规补饲与巡护频率。',
  ],
  alert: [
    '避开正午高温时段放牧（约 11:00–16:00），改为早、晚放牧。',
    '增加饮水点，必要时补充电解质。',
    '圈舍加强通风，适当降低饲养密度。',
    '缩短驱赶距离，减少剧烈运动。',
  ],
  danger: [
    '停止午间放牧，全部改为晨昏放牧。',
    '启用遮阳、喷淋或通风降温设施。',
    '补饲易消化能量饲料，减少高粗饲料比例。',
    '密切观察呼吸频率、采食量与反刍情况，异常个体及时隔离处理。',
  ],
  extreme: [
    '避免任何中午前后的户外驱赶与转运。',
    '将畜群转移至阴凉通风处或通风棚舍集中管护。',
    '全天供应清凉饮水，少量多次补饲。',
    '重点巡护幼畜、老畜与高产个体，必要时联系兽医。',
  ],
};

export const SPECIES_LABELS: Record<PastureSpecies, string> = {
  yak: '牦牛（含犏牛）',
  sheep: '藏羊 / 绵羊',
  goat: '山羊（绒用 / 奶用）',
  chicken: '藏鸡 / 家禽',
  pig: '藏猪 / 猪',
  horse: '马',
  camel: '骆驼',
};

export const AGE_LABELS: Record<ThiInput['age'], string> = {
  adult: '成年畜',
  young: '幼畜',
  old: '老畜',
};
