import * as THREE from 'three';

/**
 * 平面图层的世界变换（唯一入口）。
 *
 * 地图数据是「平面 XY + 高度 Z」：+X 向东、+Y 向北、+Z 向上。
 * 场景里只允许**一次**把平面抬成水平面（绕 X 轴 −90°），于是：
 *   局部 (x, y, h) → 世界 (x, h, −y)
 * 也就是局部 +Z 变成世界 +Y（高度朝上）、局部 +Y（北）变成世界 −Z。
 *
 * 为什么要把这件事写成独立模块：曾出现过省块图层在外层组里又套了一层同样的
 * 旋转，两次 −90° 等于绕 X 轴 −180°，平面点被映射成 (x, −y, −h)——
 * 版图整体沉到台面以下并向南错开（实测偏差 (0, −1.1, +0.9)），
 * 页面上表现为「省块和光柱完全错位」。所有图层都必须走本模块，
 * 由 `layerTransform.test.ts` 锁死「只准旋转一次、高度必须朝上」。
 */

const EULER = new THREE.Euler(-Math.PI / 2, 0, 0, 'XYZ');
const PLANE_TO_WORLD = new THREE.Matrix4().makeRotationFromEuler(EULER);

/** 传给 `<group rotation={...}>` 的唯一一份旋转。 */
export const PLANE_ROTATION: [number, number, number] = [EULER.x, EULER.y, EULER.z];

/** 地图平面点 + 高度 → 世界坐标。 */
export function planeToWorld(x: number, y: number, height = 0): THREE.Vector3 {
  return new THREE.Vector3(x, y, height).applyMatrix4(PLANE_TO_WORLD);
}

/** 世界坐标 → 地图平面点（相机的 target 与台面定位用）。 */
export function worldToPlane(point: THREE.Vector3): { x: number; y: number; height: number } {
  return { x: point.x, y: -point.z, height: point.y };
}
