/**
 * legacy 记录的类别修复表（id → 类别）。
 *
 * 修复依据：《国家畜禽遗传资源品种名录（2024年版）》台账
 * （src/data/ml2024Catalog.json）中该品种所属的官方物种，经
 * speciesCategory.ts 映射为类别。只收录能在名录中定位到物种的记录；
 * 名录中查无此条目的历史记录继续留在“其他”，不做按名称推断。
 *
 * 用法：breeds.ts 的 normalizeBreedIdentities() 在归一化阶段统一应用，
 * 避免散改批次文件；新增修复项须在 src/data/__tests__/categorySystem.test.ts
 * 的断言中体现（修复表与契约测试同批提交）。
 */
import type { BreedCategory } from './catalog';

/** 驴：名录「传统畜禽/驴/地方品种」章节在册（20 条） */
const donkeyFixes: Record<string, BreedCategory> = {
  'hebei-donkey': '驴', // 德州驴
  'shaanxi-donkey': '驴', // 关中驴
  'jiami-donkey': '驴', // 佳米驴
  'guangling-donkey': '驴', // 广灵驴
  'biyang-donkey': '驴', // 泌阳驴
  'tibetan-donkey': '驴', // 西藏驴
  'xinjiang-donkey': '驴', // 新疆驴
  'xiji-donkey': '驴', // 西吉驴
  'huaibei-grey-donkey': '驴', // 淮北灰驴
  'changyuan-donkey': '驴', // 长垣驴
  'qingyang-donkey': '驴', // 庆阳驴
  'liangzhou-donkey': '驴', // 凉州驴
  'qinghai-donkey': '驴', // 青海毛驴
  'yunnan-donkey': '驴', // 云南驴
  'sichuan-donkey': '驴', // 四川驴（名录正名：川驴）
  'hetian-donkey': '驴', // 和田驴（名录正名：和田青驴）
  'taihang-donkey': '驴', // 太行驴
  'kulun-donkey': '驴', // 库伦驴
  'subei-donkey': '驴', // 苏北毛驴
  'yangyuan-donkey': '驴', // 阳原驴
};

/** 鹿：名录「特种畜禽/梅花鹿、马鹿、驯鹿」章节在册（6 条） */
const deerFixes: Record<string, BreedCategory> = {
  'sika-deer': '鹿', // 梅花鹿（名录正名：吉林梅花鹿）
  'shuangyang-sika': '鹿', // 双阳梅花鹿
  'xingkai-sika-deer': '鹿', // 兴凯湖梅花鹿
  'tarim-red-deer': '鹿', // 塔里木马鹿（名录正名：塔河马鹿）
  'dongbei-red-deer': '鹿', // 东北马鹿
  'reindeer': '鹿', // 敖鲁古雅驯鹿
};

/** 特种畜禽：名录「特种畜禽」组内可定位到物种的历史记录（1 条） */
const specialFixes: Record<string, BreedCategory> = {
  'alpaca': '特种畜禽', // 羊驼（名录「特种畜禽/羊驼」在册名称）
};

export const breedCategoryFixes: Record<string, BreedCategory> = {
  ...donkeyFixes,
  ...deerFixes,
  ...specialFixes,
};

/** 修复项数量（契约测试锁定，防止静默增删）。 */
export const BREED_CATEGORY_FIX_COUNT = Object.keys(breedCategoryFixes).length;
