/**
 * 本地托管的可核验授权图片登记表。
 *
 * 完整内容由 `tasks/source-commons-images.mjs --download` 依据人工复核过的
 * `tasks/breed-image-plan.json` 生成（Wikimedia Commons，仅收 CC0 / PD /
 * CC BY / CC BY-SA 且文件标题明确标注品种名的图片）。登记后，图片文件位于
 * `public/images/breeds/` 并随站点发布，品种详情页会展示摄影者与协议署名。
 *
 * 键为品种 id；留空表示尚无已核验图片，对应记录继续使用外链或项目 SVG 占位图。
 */
export interface BreedOverrideImage {
  /** 站内路径，如 /images/breeds/<id>.jpg */
  src: string;
  /** 摄影者（Commons Artist 字段，纯文本） */
  author: string;
  /** 许可协议简称，如 CC BY-SA 4.0 */
  license: string;
  /** Commons 文件页，用于署名回链 */
  sourceUrl: string;
  /** Commons 文件名，如 File:Meishan pig.jpg */
  title: string;
}

export const breedImageOverrides: Record<string, BreedOverrideImage> = {
  // 示例（由脚本生成的真实条目形如）：
  // 'meishan-pig': {
  //   src: '/images/breeds/meishan-pig.jpg',
  //   author: 'John Doe',
  //   license: 'CC BY-SA 4.0',
  //   sourceUrl: 'https://commons.wikimedia.org/wiki/File:Meishan_pig.jpg',
  //   title: 'File:Meishan pig.jpg',
  // },
};
