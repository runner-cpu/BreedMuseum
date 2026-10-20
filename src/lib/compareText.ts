/**
 * 与宿主语言环境无关的字符串比较。
 *
 * 为什么不用 `localeCompare`：它依赖运行时的 ICU 数据。同一份省份列表，
 * 在 Windows/Node 24 与 Ubuntu/Node 22 上会排出不同顺序——地图镜头顺序、
 * 省份速览与并列类别一旦各排各的，本机与 CI 就会得到不同的界面，
 * 甚至同一份导出结果在两台机器上不一致。按 UTF-16 码元比较在任何环境
 * 都稳定；它不是拼音序，但这是本项目对「并列项」明确承诺的顺序。
 */
export function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}
