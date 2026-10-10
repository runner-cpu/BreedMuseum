import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import {
  cameraDirection,
  cameraSeat,
  fitDistanceForPoints,
  frameBox,
  boxCorners,
  projectPoints,
  solveFraming,
} from '../cameraFit';

/**
 * 取景求解契约。
 *
 * 舞台是扁宽的（首页场景区约 1056 × 800 中可用带更窄），版图是 10 × 8 的平板。
 * 这里对**真实**的版图包围盒做断言，锁死三件曾经出过错的事：
 * 1. 版图必须落在 HUD 安全区之间的可见带里（不能钻到标题或镜头条底下）；
 * 2. 自动俯角要随画布宽高比变化，且横屏不得超过「落点柱退化成圆盘」的上限；
 * 3. 解出来的距离必须真的容纳全部角点（投影全部落在视口内）。
 */

const FOV = 45;
/** 版图主体包围盒（与 buildProvinceGeometry 实测一致）。 */
const MAP_BOX = { minX: -4.919, maxX: 5.015, minY: -3.968, maxY: 3.902 };
const MAX_EXTRUDE = 0.3;
const HUD = { top: 0.12, bottom: 0.2, left: 0.03, right: 0.03 };

const band = (insets: typeof HUD) => ({ bottom: insets.bottom, top: 1 - insets.top });

describe('fitDistanceForPoints', () => {
  test('grows the distance until every corner is inside the frustum', () => {
    const direction = cameraDirection(0.78);
    const target = new THREE.Vector3();
    const points = boxCorners(MAP_BOX, 0, MAX_EXTRUDE);
    const distance = fitDistanceForPoints({ points, target, direction, fovDeg: FOV, aspect: 1.32 });

    const rect = projectPoints(points, target, direction, distance, FOV, 1.32);
    expect(rect.left).toBeGreaterThanOrEqual(-0.001);
    expect(rect.right).toBeLessThanOrEqual(1.001);
    expect(rect.bottom).toBeGreaterThanOrEqual(-0.001);
    expect(rect.top).toBeLessThanOrEqual(1.001);

    // 距离再近一点就必须溢出：证明这是最小值而不是随手取的大数
    const tighter = projectPoints(points, target, direction, distance * 0.94, FOV, 1.32);
    expect(tighter.left < -0.01 || tighter.right > 1.01 || tighter.bottom < -0.01 || tighter.top > 1.01).toBe(true);
  });

  test('a narrower aspect ratio pushes the camera further away', () => {
    const direction = cameraDirection(0.78);
    const target = new THREE.Vector3();
    const points = boxCorners(MAP_BOX, 0, MAX_EXTRUDE);
    const wide = fitDistanceForPoints({ points, target, direction, fovDeg: FOV, aspect: 1.8 });
    const narrow = fitDistanceForPoints({ points, target, direction, fovDeg: FOV, aspect: 0.7 });
    expect(narrow).toBeGreaterThan(wide);
  });
});

describe('frameBox', () => {
  test('centres the map inside the HUD band instead of the full viewport', () => {
    const points = boxCorners(MAP_BOX, 0, MAX_EXTRUDE);
    const { rect } = frameBox({ points, direction: cameraDirection(0.78), fovDeg: FOV, aspect: 1.32, insets: HUD });
    const centre = (rect.bottom + rect.top) / 2;
    const visible = band(HUD);
    const visibleCentre = (visible.bottom + visible.top) / 2;
    // 非对称安全区（标题高、镜头条更高）下必须居中到可见带，而不是画布中心
    expect(Math.abs(centre - visibleCentre)).toBeLessThan(0.02);
    expect(rect.bottom).toBeGreaterThanOrEqual(visible.bottom - 0.01);
    expect(rect.top).toBeLessThanOrEqual(visible.top + 0.01);
  });
});

describe('solveFraming', () => {
  test('landscape keeps the tilt shallow enough that pillars still read as pillars', () => {
    const solved = solveFraming({
      box: MAP_BOX,
      minHeight: 0,
      maxHeight: MAX_EXTRUDE,
      fovDeg: FOV,
      aspect: 1.32,
      insets: HUD,
    });
    expect(solved.elevation).toBeLessThanOrEqual(0.96);
    expect(solved.elevation).toBeGreaterThan(0.5);
    expect(solved.rect.width).toBeGreaterThan(0.8);
  });

  test('portrait tilts further to fill the narrow screen', () => {
    const landscape = solveFraming({
      box: MAP_BOX,
      minHeight: 0,
      maxHeight: MAX_EXTRUDE,
      fovDeg: FOV,
      aspect: 1.32,
      insets: HUD,
    });
    const portrait = solveFraming({
      box: MAP_BOX,
      minHeight: 0,
      maxHeight: MAX_EXTRUDE,
      fovDeg: FOV,
      aspect: 0.75,
      insets: HUD,
    });
    expect(portrait.elevation).toBeGreaterThan(landscape.elevation);
    // 竖屏也得把版图铺开，不能只占中间一条
    expect(portrait.rect.width).toBeGreaterThan(0.8);
    expect(portrait.rect.height).toBeGreaterThan(0.35);
  });

  test('the seat puts the camera on the target-side of the direction vector', () => {
    const solved = solveFraming({
      box: MAP_BOX,
      minHeight: 0,
      maxHeight: MAX_EXTRUDE,
      fovDeg: FOV,
      aspect: 1.32,
      insets: HUD,
    });
    const expected = cameraSeat(solved.target, solved.direction, solved.distance);
    expect(solved.seat.distanceTo(expected)).toBeLessThan(1e-9);
    // 相机在目标上方（俯视）且在南侧（+Z）
    expect(solved.seat.y).toBeGreaterThan(solved.target.y);
    expect(solved.seat.z).toBeGreaterThan(solved.target.z);
  });
});
