import { hasBreedImage } from './breedImage';
import { breeds } from './breeds';
import { categories, endangeredLevels, provinces } from './catalog';

/** Visitor-facing collection: records without a real image are omitted. */
export const visibleBreeds = breeds.filter((breed) => hasBreedImage(breed.image));

/**
 * 有可浏览记录的类别（保持目录顺序）。
 *
 * 目录保留全部 15 个类别，但「蜂」目前没有一条带真实图片的记录；
 * 筛选栏若照目录全量渲染，观众点进去只会看到空地图/空结果。
 * 这里把“能筛出东西”作为入口条件，并由 `collectionSummary.test.ts`
 * 与 `COLLECTION_SUMMARY.visibleCategories` 对齐。
 */
export const visibleCategories = categories.filter((category) =>
  visibleBreeds.some((breed) => breed.category === category),
);

/** 有可浏览记录的省级行政区，保持目录顺序。 */
export const visibleProvinces = provinces.filter((province) =>
  visibleBreeds.some((breed) => breed.province === province),
);

/**
 * 有可浏览记录的编辑濒危等级。
 *
 * 注意与“待核验产区”区分：这里是濒危标签字段，不是省份哨兵值。
 */
export const visibleEndangeredLevels = endangeredLevels.filter((level) =>
  visibleBreeds.some((breed) => breed.endangered === level),
);
