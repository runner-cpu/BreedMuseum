/**
 * Lightweight catalog vocabularies used by the shell and filters. Keeping
 * these values separate from the full 701-record collection prevents the
 * application shell from downloading the complete data module on first paint.
 */
export type EndangeredLevel = '普通' | '易危' | '濒危' | '极危' | '待核验';
export type BreedCategory = '猪' | '牛' | '羊' | '鸡' | '鸭' | '马' | '骆驼' | '兔' | '鹅' | '鸽' | '其他';

export const categories: BreedCategory[] = ['猪', '牛', '羊', '鸡', '鸭', '马', '骆驼', '兔', '鹅', '鸽', '其他'];

export const endangeredLevels: EndangeredLevel[] = ['普通', '易危', '濒危', '极危', '待核验'];

export const provinces = [
  '黑龙江', '吉林', '辽宁', '内蒙古', '北京', '天津', '河北', '山西',
  '陕西', '甘肃', '青海', '宁夏', '新疆', '西藏', '四川', '重庆',
  '贵州', '云南', '山东', '江苏', '安徽', '浙江', '江西', '福建',
  '上海', '台湾', '河南', '湖北', '湖南', '广东', '广西', '海南',
  '香港', '澳门',
];
