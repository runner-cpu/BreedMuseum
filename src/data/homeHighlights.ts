/**
 * 首页首屏需要的馆藏摘要。
 *
 * 首页是入口路由：如果直接 import `visibleBreeds`（约 660 kB），
 * 首屏静态图会超出包体预算。这里只保留「14 个类别的条目数」与
 * 「8 条精选记录」两批小数据，合计约 2 KB；`homeHighlights.test.ts`
 * 逐项与运行时数据比对，避免手写常量悄悄漂移。
 */
export interface HomeFeaturedBreed {
  id: string;
  name: string;
  englishName: string;
  category: string;
  province: string;
  image: string;
}

/** 类别条目数，顺序与 `catalog.ts` 的类别目录一致。 */
export const HOME_CATEGORY_COUNTS: ReadonlyArray<{ category: string; count: number }> = [
  { category: '猪', count: 113 },
  { category: '牛', count: 150 },
  { category: '羊', count: 115 },
  { category: '鸡', count: 85 },
  { category: '鸭', count: 35 },
  { category: '鹅', count: 31 },
  { category: '马', count: 44 },
  { category: '驴', count: 20 },
  { category: '骆驼', count: 12 },
  { category: '兔', count: 26 },
  { category: '鸽', count: 15 },
  { category: '鹿', count: 8 },
  { category: '特种畜禽', count: 3 },
  { category: '其他', count: 10 },
];

const CDN = 'https://miaoda-site-img.cdn.bcebos.com/images';

/** 精选记录：覆盖 6 个类别与 8 个省级行政区，图片均为站内可浏览记录。 */
export const HOME_FEATURED: readonly HomeFeaturedBreed[] = [
  {
    id: 'dongbei-min-pig',
    name: '东北民猪',
    englishName: 'Northeast Min Pig',
    category: '猪',
    province: '黑龙江',
    image: `${CDN}/baidu_image_search_195f8ab4-b756-4f49-801e-cacd8282e51b.jpg`,
  },
  {
    id: 'nanyang-cattle',
    name: '南阳牛',
    englishName: 'Nanyang Cattle',
    category: '牛',
    province: '河南',
    image: `${CDN}/baidu_image_search_7483d6cd-46ea-4d98-afb7-980ad8b4d087.jpg`,
  },
  {
    id: 'mongolian-sheep',
    name: '蒙古羊',
    englishName: 'Mongolian Sheep',
    category: '羊',
    province: '内蒙古',
    image: `${CDN}/baidu_image_search_82bc69fe-8083-4672-842f-3cde48d3fdd0.jpg`,
  },
  {
    id: 'beijing-oil-chicken',
    name: '北京油鸡',
    englishName: 'Beijing Oil Chicken',
    category: '鸡',
    province: '北京',
    image: `${CDN}/baidu_image_search_95be6b46-6f63-4945-bd18-9ea8b176c2bb.jpg`,
  },
  {
    id: 'kazakh-sheep',
    name: '哈萨克羊',
    englishName: 'Kazakh Sheep',
    category: '羊',
    province: '新疆',
    image: `${CDN}/baidu_image_search_e48b3269-a27f-4926-b625-31c07330b901.jpg`,
  },
  {
    id: 'tibetan-pig',
    name: '藏猪',
    englishName: 'Tibetan Pig',
    category: '猪',
    province: '西藏',
    image: `${CDN}/baidu_image_search_00cae6d1-8767-4d4f-be43-09a647f99898.jpg`,
  },
  {
    id: 'qinchuan-cattle',
    name: '秦川牛',
    englishName: 'Qinchuan Cattle',
    category: '牛',
    province: '陕西',
    image: `${CDN}/baidu_image_search_2a6a55cd-187c-470a-89f9-1594ebd8f090.jpg`,
  },
  {
    id: 'shiqi-pigeon',
    name: '石岐鸽',
    englishName: 'Shiqi Pigeon',
    category: '鸽',
    province: '广东',
    image: `${CDN}/baidu_image_search_a1a3b340-d00c-47dd-8b48-8db2cd437ab3.jpg`,
  },
];

export const HOME_CATEGORY_TOTAL = HOME_CATEGORY_COUNTS.reduce((sum, item) => sum + item.count, 0);
