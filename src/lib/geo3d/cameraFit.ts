import * as THREE from 'three';

/**
 * 相机取景求解（纯函数，可在无 WebGL 环境下单测）。
 *
 * 为什么要精确求解而不是「半径 × 系数」：
 * 舞台是**扁宽**的（首页场景区约 1056 × 800），而中国版图是 10 × 8 的平板。
 * 用球半径估算无视宽高比与俯角，结果是「要么版图被裁掉、要么缩成一小块」。
 *
 * 这一版进一步解决两个真问题：
 * 1. **HUD 安全区不是居中的**——标题占顶部、镜头条占底部，剩余可见带是
 *    `[bottom, 1 - top]`。只把视锥对称收窄会把版图塞到标题底下；
 *    因此这里先按对称窗口解算，再把目标点沿相机「上」轴平移，
 *    让版图落到可见带正中（迭代收敛）。
 * 2. **俯角要跟着画布宽高比走**——扁宽舞台上抬高俯角能把版图铺得更满；
 *    手机竖屏则需要接近正俯视。候选俯角各自解算一次，取投影面积最大者，
 *    但候选表本身限幅，保证落点光束不会退化成圆点（> 70° 就只剩个圆盘了）。
 */

export interface FitInsets {
  /** 顶部安全区（0–1，HUD 标题所占高度比例） */
  top?: number;
  /** 底部安全区（镜头切换条） */
  bottom?: number;
  /** 左右安全区 */
  left?: number;
  /** 右侧安全区 */
  right?: number;
}

export interface FitRequest {
  /** 待容纳的世界坐标点（包围盒角点） */
  points: readonly THREE.Vector3[];
  /** 视线目标点（世界坐标） */
  target: THREE.Vector3;
  /** 目标点 → 相机方向（单位向量；相机位于 target + dir × distance） */
  direction: THREE.Vector3;
  /** 垂直视场角（度） */
  fovDeg: number;
  /** 视口宽高比 */
  aspect: number;
  /** 额外留白系数（>1 表示再退远一点） */
  margin?: number;
  /** HUD 安全区 */
  insets?: FitInsets;
}

const EPS = 1e-4;

/** 把世界坐标点投影到视口比例坐标（0–1，左下为原点）。 */
export interface ProjectedRect {
  left: number;
  right: number;
  bottom: number;
  top: number;
  width: number;
  height: number;
}

/**
 * 返回恰好容纳全部点所需的最小相机距离。
 *
 * 竖向与横向分别按各自的半视角求解；安全区通过收窄可用视角实现，
 * 因此内容会落在一个**居中**的窗口里。非对称 HUD（上宽下窄/上窄下宽）
 * 由 `frameBox` 的目标点平移来兜底。
 */
export function fitDistanceForPoints({
  points,
  target,
  direction,
  fovDeg,
  aspect,
  margin = 1.06,
  insets,
}: FitRequest): number {
  const dir = direction.clone().normalize();
  const safeAspect = Math.max(0.35, aspect);

  const usableV = 1 - (insets?.top ?? 0) - (insets?.bottom ?? 0);
  const usableH = 1 - (insets?.left ?? 0) - (insets?.right ?? 0);
  const tanV = (Math.tan((fovDeg * Math.PI) / 360) * Math.max(0.2, usableV)) / margin;
  const tanH = (tanV * safeAspect * Math.max(0.2, usableH)) / Math.max(0.2, usableV);

  // 视线基：right / up 与 dir 正交
  const right = new THREE.Vector3().crossVectors(worldUpFor(dir), dir).normalize();
  const up = new THREE.Vector3().crossVectors(dir, right).normalize();

  const rel = new THREE.Vector3();
  let distance = 0;
  for (const point of points) {
    rel.copy(point).sub(target);
    const along = rel.dot(dir);
    const lateralV = Math.abs(rel.dot(up));
    const lateralH = Math.abs(rel.dot(right));
    distance = Math.max(distance, along + lateralV / tanV, along + lateralH / tanH, along + EPS * 10);
  }
  return distance;
}

const worldUpFor = (dir: THREE.Vector3): THREE.Vector3 =>
  Math.abs(dir.y) > 0.98 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);

/** 相机「上」轴（世界坐标单位向量），与 `fitDistanceForPoints` 内部一致。 */
export function cameraUp(direction: THREE.Vector3): THREE.Vector3 {
  const dir = direction.clone().normalize();
  const right = new THREE.Vector3().crossVectors(worldUpFor(dir), dir).normalize();
  return new THREE.Vector3().crossVectors(dir, right).normalize();
}

/** 取包围盒 8 个角（世界坐标）。 */
export function boxCorners(
  box: { minX: number; maxX: number; minY: number; maxY: number },
  minHeight: number,
  maxHeight: number,
  into: THREE.Vector3[] = [],
): THREE.Vector3[] {
  into.length = 0;
  for (const x of [box.minX, box.maxX]) {
    for (const planeY of [box.minY, box.maxY]) {
      for (const height of [minHeight, maxHeight]) {
        // 平面 (x, y) → 世界 (x, height, -y)：+Y 朝北 ⇒ 世界 −Z 朝北
        into.push(new THREE.Vector3(x, height, -planeY));
      }
    }
  }
  return into;
}

/** 由俯角与方位角构造「目标 → 相机」方向（默认从南方、高于水平线 elevation 弧度俯视）。 */
export function cameraDirection(elevation: number, azimuth = 0): THREE.Vector3 {
  return new THREE.Vector3(
    Math.sin(azimuth) * Math.cos(elevation),
    Math.sin(elevation),
    Math.cos(azimuth) * Math.cos(elevation),
  ).normalize();
}

/** 相机位置 = 目标 + 方向 × 距离。 */
export function cameraSeat(target: THREE.Vector3, direction: THREE.Vector3, distance: number): THREE.Vector3 {
  return target.clone().addScaledVector(direction.clone().normalize(), distance);
}

/** 世界坐标点集在给定机位下的屏幕占比矩形（比例坐标，0–1）。 */
export function projectPoints(
  points: readonly THREE.Vector3[],
  target: THREE.Vector3,
  direction: THREE.Vector3,
  distance: number,
  fovDeg: number,
  aspect: number,
): ProjectedRect {
  const camera = new THREE.PerspectiveCamera(fovDeg, Math.max(0.05, aspect), 0.1, 500);
  camera.position.copy(cameraSeat(target, direction, distance));
  camera.lookAt(target);
  camera.updateMatrixWorld(true);
  camera.updateProjectionMatrix();

  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  const probe = new THREE.Vector3();
  for (const point of points) {
    probe.copy(point).project(camera);
    if (probe.x < minX) minX = probe.x;
    if (probe.x > maxX) maxX = probe.x;
    if (probe.y < minY) minY = probe.y;
    if (probe.y > maxY) maxY = probe.y;
  }
  const left = (minX + 1) / 2;
  const right = (maxX + 1) / 2;
  const bottom = (minY + 1) / 2;
  const top = (maxY + 1) / 2;
  return { left, right, bottom, top, width: right - left, height: top - bottom };
}

/** 可见带（HUD 之间）在视口里的中心位置（比例坐标，0 = 底边）。 */
const bandCenterFor = (insets?: FitInsets): number =>
  0.5 + ((insets?.bottom ?? 0) - (insets?.top ?? 0)) / 2;

export interface BoxFraming {
  /** 视线目标点（已平移到可见带中心） */
  target: THREE.Vector3;
  /** 目标点 → 相机距离 */
  distance: number;
  /** 投影后的屏幕占比 */
  rect: ProjectedRect;
}

/**
 * 固定俯角下把点集塞进 HUD 之间的可见带。
 *
 * 迭代：解距离 → 量投影矩形 → 把目标点沿相机上轴平移，使矩形落在带中心。
 * 3–4 次内收敛（每次修正量按当前距离线性化）。
 */
export function frameBox({
  points,
  direction,
  fovDeg,
  aspect,
  margin = 1.04,
  insets,
}: {
  points: readonly THREE.Vector3[];
  direction: THREE.Vector3;
  fovDeg: number;
  aspect: number;
  margin?: number;
  insets?: FitInsets;
}): BoxFraming {
  const dir = direction.clone().normalize();
  const up = cameraUp(dir);
  const tanV = Math.tan((fovDeg * Math.PI) / 360);
  const bandCenter = bandCenterFor(insets);

  const target = new THREE.Vector3();
  for (const point of points) target.add(point);
  target.multiplyScalar(1 / Math.max(1, points.length));

  let distance = 0;
  let rect: ProjectedRect = { left: 0, right: 1, bottom: 0, top: 1, width: 1, height: 1 };
  for (let iteration = 0; iteration < 5; iteration += 1) {
    distance = fitDistanceForPoints({ points, target, direction: dir, fovDeg, aspect, margin, insets });
    rect = projectPoints(points, target, dir, distance, fovDeg, aspect);
    // 正值 = 内容需要上移（屏幕上移）；沿相机上轴反向平移目标点即可
    const shift = bandCenter - (rect.bottom + rect.top) / 2;
    if (Math.abs(shift) < 0.0015) break;
    target.addScaledVector(up, -2 * shift * distance * tanV);
  }
  return { target, distance, rect };
}

/**
 * 候选俯角：横屏上限 0.96 rad（55°）保证落点光束仍读得出「一束」，
 * 竖屏放宽到 1.28 rad（73°）——手机上版图本来就会被压扁成横带，
 * 抬高俯角是把横带铺满屏幕的唯一手段。
 */
export const LANDSCAPE_ELEVATIONS = [0.62, 0.7, 0.78, 0.86, 0.94] as const;
export const PORTRAIT_ELEVATIONS = [0.8, 0.92, 1.04, 1.16, 1.28] as const;

export interface SolveRequest {
  /** 待容纳的平面包围盒 */
  box: { minX: number; maxX: number; minY: number; maxY: number };
  minHeight: number;
  maxHeight: number;
  fovDeg: number;
  aspect: number;
  margin?: number;
  insets?: FitInsets;
  /** 覆盖候选俯角（测试与特殊舞台用） */
  elevations?: readonly number[];
}

export interface FramingSolution extends BoxFraming {
  /** 选中的俯角（弧度） */
  elevation: number;
  direction: THREE.Vector3;
  /** 相机世界坐标 */
  seat: THREE.Vector3;
}

/**
 * 自动俯角取景：候选俯角各解算一次，取「投影面积最大」者。
 * 面积最大 ⇔ 版图在画布上占得最满，同时候选表已经限幅，不会退化成正俯视。
 */
export function solveFraming({
  box,
  minHeight,
  maxHeight,
  fovDeg,
  aspect,
  margin = 1.04,
  insets,
  elevations,
}: SolveRequest): FramingSolution {
  const points = boxCorners(box, minHeight, maxHeight);
  const candidates = elevations ?? (aspect < 1 ? PORTRAIT_ELEVATIONS : LANDSCAPE_ELEVATIONS);

  let best: FramingSolution | null = null;
  let bestArea = -1;
  for (const elevation of candidates) {
    const direction = cameraDirection(elevation);
    const framing = frameBox({ points, direction, fovDeg, aspect, margin, insets });
    const area = framing.rect.width * framing.rect.height;
    if (area > bestArea + 1e-9) {
      bestArea = area;
      best = {
        ...framing,
        elevation,
        direction,
        seat: cameraSeat(framing.target, direction, framing.distance),
      };
    }
  }
  // 候选表不为空，best 必然被赋值
  return best!;
}
