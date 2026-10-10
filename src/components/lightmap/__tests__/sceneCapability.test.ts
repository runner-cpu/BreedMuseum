import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { beforeEach, describe, expect, test, vi } from 'vitest';

/**
 * 软件光栅降级契约。
 *
 * 触发这一组断言的真实故障：无显卡的 CI runner（Chromium 的 SwiftShader 软栈）上，
 * 场景仍按「有 GPU」的配置跑——接触阴影每帧重画整个场景再做两次全屏模糊，
 * 加上连续渲染，实测页面掉到 8–9 fps、长任务占满主线程，
 * Playwright 的重活用例（光图省份聚焦 + 摘要表）因此 30 秒超时，Pages 部署被卡住。
 *
 * 所以这里锁两件事：
 * 1. `detectSoftwareRenderer()` 能认出软栈（SwiftShader / llvmpipe / 纯软件），
 *    并且在没有 GPU 信息时保守地当作「有 GPU」；
 * 2. 场景源码确实把降级接到了 `frameloop`、`antialias` 与接触阴影上，
 *    并且在按需渲染下主动续帧，避免降级后画面停在旧帧。
 */

const SCENE = resolve(process.cwd(), 'src', 'components', 'lightmap', 'LightMapScene.tsx');

/** 把 canvas.getContext 换成一个只回答 renderer 字符串的假上下文。 */
const stubRenderer = (renderer: string | null) => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
    if (renderer === null) return null;
    return {
      getExtension: (name: string) => (name === 'WEBGL_debug_renderer_info' ? { UNMASKED_RENDERER_WEBGL: 0x9246 } : null),
      getParameter: () => renderer,
    } as unknown as RenderingContext;
  });
};

const load = async () => {
  vi.resetModules();
  return import('../useSceneCapability');
};

describe('软件光栅降级', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  test('认出 SwiftShader 软栈', async () => {
    const { detectSoftwareRenderer } = await load();
    stubRenderer('ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)');
    expect(detectSoftwareRenderer()).toBe(true);
  });

  test('llvmpipe 等软栈同样命中', async () => {
    const { detectSoftwareRenderer } = await load();
    stubRenderer('Mesa/X.org, llvmpipe (LLVM 15.0.7, 256 bits)');
    expect(detectSoftwareRenderer()).toBe(true);
  });

  test('真 GPU 不降级，且拿不到渲染器信息时也按有 GPU 处理', async () => {
    const { detectSoftwareRenderer } = await load();
    stubRenderer('ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Direct3D11 vs_5_0 ps_5_0, D3D11)');
    expect(detectSoftwareRenderer()).toBe(false);

    const second = await load();
    // 没有 WEBGL_debug_renderer_info（被隐私设置屏蔽）时不能误判成软栈
    stubRenderer(null);
    expect(second.detectSoftwareRenderer()).toBe(false);
  });

  test('场景把降级接到按需渲染、抗锯齿与接触阴影上，并在过渡中续帧', () => {
    const source = readFileSync(SCENE, 'utf8');
    expect(source).toMatch(/detectSoftwareRenderer/);
    // 按需渲染：软栈下 'demand'，真 GPU 仍是 'always'
    expect(source).toMatch(/frameloop=\{software \? 'demand' : 'always'\}/);
    expect(source).toMatch(/antialias: !software/);
    // 接触阴影只在有 GPU 时出
    expect(source).toMatch(/\{softShadows && \(/);
    // 按需渲染下镜头过渡必须自己续帧，否则降级后画面停在旧帧
    const rig = source.slice(source.indexOf('const CameraRig'), source.indexOf('const SceneBody'));
    expect(rig).toMatch(/invalidate/);
    expect(rig).toMatch(/if \(progress < 1\) invalidate\(\)/);
  });
});
