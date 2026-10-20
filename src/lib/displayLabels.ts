/**
 * 数据值的中英文显示名。
 *
 * 馆藏数据本身是中文（品种名、产区、故事），但界面上的类别、濒危等级、
 * 省级行政区属于「受控词表」，不是自由文本：英文界面必须把它们翻译过来，
 * 否则切换语言后页面仍然是一整屏中文。
 *
 * 这里集中维护三个词表，避免二十七处 `language === 'en' ? ... : ...` 各写一份。
 * 未知值原样返回，保证新增类别不会变成空字符串。
 */

export type DisplayLanguage = 'zh' | 'en';

export const CATEGORY_EN: Record<string, string> = {
  猪: 'Pig',
  牛: 'Cattle',
  羊: 'Sheep',
  鸡: 'Chicken',
  鸭: 'Duck',
  鹅: 'Goose',
  马: 'Horse',
  驴: 'Donkey',
  骆驼: 'Camel',
  兔: 'Rabbit',
  鸽: 'Pigeon',
  鹿: 'Deer',
  蜂: 'Bee',
  特种畜禽: 'Special livestock',
  其他: 'Other',
};

export const LEVEL_EN: Record<string, string> = {
  普通: 'Common',
  易危: 'Vulnerable',
  濒危: 'Endangered',
  极危: 'Critically endangered',
  待核验: 'Unverified',
};

/** 省级行政区（含“待核验”哨兵，它只用于文案，不作为可筛选值）。 */
export const PROVINCE_EN: Record<string, string> = {
  黑龙江: 'Heilongjiang',
  吉林: 'Jilin',
  辽宁: 'Liaoning',
  内蒙古: 'Inner Mongolia',
  北京: 'Beijing',
  天津: 'Tianjin',
  河北: 'Hebei',
  山西: 'Shanxi',
  陕西: 'Shaanxi',
  甘肃: 'Gansu',
  青海: 'Qinghai',
  宁夏: 'Ningxia',
  新疆: 'Xinjiang',
  西藏: 'Xizang',
  四川: 'Sichuan',
  重庆: 'Chongqing',
  贵州: 'Guizhou',
  云南: 'Yunnan',
  山东: 'Shandong',
  江苏: 'Jiangsu',
  安徽: 'Anhui',
  浙江: 'Zhejiang',
  江西: 'Jiangxi',
  福建: 'Fujian',
  上海: 'Shanghai',
  台湾: 'Taiwan',
  河南: 'Henan',
  湖北: 'Hubei',
  湖南: 'Hunan',
  广东: 'Guangdong',
  广西: 'Guangxi',
  海南: 'Hainan',
  香港: 'Hong Kong',
  澳门: 'Macao',
  待核验: 'Unverified',
};

const pick = (table: Record<string, string>, value: string, lang: DisplayLanguage): string =>
  lang === 'en' ? (table[value] ?? value) : value;

export const categoryLabel = (category: string, lang: DisplayLanguage): string =>
  pick(CATEGORY_EN, category, lang);

export const levelLabel = (level: string, lang: DisplayLanguage): string =>
  pick(LEVEL_EN, level, lang);

export const provinceLabel = (province: string, lang: DisplayLanguage): string =>
  pick(PROVINCE_EN, province, lang);

/**
 * 题目选项的显示名：选项可能是类别、等级或省份，也可能是品种名。
 * 前三种走词表翻译，品种名保持原样（馆藏数据本身是中文）。
 */
export const optionLabel = (value: string, lang: DisplayLanguage): string => {
  if (lang !== 'en') return value;
  return CATEGORY_EN[value] ?? LEVEL_EN[value] ?? PROVINCE_EN[value] ?? value;
};

/** `t()` 占位符替换：`{name}` / `{count}` / `{km}` 等。 */
export const fill = (template: string, values: Record<string, string | number>): string =>
  Object.entries(values).reduce(
    (text, [key, value]) => text.split(`{${key}}`).join(String(value)),
    template,
  );
