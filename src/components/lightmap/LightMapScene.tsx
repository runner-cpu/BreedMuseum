import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildProvinceGeometries,
  disposeProvinceGeometries,
  measureSceneFraming,
  type PlaneBounds,
  type ProvinceGeometry,
} from '@/lib/geo3d/buildProvinceGeometry';
import {
  MAX_BEAM_HEIGHT,
  beamHeightFor,
  beamRadiusFor,
  beamSegmentsFor,
  buildSiteClusters,
  clustersForLens,
  hitRadiusFor,
  type LensId,
  type SiteCluster,
} from '@/lib/geo3d/clusterSites';
import {
  cameraDirection,
  cameraSeat,
  solveFraming,
  type FitInsets,
  type FramingSolution,
} from '@/lib/geo3d/cameraFit';
import { categoryColors } from '@/lib/categoryIcons';
import { PLANE_ROTATION, planeToWorld } from '@/lib/geo3d/layerTransform';
import type { ViewPreset } from '@/lib/geo3d/viewPresets';
import { beamColorFor, type StagePalette } from '@/lib/stagePalette';
import { detectSoftwareRenderer, useReducedMotion } from './useSceneCapability';

/**
 * 畜种光图（3D 主展项）。
 *
 * 坐标约定（唯一一套，DOM 与 WebGL 共用）：
 * 地图数据是「平面 XY + 高度 Z」，+X 向东、+Y 向北、+Z 向上；场景里**只允许
 * 一次**把平面抬成水平面（`layerTransform.PLANE_ROTATION`，绕 X 轴 −90°），
 * 于是局部 (x, y, h) → 世界 (x, h, −y)：高度朝上、北朝世界 −Z。
 * 平面原点 = 视图中心，与省块几何 / `project3D` 同域（见 buildProvinceGeometry 的 toPlane）。
 *
 * 为什么旋转只准出现一次：`ProvinceLayer` 曾经在外层已旋转的组里又套了一层同角度
 * 旋转，两次 −90° = −180°，版图被映射成 (x, −y, −h)，整块沉到台面以下并向南错开
 * 约 1.1 个世界单位——页面上就是「省块和光束完全错位」。
 *
 * 落点形状（2026-10 二次重做）：
 * 空间聚合（`clusterSites.buildSiteClusters`）保留——上一版把同坐标的 45 条记录
 * 铺成一个圆环，那个毛病是真的。但**形状**走错了一步：为了让「类别分段」看得清，
 * 半径被放大到 0.055–0.295 世界单位，高度却只有 0.22–1.6，比例成了矮胖的圆柱，
 * 再乘上 `MeshStandardMaterial` 的受光，整片光图看着像插了一地木栓——名字叫光图，
 * 却一点不像光。这一版把形状改回**细、高、开口、自身发光**的光束
 * （尺寸函数见 `clusterSites.beamRadiusFor` / `beamHeightFor`）：
 * - 半径 0.012–0.046（屏幕上 2–8 像素），高 0.65–1.4，细长比 1 : 15 ~ 1 : 28；
 * - 几何是**开口**圆台（`openEnded`）+ 轻微上收（顶面 0.72×底面），
 *   配 `MeshBasicMaterial`（不受光）+ 深色底 `AdditiveBlending`（自发光靠叠加，不是照亮）；
 * - 类别分段保留为束身上的色带，深色底上叠加后读成「一束光里的分色」；
 * - 束根与束顶各铺一层径向渐变光晕（`Points` + canvas 程序化贴图，零外部资产）。
 *
 * 渲染纪律：161 个产区、每区 1–7 段，全部合并进**一个** `InstancedMesh`
 * （每段一个实例、颜色走 `instanceColor`），加两层光晕点云，共 3 个 draw call。
 *
 * 取景不是「半径 × 系数」估算，而是把版图包围盒的 8 个角投影进视锥解析求解
 * 并**自动选俯角**（`@/lib/geo3d/cameraFit`），再把目标点平移到 HUD 之间的可见带中心。
 *
 * 交互：拖拽旋转、滚轮/双指缩放、拖拽平移（OrbitControls），外层还提供四个视角预设
 * 与复位。光束本身只有几个像素宽，所以另铺一层隐形命中盘（`ClusterHitDiscs`）取最近的束。
 */

const CAMERA_FOV = 45;
/**
 * 取景包围盒的竖向范围：光束最高值（不是省块挤出高度）。
 * 用省块上限会把最高的那几束裁掉——实测成都那一片刚好在版图中部，
 * 裁掉一处最密的产区，光图就少了一块最该看到的地方。
 */
const FIT_MAX_HEIGHT = MAX_BEAM_HEIGHT;

/** 顶面裁剪出「金环」用的半径下限（世界单位）：几像素宽的光束也要有个能看见的环。 */
const RING_FLOOR = 0.052;
/** 束底「橙环」半径下限：略大于金环，两环同时出现时不会重合。 */
const RISK_RING_FLOOR = 0.074;

interface ControlsLike {
  enabled: boolean;
  target?: THREE.Vector3;
  update?: () => void;
}

interface LightMapSceneProps {
  lens: LensId;
  category: string | null;
  selectedProvince: string | null;
  selectedId: string | null;
  palette: StagePalette;
  /** HUD 占用的安全区（比例 0–1），取景时排除，避免版图被标题/镜头条遮住 */
  hudInsets?: FitInsets;
  /** 手动选定的视角预设（null = 自动取景） */
  preset?: ViewPreset | null;
  /** 复位信号：每次自增都把 OrbitControls 的目标点拉回取景中心 */
  resetToken?: number;
  onSelectProvince: (province: string | null) => void;
  onHoverProvince: (province: string | null) => void;
  onSelectCluster: (cluster: SiteCluster) => void;
}

/** 高亮色：深色舞台用金，浅色舞台用更深的金，保证压在省块 / 台面上都读得出。 */
const highlightFor = (palette: StagePalette): string =>
  palette.beamBlending === 'additive' ? palette.gold : palette.goldOnLight;

/** 深色舞台（自发光、加性混合）走一套，浅色舞台（正常混合、纸面可读色）走另一套。 */
const isNightStage = (palette: StagePalette): boolean => palette.beamBlending === 'additive';

/* ------------------------------------------------------------------ */
/* 光束场：一个大 InstancedMesh 画完全部束身分段                        */
/* ------------------------------------------------------------------ */

/** 一段束身在世界平面里的摆放（不含颜色——颜色由主题与高亮状态决定）。 */
interface BeamInstance {
  clusterIndex: number;
  x: number;
  y: number;
  /** 段底高度（世界平面单位） */
  from: number;
  height: number;
  radius: number;
  category: string;
}

/**
 * 把「簇 → 分段」展平成一维实例表。
 *
 * 展平的意义：161 个产区按每区一个 mesh 画，光 draw call 就要三四百次；
 * 每段一个实例塞进同一个 `InstancedMesh` 之后，整片光场只占 1 次。
 * 交互沿用 `instanceId → 实例 → 簇` 的映射，悬停与选中都不必另建几何。
 */
function flattenBeams(clusters: readonly SiteCluster[], tailLimit = 6): BeamInstance[] {
  const instances: BeamInstance[] = [];
  clusters.forEach((cluster, clusterIndex) => {
    const radius = beamRadiusFor(cluster.total);
    // 高度取整束的 beamHeightFor(cluster.total)，与切片合计无关：
    // 镜头切换后同一束光的高度和位置都不变，变的只是分段构成。
    for (const segment of beamSegmentsFor(cluster, tailLimit)) {
      instances.push({
        clusterIndex,
        x: cluster.position[0],
        y: cluster.position[1],
        from: segment.from,
        height: segment.height,
        radius,
        category: segment.category,
      });
    }
  });
  return instances;
}

/** 束身实例表的最大容量（全部簇的段数之和）：镜头筛选只会让它变少，不会变多。 */
const beamCapacityFor = (clusters: readonly SiteCluster[]): number =>
  clusters.reduce((sum, cluster) => sum + beamSegmentsFor(cluster).length, 0);

/**
 * 光束本体。
 *
 * 几何：开口圆台（`openEnded: true`），底面半径 1、顶面 0.72，
 * 旋转到平面 Z 轴并整体平移，使**底端落在 z = 0、顶端落在 z = 1**——
 * 这样实例矩阵只需要 `position(x, y, from)` + `scale(radius, radius, height)`。
 *
 * 材质：`MeshBasicMaterial` + `depthWrite: false`。
 * 不用标准材质是刻意的：光不该被环境光照亮，而该自己发光。
 * 深色舞台开 `AdditiveBlending`（越叠越亮，密集区自然形成光晕）；
 * 浅色舞台退回正常混合，颜色改用 `beamColorFor` 压到纸面可读的深色相——
 * 加性混合在浅底上等于把颜色洗成白色，是上一版浅色主题发灰的根因之一。
 */
const BeamField = ({
  clusters,
  capacity,
  palette,
  selectedId,
  hoveredClusterId,
  onSelect,
  onHover,
}: {
  clusters: SiteCluster[];
  capacity: number;
  palette: StagePalette;
  selectedId: string | null;
  hoveredClusterId: string | null;
  onSelect: (cluster: SiteCluster) => void;
  onHover: (cluster: SiteCluster | null) => void;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const night = isNightStage(palette);
  const highlight = highlightFor(palette);

  const beamGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.72, 1, 1, 8, 1, true);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, 0.5);
    return geometry;
  }, []);
  useEffect(() => () => beamGeometry.dispose(), [beamGeometry]);

  const instances = useMemo(() => flattenBeams(clusters), [clusters]);

  /**
   * 尺寸与配色每帧写一次就够，只在「哪些束可见 / 谁被选中」变化时重写。
   * 呼吸动画只改材质的整体透明度，不重算实例矩阵——上一版逐帧重算 1062 个矩阵
   * 是 CI 软栈上掉帧的主因之一。
   */
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    mesh.count = instances.length;
    if (instances.length === 0) return;

    const activeClusters = new Set<number>();
    clusters.forEach((cluster, index) => {
      if (cluster.id === hoveredClusterId || cluster.members.some((member) => member.id === selectedId)) {
        activeClusters.add(index);
      }
    });

    const color = new THREE.Color();
    instances.forEach((instance, index) => {
      const active = activeClusters.has(instance.clusterIndex);
      // 高亮：变粗一点、略高一点、整束换成金色——不动位置，避免"点一下跳走"
      const thickness = instance.radius * (active ? 1.9 : 1);
      const length = instance.height * (active ? 1.12 : 1);
      dummy.position.set(instance.x, instance.y, instance.from);
      dummy.scale.set(thickness, thickness, length);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);

      const base = instance.category === '其他类别' ? '#8d9a92' : categoryColors[instance.category] ?? '#95A5A6';
      color.set(active ? highlight : beamColorFor(base, night));
      mesh.setColorAt(index, color);
    });

    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [instances, clusters, palette, selectedId, hoveredClusterId, highlight, night, dummy]);

  /** 整片光场的呼吸：只改材质透明度，一帧一次赋值。 */
  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    if (!night) {
      material.opacity = palette.beamOpacity;
      return;
    }
    material.opacity = palette.beamOpacity * (0.88 + 0.12 * Math.sin(clock.getElapsedTime() * 3.2));
  });

  if (capacity === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[beamGeometry, undefined, capacity]}
      onPointerMove={(event) => {
        event.stopPropagation();
        const index = event.instanceId;
        if (index === undefined) return;
        document.body.style.cursor = 'pointer';
        onHover(clusters[instances[index].clusterIndex]);
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        onHover(null);
      }}
      onClick={(event) => {
        event.stopPropagation();
        const index = event.instanceId;
        if (index === undefined) return;
        onSelect(clusters[instances[index].clusterIndex]);
      }}
    >
      <meshBasicMaterial
        ref={materialRef}
        transparent
        opacity={palette.beamOpacity}
        blending={night ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

/* ------------------------------------------------------------------ */
/* 光晕：束根与束顶各一层径向渐变点云                                    */
/* ------------------------------------------------------------------ */

/**
 * 径向渐变贴图，canvas 程序化生成（零外部资产，不引入任何图片）。
 *
 * 三段色标是"光"和"圆片"的分界：0 → 0.32 陡降出实心核，
 * 0.32 → 1 缓慢收敛成柔和外晕。只用两段（实心 + 硬边）会读成贴纸。
 */
function createGlowTexture(): THREE.Texture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.32, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(0.62, 'rgba(255,255,255,0.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** 一层点云光晕。位置由调用方给，尺寸/颜色/混合方式按主题分档。 */
const GlowPoints = ({
  positions,
  size,
  color,
  opacity,
  additive,
  texture,
}: {
  positions: Float32Array;
  size: number;
  color: string;
  opacity: number;
  additive: boolean;
  texture: THREE.Texture;
}) => {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [positions]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  if (positions.length === 0) return null;

  return (
    <points geometry={geometry}>
      <pointsMaterial
        map={texture}
        size={size}
        sizeAttenuation
        transparent
        opacity={opacity}
        color={color}
        depthWrite={false}
        blending={additive ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
};

/**
 * 束根 + 束顶两层光晕。共用一张贴图、各自的点云几何，共 2 个 draw call。
 *
 * 为什么顶面也要发光：只有根部光晕时，光束读起来像"从地里长出来的针"；
 * 顶端有一点亮，才像"光柱本身在发光"。深色底尤其明显。
 */
const BeamGlow = ({ clusters, palette }: { clusters: SiteCluster[]; palette: StagePalette }) => {
  const texture = useMemo(createGlowTexture, []);
  useEffect(() => () => texture.dispose(), [texture]);
  const night = isNightStage(palette);

  const { roots, tips } = useMemo(() => {
    const rootPositions = new Float32Array(clusters.length * 3);
    const tipPositions = new Float32Array(clusters.length * 3);
    clusters.forEach((cluster, index) => {
      rootPositions[index * 3] = cluster.position[0];
      rootPositions[index * 3 + 1] = cluster.position[1];
      rootPositions[index * 3 + 2] = 0.012;
      tipPositions[index * 3] = cluster.position[0];
      tipPositions[index * 3 + 1] = cluster.position[1];
      tipPositions[index * 3 + 2] = beamHeightFor(cluster.total);
    });
    return { roots: rootPositions, tips: tipPositions };
  }, [clusters]);

  return (
    <>
      <GlowPoints
        positions={roots}
        size={night ? 0.11 : 0.09}
        color={night ? '#ffffff' : palette.goldOnLight}
        opacity={night ? 0.8 : 0.42}
        additive={night}
        texture={texture}
      />
      <GlowPoints
        positions={tips}
        size={night ? 0.075 : 0.06}
        color={night ? '#ffffff' : palette.goldOnLight}
        opacity={night ? 0.62 : 0.3}
        additive={night}
        texture={texture}
      />
    </>
  );
};

/* ------------------------------------------------------------------ */
/* 标记环：金环（国家级保护）/ 橙环（编辑口径濒危）                      */
/* ------------------------------------------------------------------ */

/**
 * 两种环各一个 InstancedMesh（几何半径 1，靠实例缩放取值）。
 *
 * 环半径有**绝对下限**（`RING_FLOOR` / `RISK_RING_FLOOR`），不跟光束半径等比：
 * 光束现在只有 2–8 像素宽，等比缩放出来的环还不到 1 像素，等于没画。
 * 环本身是「有没有国家级保护 / 编辑口径濒危」的二元标记，用固定尺寸反而更好读。
 */
const MarkerRings = ({ clusters, palette }: { clusters: SiteCluster[]; palette: StagePalette }) => {
  const goldRef = useRef<THREE.InstancedMesh>(null);
  const riskRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const protectedClusters = useMemo(() => clusters.filter((cluster) => cluster.hasNationalProtected), [clusters]);
  const riskyClusters = useMemo(() => clusters.filter((cluster) => cluster.hasEndangered), [clusters]);

  useEffect(() => {
    const mesh = goldRef.current;
    if (!mesh) return;
    protectedClusters.forEach((cluster, index) => {
      const scale = Math.max(RING_FLOOR, beamRadiusFor(cluster.total) * 1.9);
      dummy.position.set(cluster.position[0], cluster.position[1], beamHeightFor(cluster.total) + 0.004);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [protectedClusters, dummy]);

  useEffect(() => {
    const mesh = riskRef.current;
    if (!mesh) return;
    riskyClusters.forEach((cluster, index) => {
      const scale = Math.max(RISK_RING_FLOOR, beamRadiusFor(cluster.total) * 2.4);
      dummy.position.set(cluster.position[0], cluster.position[1], 0.01);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [riskyClusters, dummy]);

  return (
    <>
      {protectedClusters.length > 0 && (
        <instancedMesh ref={goldRef} args={[undefined, undefined, protectedClusters.length]}>
          <ringGeometry args={[0.62, 0.92, 24]} />
          <meshBasicMaterial
            color={highlightFor(palette)}
            side={THREE.DoubleSide}
            transparent
            opacity={0.95}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      )}
      {riskyClusters.length > 0 && (
        <instancedMesh ref={riskRef} args={[undefined, undefined, riskyClusters.length]}>
          <ringGeometry args={[0.78, 1, 24]} />
          <meshBasicMaterial
            color={palette.endangeredRing}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
            depthWrite={false}
            toneMapped={false}
          />
        </instancedMesh>
      )}
    </>
  );
};

/**
 * 隐形命中盘：细光束（2 像素宽）在屏幕上几乎点不中。
 * 每个簇在束顶铺一张半径 `hitRadiusFor` 的透明圆盘，实例化后只占 1 个 draw call。
 */
const ClusterHitDiscs = ({
  clusters,
  onSelect,
  onHover,
}: {
  clusters: SiteCluster[];
  onSelect: (cluster: SiteCluster) => void;
  onHover: (cluster: SiteCluster | null) => void;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    clusters.forEach((cluster, index) => {
      dummy.position.set(cluster.position[0], cluster.position[1], beamHeightFor(cluster.total) + 0.02);
      // 圆盘几何半径 1，靠缩放取每簇自己的命中半径
      const scale = hitRadiusFor(cluster.total);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [clusters, dummy]);

  if (clusters.length === 0) return null;

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, clusters.length]}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (event.instanceId !== undefined) onHover(clusters[event.instanceId]);
      }}
      onPointerOut={() => onHover(null)}
      onClick={(event) => {
        event.stopPropagation();
        const index = event.instanceId;
        if (index === undefined) return;
        onSelect(clusters[index]);
      }}
    >
      <circleGeometry args={[1, 20]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
    </instancedMesh>
  );
};

/* ------------------------------------------------------------------ */
/* 相机                                                                */
/* ------------------------------------------------------------------ */

/** 进场 / 镜头切换 / 视角预设 / 省份聚焦共用的相机曲线（≤1.1s）；reduced-motion 直接到位。 */
const CameraRig = ({
  target,
  position,
  reducedMotion,
}: {
  target: THREE.Vector3;
  position: THREE.Vector3;
  reducedMotion: boolean;
}) => {
  const camera = useThree((state) => state.camera);
  const invalidate = useThree((state) => state.invalidate);
  const fromRef = useRef(new THREE.Vector3());
  const toRef = useRef(new THREE.Vector3());
  const targetRef = useRef(new THREE.Vector3());
  const startedAt = useRef(0);

  useEffect(() => {
    fromRef.current.copy(camera.position);
    toRef.current.copy(position);
    targetRef.current.copy(target);
    startedAt.current = performance.now();
    if (reducedMotion) {
      camera.position.copy(toRef.current);
      camera.lookAt(targetRef.current);
    } else {
      // 按需渲染（软件光栅降级）下没人会自动再画一帧，镜头过渡必须自己续帧
      invalidate();
    }
  }, [camera, position, target, reducedMotion, invalidate]);

  useFrame(() => {
    if (reducedMotion) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const progress = Math.min(1, elapsed / 1.1);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    camera.position.lerpVectors(fromRef.current, toRef.current, eased);
    camera.lookAt(targetRef.current);
    if (progress < 1) invalidate();
  });

  return null;
};

/* ------------------------------------------------------------------ */
/* 场景                                                                */
/* ------------------------------------------------------------------ */

/** 场景内容（必须在 Canvas 内，才能读画布尺寸解算取景）。 */
const SceneBody = ({
  lens,
  category,
  selectedProvince,
  selectedId,
  palette,
  hudInsets,
  preset,
  resetToken,
  onSelectProvince,
  onHoverProvince,
  onSelectCluster,
}: LightMapSceneProps) => {
  const reducedMotion = useReducedMotion();
  /** 软件光栅（无显卡的 CI runner）上关掉纯装饰的开销，见 useSceneCapability 说明。 */
  const softShadows = useMemo(() => !detectSoftwareRenderer(), []);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const [hoveredClusterId, setHoveredClusterId] = useState<string | null>(null);
  const size = useThree((state) => state.size);
  const night = isNightStage(palette);

  const clusters = useMemo(() => buildSiteClusters(), []);
  const visible = useMemo(() => clustersForLens(clusters, lens, category), [clusters, lens, category]);
  /** 实例容量按"全部簇"分配：镜头筛选只会减少绘制数量，不会重建 GPU 缓冲。 */
  const capacity = useMemo(() => beamCapacityFor(clusters), [clusters]);

  /** 省块挤出读的是「该省馆藏量」，与镜头无关：始终用全量簇的省份合计。 */
  const provinceCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const cluster of clusters) {
      counts.set(cluster.province, (counts.get(cluster.province) ?? 0) + cluster.total);
    }
    return counts;
  }, [clusters]);

  const provinces = useMemo(() => buildProvinceGeometries(provinceCounts), [provinceCounts]);
  useEffect(() => () => disposeProvinceGeometries(provinces), [provinces]);

  const framing = useMemo(() => measureSceneFraming(provinces), [provinces]);
  const fallbackBox: PlaneBounds = { minX: -5, maxX: 5, minY: -4, maxY: 4 };
  const aspect = Math.max(0.4, size.width / Math.max(1, size.height));

  /**
   * 主场取景：候选俯角各解一次，取屏幕占比最大者，并让版图落在 HUD 之间的可见带正中。
   * 竖向范围取光束最高值——光比版图高得多，只按挤出高度取景会把最密的几束裁掉。
   */
  const home = useMemo<FramingSolution>(
    () =>
      solveFraming({
        box: framing.box ?? fallbackBox,
        minHeight: 0,
        maxHeight: FIT_MAX_HEIGHT,
        fovDeg: CAMERA_FOV,
        aspect,
        margin: 1.06,
        insets: hudInsets,
        elevations: [0.62, 0.72, 0.82, 0.92, 1.02, 1.14, 1.26],
      }),
    [framing.box, aspect, hudInsets],
  );

  /** 省域聚焦：把该省（含光束高度）塞进画面。 */
  const focus = useMemo<FramingSolution | null>(() => {
    if (!selectedProvince) return null;
    const province = provinces.find((item) => item.simpleName === selectedProvince);
    if (!province) return null;
    const box = province.bounds.mainland ?? province.bounds.all ?? {
      minX: province.center[0] - 0.6,
      maxX: province.center[0] + 0.6,
      minY: province.center[1] - 0.6,
      maxY: province.center[1] + 0.6,
    };
    return solveFraming({
      box,
      minHeight: 0,
      maxHeight: FIT_MAX_HEIGHT,
      fovDeg: CAMERA_FOV,
      aspect,
      margin: 1.24,
      insets: hudInsets,
      elevations: [Math.min(home.elevation, 0.92)],
    });
  }, [provinces, selectedProvince, aspect, hudInsets, home.elevation]);

  /** 视角预设：只换机位方向，包围盒与留白沿用主场解算。 */
  const presetView = useMemo<FramingSolution | null>(() => {
    if (!preset) return null;
    return solveFraming({
      box: framing.box ?? fallbackBox,
      minHeight: 0,
      maxHeight: FIT_MAX_HEIGHT,
      fovDeg: CAMERA_FOV,
      aspect,
      margin: 1.08,
      insets: hudInsets,
      elevations: [preset.elevation],
    });
  }, [preset, framing.box, aspect, hudInsets]);

  const view = presetView ?? focus ?? home;
  const maxDistance = Math.max(home.distance, view.distance) * 2.2;
  const minDistance = Math.max(1.2, Math.min(home.distance, view.distance) * 0.3);

  /** 预设的方位角：solveFraming 只解「从南边看」，方位由这里再绕 Y 轴转过去。 */
  const seat = useMemo(() => {
    if (!preset) return view.seat;
    return cameraSeat(view.target, cameraDirection(preset.elevation, preset.azimuth), view.distance);
  }, [preset, view]);

  /**
   * 复位 / 换镜头时同步 OrbitControls 的目标点，否则拖动会绕旧中心转，
   * 出现「省域聚焦了但一转就飞走」。
   */
  const controlsRef = useRef<ControlsLike | null>(null);
  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls?.target) return;
    controls.target.set(view.target.x, view.target.y, view.target.z);
    controls.update?.();
  }, [view.target, resetToken]);

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fogExp2 attach="fog" args={[palette.bg, palette.fogDensity]} />
      <ambientLight intensity={night ? 0.5 : 0.95} />
      <directionalLight position={[4, 9, 6]} intensity={night ? 0.85 : 1.15} />
      <directionalLight position={[-6, 6, -4]} intensity={0.35} />

      {/* 展台台面：版图落在实体台面上，而不是浮在虚空里（浅色底上是宣纸衬板） */}
      <mesh rotation={PLANE_ROTATION} position={planeToWorld(framing.center[0], framing.center[1], -0.012).toArray()}>
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color={palette.floor} roughness={1} metalness={0} />
      </mesh>

      {/* 省块 / 光束 / 标记环 / 命中盘：同一旋转组，同一坐标系 */}
      <group rotation={PLANE_ROTATION}>
        <ProvinceLayer
          provinces={provinces}
          palette={palette}
          selectedProvince={selectedProvince}
          hoveredProvince={hoveredProvince}
          onSelectProvince={onSelectProvince}
          onHoverProvince={(province) => {
            setHoveredProvince(province);
            onHoverProvince(province);
          }}
        />
        <BeamField
          clusters={visible}
          capacity={capacity}
          palette={palette}
          selectedId={selectedId}
          hoveredClusterId={hoveredClusterId}
          onSelect={onSelectCluster}
          onHover={(cluster) => setHoveredClusterId(cluster?.id ?? null)}
        />
        <BeamGlow clusters={visible} palette={palette} />
        <MarkerRings clusters={visible} palette={palette} />
        <ClusterHitDiscs
          clusters={visible}
          onSelect={onSelectCluster}
          onHover={(cluster) => setHoveredClusterId(cluster?.id ?? null)}
        />
      </group>

      {/*
        软阴影是纯装饰：每帧它都会把整个场景额外渲染一遍再两次模糊。
        无 GPU 的 CI runner（SwiftShader 软件光栅）上这一项就把场景压到个位数帧率，
        连带点击和断言一起超时——所以按 WebGL 后端分档，软件渲染直接不出阴影。
        浅色舞台上再压一档不透明度：纸底上的深阴影会糊成一大片脏斑，
        光束本来就细，也不需要靠阴影立住。
      */}
      {softShadows && (
        <ContactShadows
          position={[framing.center[0], -0.005, -framing.center[1]]}
          opacity={night ? 0.42 : 0.16}
          scale={15}
          blur={2.6}
          far={3}
          color={palette.shadow}
        />
      )}
      <OrbitControls
        ref={controlsRef as never}
        makeDefault
        enableDamping
        dampingFactor={0.08}
        enablePan
        rotateSpeed={0.85}
        zoomSpeed={0.9}
        target={[view.target.x, view.target.y, view.target.z]}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minPolarAngle={0.12}
        maxPolarAngle={Math.PI * 0.47}
      />
      <CameraRig target={view.target} position={seat} reducedMotion={reducedMotion} />
    </>
  );
};

export function LightMapScene(props: LightMapSceneProps) {
  const initialPosition = useMemo(
    () =>
      cameraSeat(new THREE.Vector3(0, 0, 0), cameraDirection(0.78), 16).toArray() as [number, number, number],
    [],
  );
  /**
   * 软件光栅（无显卡的 CI runner）按需渲染：版图是静态的，只要没有交互就不必
   * 每秒重画 47 块挤出几何 + 上百根光束——实测那会把主线程占满，连 Playwright
   * 的点击都要排到帧后面。真 GPU 上一律保持连续渲染（默认分支）。
   */
  const software = useMemo(() => detectSoftwareRenderer(), []);

  return (
    <Canvas
      dpr={[1, 2]}
      frameloop={software ? 'demand' : 'always'}
      gl={{ antialias: !software, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: initialPosition, fov: CAMERA_FOV, near: 0.1, far: 200 }}
      onPointerMissed={() => props.onSelectProvince(null)}
    >
      <SceneBody {...props} />
    </Canvas>
  );
}

/* ------------------------------------------------------------------ */
/* 省块                                                               */
/* ------------------------------------------------------------------ */

const ProvinceLayer = ({
  provinces,
  palette,
  selectedProvince,
  hoveredProvince,
  onSelectProvince,
  onHoverProvince,
}: {
  provinces: ProvinceGeometry[];
  palette: StagePalette;
  selectedProvince: string | null;
  hoveredProvince: string | null;
  onSelectProvince: (province: string | null) => void;
  onHoverProvince: (province: string | null) => void;
}) => {
  const night = isNightStage(palette);
  const baseEmissive = night ? 0.22 : 0.1;

  return (
    <>
      {provinces.map((province) => {
        const selected = province.simpleName === selectedProvince;
        const hovered = province.simpleName === hoveredProvince;
        const lift = selected ? 0.07 : hovered ? 0.035 : 0;

        if (province.degraded) {
          return (
            <mesh
              key={province.fullName}
              position={[province.center[0], province.center[1], 0.04]}
              onPointerOver={(event) => {
                event.stopPropagation();
                onHoverProvince(province.simpleName);
              }}
              onPointerOut={() => onHoverProvince(null)}
              onClick={(event) => {
                event.stopPropagation();
                onSelectProvince(selected ? null : province.simpleName);
              }}
            >
              <sphereGeometry args={[0.045, 14, 14]} />
              <meshStandardMaterial color={palette.gold} emissive={palette.gold} emissiveIntensity={0.7} />
              <Edges color={palette.gold} />
            </mesh>
          );
        }

        return (
          <mesh
            key={province.fullName}
            geometry={province.geometry!}
            position={[0, 0, lift]}
            onPointerOver={(event) => {
              event.stopPropagation();
              document.body.style.cursor = 'pointer';
              onHoverProvince(province.simpleName);
            }}
            onPointerOut={() => {
              document.body.style.cursor = '';
              onHoverProvince(null);
            }}
            onClick={(event) => {
              event.stopPropagation();
              onSelectProvince(selected ? null : province.simpleName);
            }}
          >
            <meshStandardMaterial
              color={selected || hovered ? palette.gold : palette.province}
              roughness={0.92}
              metalness={0.03}
              emissive={selected || hovered ? palette.gold : palette.provinceEmissive}
              emissiveIntensity={selected ? 0.85 : hovered ? 0.5 : baseEmissive}
            />
            {/* 描边是版图在浅色纸底上的可读性来源，不能省 */}
            <Edges color={selected || hovered ? palette.gold : palette.provinceEdge} />
          </mesh>
        );
      })}
    </>
  );
};
