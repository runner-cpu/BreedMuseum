/**
 * SVG path（M/L/Z 子集）→ 多边形环解析。
 *
 * 数据来源：`src/data/chinaMap.ts` 的省级路径。实测该数据集只用 M/L/Z 三种命令、
 * 无曲线，因此本解析器只支持这三种命令；遇到其他命令直接抛出，避免静默丢几何。
 */

export interface Ring2D {
  /** 闭合前的顶点序列（[x, y]，地图本地平面坐标，与 chinaMap viewBox 同域）。 */
  points: [number, number][];
}

/** 相邻点去重时的最小距离平方（数据中存在重复点与零长度段）。 */
const DEDUPE_EPSILON = 1e-9;

const roundTrip = (value: number): number => (Number.isFinite(value) ? value : 0);

/**
 * 解析单条省域路径为若干环。
 *
 * - 同一 `M` 之后的 `L` 归入同一环；`Z` 只表示闭合，不产生新环；
 * - 顶点数少于 3 的环仍然返回（由 ringFilter 决定是否保留），保证调用方可见噪声；
 * - 未知命令（C/S/Q/A 等）抛错。
 */
export function parseSvgPathToRings(d: string): Ring2D[] {
  const rings: Ring2D[] = [];
  let current: [number, number][] = [];

  const tokens = d.match(/[A-Za-z]|-?\d*\.?\d+(?:e[-+]?\d+)?/g) ?? [];
  let index = 0;
  let command = '';

  const flush = () => {
    if (current.length >= 1) rings.push({ points: current });
    current = [];
  };

  const pushPoint = (x: number, y: number) => {
    const point: [number, number] = [roundTrip(x), roundTrip(y)];
    const last = current[current.length - 1];
    if (last) {
      const dx = last[0] - point[0];
      const dy = last[1] - point[1];
      if (dx * dx + dy * dy <= DEDUPE_EPSILON) return;
    }
    current.push(point);
  };

  while (index < tokens.length) {
    const token = tokens[index];
    if (/^[a-z]$/i.test(token)) {
      command = token.toUpperCase();
      index += 1;
      if (command === 'Z') {
        // 闭合：把首点补回为末点，供三角化使用；不新建环
        if (current.length >= 3) {
          const first = current[0];
          const last = current[current.length - 1];
          if (first[0] !== last[0] || first[1] !== last[1]) current.push([first[0], first[1]]);
        }
        flush();
        command = '';
      } else if (command !== 'M' && command !== 'L') {
        throw new Error(`parseSvgPathToRings: 不支持的 SVG 命令 "${token}"`);
      }
      continue;
    }

    if (!command) {
      throw new Error('parseSvgPathToRings: 数字出现在命令之前');
    }

    const x = Number(token);
    const y = Number(tokens[index + 1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
      throw new Error(`parseSvgPathToRings: 无效坐标 at index ${index}`);
    }
    index += 2;

    if (command === 'M') {
      flush();
      pushPoint(x, y);
      command = 'L';
    } else {
      pushPoint(x, y);
    }
  }

  flush();
  return rings;
}
