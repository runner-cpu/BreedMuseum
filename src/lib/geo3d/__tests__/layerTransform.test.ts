import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';
import * as THREE from 'three';
import { PLANE_ROTATION, planeToWorld, worldToPlane } from '../layerTransform';

/**
 * 图层变换契约。
 *
 * 触发这一组断言的真实故障：`ProvinceLayer` 在外层已旋转 −90° 的组里**又**套了
 * 一次同角度旋转，两次 −90° = −180°，平面点被映射成 (x, −y, −h)：
 * 版图沉到台面以下并向南错开约 1.1 个世界单位，页面上省块和落点光束完全对不上。
 * 因此这里锁死三件事：
 * 1. 平面点只能被抬高一次，高度必须朝上（世界 +Y），北必须朝世界 −Z；
 * 2. 往返变换必须自洽；
 * 3. 场景源码里只允许出现一处平面旋转，且取自 `PLANE_ROTATION`。
 */
describe('平面 → 世界 变换', () => {
  test('高度朝上，北朝 −Z，东西不变', () => {
    const base = planeToWorld(1, 2, 0);
    expect(base.x).toBeCloseTo(1, 9);
    expect(base.y).toBeCloseTo(0, 9);
    expect(base.z).toBeCloseTo(-2, 9);

    // 抬高 0.25：只增加世界 Y（高度），平面位置不动
    const lifted = planeToWorld(1, 2, 0.25);
    expect(lifted.x).toBeCloseTo(1, 9);
    expect(lifted.y).toBeCloseTo(0.25, 9);
    expect(lifted.z).toBeCloseTo(-2, 9);
  });

  test('往返变换自洽', () => {
    for (const [x, y, h] of [
      [0, 0, 0],
      [3.5, -2.25, 0.3],
      [-4.9, 3.9, 0.05],
    ]) {
      const world = planeToWorld(x, y, h);
      const back = worldToPlane(world);
      expect(back.x).toBeCloseTo(x, 9);
      expect(back.y).toBeCloseTo(y, 9);
      expect(back.height).toBeCloseTo(h, 9);
    }
  });

  test('旋转只施加一次：再来一次 −90° 会把平面点映射成 (x, −y, −h)', () => {
    const rotateAgain = new THREE.Euler(-Math.PI / 2, 0, 0);

    // 同一个平面点：地面 (1, 2, 0) 与抬高 (1, 2, 0.25)
    const groundOnce = planeToWorld(1, 2, 0);
    const groundTwice = groundOnce.clone().applyEuler(rotateAgain);
    expect(groundTwice.x).toBeCloseTo(1, 9);
    expect(groundTwice.y).toBeCloseTo(-2, 9);
    expect(Math.abs(groundTwice.z)).toBeLessThan(1e-9);

    const liftedOnce = planeToWorld(1, 2, 0.25);
    const liftedTwice = liftedOnce.clone().applyEuler(rotateAgain);
    // 分量各归其位：世界 Y 拿到「北」（−2，指向地面以下），世界 Z 拿到「高度」（−0.25，同样朝下）
    expect(liftedTwice.x).toBeCloseTo(1, 9);
    expect(liftedTwice.y).toBeCloseTo(-2, 9);
    expect(liftedTwice.z).toBeCloseTo(-0.25, 9);

    // 正确的一次旋转：世界 Y 是高度、世界 Z 是「北」（−y）
    expect(liftedOnce.x).toBeCloseTo(1, 9);
    expect(liftedOnce.y).toBeCloseTo(0.25, 9);
    expect(liftedOnce.z).toBeCloseTo(-2, 9);

    // 地面点最能说明症状：只旋转一次时它在 y = 0 的台面上；
    // 旋转两次后被扔到 y = −2，也就是沉到台面下方两个世界单位
    expect(groundOnce.y).toBeCloseTo(0, 9);
    expect(groundTwice.y).toBeLessThan(-1.9);
  });

  test('场景源码里只允许出现一处平面旋转，且取自 PLANE_ROTATION', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'src', 'components', 'lightmap', 'LightMapScene.tsx'),
      'utf8',
    );
    // 唯一一份旋转常量的定义方式
    expect(source).toMatch(/PLANE_ROTATION/);
    // 不允许再出现就地写的 −π/2 旋转组
    expect(source).not.toMatch(/rotation=\{ROT\}/);
    expect(source).not.toMatch(/-\s*Math\.PI\s*\/\s*2/);
    // 图层组件内部不得自带旋转组
    const provinceLayer = source.slice(
      source.indexOf('const ProvinceLayer'),
      source.indexOf('const CameraRig'),
    );
    expect(provinceLayer).not.toMatch(/rotation=\{/);
    // 旋转常量来自 layerTransform，而不是本文件里另写一份
    expect(source).toMatch(/PLANE_ROTATION\s*[,}]/);
  });

  test('PLANE_ROTATION 就是 −90°（唯一一份）', () => {
    expect(PLANE_ROTATION).toEqual([-Math.PI / 2, 0, 0]);
  });
});
