/**
 * Lightweight catalog vocabularies used by the shell and filters. Keeping
 * these values separate from the full 701-record collection prevents the
 * application shell from downloading the complete data module on first paint.
 */
export type EndangeredLevel = '普通' | '易危' | '濒危' | '极危' | '待核验';
export type BreedCategory =
  | '猪' | '牛' | '羊' | '鸡' | '鸭' | '鹅' | '马' | '驴' | '骆驼'
  | '兔' | '鸽' | '鹿' | '蜂' | '特种畜禽' | '其他';

/**
 * 类别口径与《国家畜禽遗传资源品种名录（2024年版）》的分组对齐：
 * 传统畜禽按畜种分列（驴单列）、茸鹿类单列（鹿）、蜂遗传资源单列（蜂）、
 * 其余特种畜禽整体成组（特种畜禽）；“其他”只保留无法归入名录分组的遗留记录。
 */
export const categories: BreedCategory[] = [
  '猪', '牛', '羊', '鸡', '鸭', '鹅', '马', '驴', '骆驼',
  '兔', '鸽', '鹿', '蜂', '特种畜禽', '其他',
];

// “极危”暂无收录记录，先不在筛选项中暴露，避免空结果；类型保留以便后续补录。
export const endangeredLevels: EndangeredLevel[] = ['普通', '易危', '濒危', '待核验'];

export const provinces = [
  '黑龙江', '吉林', '辽宁', '内蒙古', '北京', '天津', '河北', '山西',
  '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏', '四川', '重庆',
  '贵州', '云南', '山东', '江苏', '安徽', '浙江', '江西', '福建',
  '上海', '台湾', '河南', '湖北', '湖南', '广东', '广西', '海南',
  '香港', '澳门',
];

/**
 * 产区未核验的哨兵值：名录条目式收录在产区核实前统一使用。
 * 它不是行政区名，不参与省份筛选、省份计数与地图落点。
 */
export const UNVERIFIED_PROVINCE = '待核验';

export const isKnownProvince = (province: string): boolean =>
  (provinces as readonly string[]).includes(province);

/** (0,0) 是“产区未核验”的坐标哨兵，不是真实地理点。 */
export const isSentinelCoordinate = (longitude: number, latitude: number): boolean =>
  longitude === 0 && latitude === 0;

/**
 * 坐标是否可落点展示：省份已核验且不位于哨兵坐标。
 * 地图与审计共用这一判定，避免 (0,0) 被当成真实位置渲染。
 */
export const hasVerifiedCoordinates = (breed: {
  province: string;
  longitude: number;
  latitude: number;
}): boolean => isKnownProvince(breed.province) && !isSentinelCoordinate(breed.longitude, breed.latitude);
