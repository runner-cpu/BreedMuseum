/**
 * 与宿主语言环境无关的字符串比较。
 *
 * 为什么不用 `localeCompare`：它依赖运行时的 ICU 数据。同一份省份列表，
 * 在 Windows/Node 24 与 Ubuntu/Node 22 上会排出不同顺序——首页图集是
 * 预生成常量，生成脚本与契约测试一旦各排各的，CI 就会红，而且线上
 * 排序还会随浏览器变化。按 UTF-16 码元比较在任何环境都稳定；它不是
 * 拼音序，但这是本项目对「生成数据与并列项」明确承诺的顺序。
 */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
