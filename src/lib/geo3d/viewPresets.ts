/**
 * 光图视角预设。
 *
 * 单独成模块的原因：预设要在页面 HUD（按钮）与三维场景（相机）两边共用，
 * 而场景是 `lazy()` 动态加载的——页面直接 `import` 场景文件会把 three 一起
 * 拽进首屏 chunk，lazy 就白写了（构建时会报 INEFFECTIVE_DYNAMIC_IMPORT）。
 *
 * `elevation` 是从水平面算起的俯角（弧度），`azimuth` 是绕地图中心的方位角，
 * 两者都直接喂给 `cameraFit.cameraDirection`。
 */
export interface ViewPreset {
  id: string;
  label: string;
  hint: string;
  elevation: number;
  azimuth: number;
}

export const VIEW_PRESETS: readonly ViewPreset[] = [
  { id: 'iso', label: '斜视', hint: '从南方俯视全图（默认）', elevation: 0.72, azimuth: 0 },
  { id: 'top', label: '俯瞰', hint: '接近垂直向下，看整体分布', elevation: 1.3, azimuth: 0 },
  { id: 'level', label: '平视', hint: '压低视角，柱体高低差最明显', elevation: 0.44, azimuth: 0 },
  { id: 'east', label: '东侧', hint: '从东面看，西部高原退到远处', elevation: 0.66, azimuth: Math.PI / 2 },
];
