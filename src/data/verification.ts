import type { Breed } from './breeds';
import { getBreedMetadata, type ProtectionStatus } from './breedMetadata';

/**
 * 全站统一的三态核验徽章判定（单一事实源）。
 *
 * 任何页面、组件、游戏装置展示“这条记录可信到什么程度”时都必须调用本模块，
 * 禁止就地拼装徽章语义——口径漂移会让完成度评分（如实区分已完成内容）失守。
 *
 * - `official`   🏛 官方已核验：身份与名录状态来自农业农村部公告/2024 名录
 *                （来源含 moa-notice-940 或 nahs-catalog-2024），或命中国家级保护名录；
 * - `editorial`  📄 编辑整理：来源为项目整理数据集，描述为编辑归一化口径；
 * - `pending`    ⏳ 待专项核验：产区/描述/指标尚未核验（哨兵坐标或“待核验”省份）。
 */
export type VerificationLevel = 'official' | 'editorial' | 'pending';

export interface VerificationVerdict {
  level: VerificationLevel;
  /** 徽章短标签（中文，页面直接展示） */
  label: string;
  /** 徽章说明（图例、tooltip、无障碍文本共用） */
  detail: string;
}

const OFFICIAL_SOURCE_IDS = ['moa-notice-940', 'nahs-catalog-2024'] as const;

export function getVerificationLevel(breed: Breed): VerificationLevel {
  const metadata = getBreedMetadata(breed);
  const hasOfficialSource = metadata.sourceIds.some((id) =>
    (OFFICIAL_SOURCE_IDS as readonly string[]).includes(id),
  );
  if (hasOfficialSource || metadata.protectionStatus === 'national-list') return 'official';
  if (breed.province === '待核验' || (breed.longitude === 0 && breed.latitude === 0)) return 'pending';
  return 'editorial';
}

const VERDICTS: Record<VerificationLevel, VerificationVerdict> = {
  official: {
    level: 'official',
    label: '官方已核验',
    detail: '名称与名录身份可追溯至农业农村部公告第940号或《国家畜禽遗传资源品种名录（2024年版）》官方文件。',
  },
  editorial: {
    level: 'editorial',
    label: '编辑整理',
    detail: '条目来自项目整理数据集，体貌、性能与归一化指标为编辑口径，非权威测定结论。',
  },
  pending: {
    level: 'pending',
    label: '待专项核验',
    detail: '产区、坐标或描述资料尚未完成核验，暂不参与落点与省份统计。',
  },
};

export const getVerificationVerdict = (breed: Breed): VerificationVerdict =>
  VERDICTS[getVerificationLevel(breed)];

/** 徽章图例（档案库页头、/about 共用），顺序固定：优 → 弱。 */
export const VERIFICATION_LEGEND: readonly VerificationVerdict[] = [
  VERDICTS.official,
  VERDICTS.editorial,
  VERDICTS.pending,
];

/** 保护状态的中文短标签（详情页、档案抽屉共用）。 */
export const protectionLabel = (status: ProtectionStatus): string =>
  status === 'national-list'
    ? '国家级保护名录'
    : status === 'unverified'
      ? '保护状态待核验'
      : '未列入国家级保护名录';
