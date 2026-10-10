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
  buildSiteClusters,
  clustersForLens,
  hitRadiusFor,
  markerRadiusFor,
  stackHeightFor,
  type CategorySlice,
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
 * 约 1.1 个世界单位——页面上就是「省块和落点柱完全错位」。
 *
 * 落点形状（2026-10 重做）：
 * 上一版是 5px 宽的细光柱，同坐标 45 条记录还被铺成一个圆环——既不好看，也不表达
 * 任何字段。现在每个**产区簇**（`clusterSites.buildSiteClusters`）是一节分类堆叠柱：
 * 底面半径随该产区的品种数增长，柱身按类别分段上色、段高等于该类别在这个产区的条数，
 * 顶面金环标记含国家级保护名录，柱底细环标记含编辑口径濒危。想读的结论直接从柱子上
 * 读得出来：「成都这一片 53 个品种，羊和鸡最多」。
 *
 * 取景不是「半径 × 系数」估算，而是把版图包围盒的 8 个角投影进视锥解析求解
 * 并**自动选俯角**（`@/lib/geo3d/cameraFit`），再把目标点平移到 HUD 之间的可见带中心。
 *
 * 交互：拖拽旋转、滚轮/双指缩放、拖拽平移（OrbitControls），外层还提供四个视角预设
 * 与复位。细柱点不中，所以另铺一层隐形命中圆盘（`ClusterHitDiscs`）取最近的簇。
 */

const CAMERA_FOV = 45;
/** 版图最大挤出高度（与 EXTRUDE_STEPS 上限一致），用于包围盒的竖向范围。 */
const MAX_EXTRUDE = 0.39;

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

/* ------------------------------------------------------------------ */
/* 柱身：分类堆叠                                                     */
/* ------------------------------------------------------------------ */

export interface StackSlice {
  category: string;
  count: number;
  from: number;
  height: number;
  color: string;
}

/**
 * 把分类切片摊成一段段柱身。类别多于 `tailLimit` 时，尾部的都并成「其他类别」
 * ——否则 11 个类别会切成 11 段，每段几像素高，既看不出颜色也点不中。
 */
export function stackSlicesFor(
  slices: readonly CategorySlice[],
  palette: StagePalette,
  tailLimit = 6,
): StackSlice[] {
  const head = slices.slice(0, tailLimit);
  const tail = slices.slice(tailLimit);
  const merged: CategorySlice[] = tail.length
    ? [...head, { category: '其他类别', count: tail.reduce((sum, item) => sum + item.count, 0) }]
    : [...head];
  const total = merged.reduce((sum, item) => sum + item.count, 0) || 1;
  const height = stackHeightFor(total);
  const isDark = palette.beamBlending === 'additive';
  let cursor = 0;
  return merged.map((slice) => {
    const ratio = slice.count / total;
    const from = cursor;
    cursor += ratio * height;
    const base = slice.category === '其他类别' ? '#8d9a92' : categoryColors[slice.category] ?? '#95A5A6';
    return {
      category: slice.category,
      count: slice.count,
      from,
      height: ratio * height,
      color: beamColorFor(base, isDark),
    };
  });
}

/** 柱顶 z（世界平面高度），命中盘与装饰环都用它。 */
const stackTopFor = (total: number): number => stackHeightFor(total);

const ClusterStack = ({
  cluster,
  palette,
  selected,
  hovered,
  onSelect,
  onHover,
}: {
  cluster: SiteCluster;
  palette: StagePalette;
  selected: boolean;
  hovered: boolean;
  onSelect: () => void;
  onHover: (hovered: boolean) => void;
}) => {
  const active = selected || hovered;
  const radius = markerRadiusFor(cluster.total) * (active ? 1.12 : 1);
  const slices = useMemo(() => stackSlicesFor(cluster.slices, palette), [cluster.slices, palette]);
  const top = stackTopFor(cluster.total);
  const isDark = palette.beamBlending === 'additive';
  const edge = active ? highlightFor(palette) : palette.provinceEdge;

  return (
    <group
      position={[cluster.position[0], cluster.position[1], active ? 0.02 : 0]}
      onPointerOver={(event) => {
        event.stopPropagation();
        document.body.style.cursor = 'pointer';
        onHover(true);
      }}
      onPointerOut={() => {
        document.body.style.cursor = '';
        onHover(false);
      }}
      onClick={(event) => {
        event.stopPropagation();
        onSelect();
      }}
    >
      {slices.map((slice) => (
        <mesh key={slice.category} position={[0, 0, slice.from + slice.height / 2]}>
          <cylinderGeometry args={[radius, radius, slice.height, 18, 1, false]} />
          <meshStandardMaterial
            color={slice.color}
            emissive={slice.color}
            emissiveIntensity={active ? 0.55 : isDark ? 0.3 : 0.14}
            roughness={0.5}
            metalness={0.05}
          />
        </mesh>
      ))}
      {/* 顶面：柱子的边界与「这是一根柱子」的读法都来自它 */}
      <mesh position={[0, 0, top + 0.002]}>
        <circleGeometry args={[radius, 20]} />
        <meshBasicMaterial color={edge} side={THREE.DoubleSide} />
      </mesh>
      {/* 含国家级保护名录的产区：顶面一圈金环 */}
      {cluster.hasNationalProtected && (
        <mesh position={[0, 0, top + 0.006]}>
          <ringGeometry args={[radius * 0.7, radius * 0.96, 20]} />
          <meshBasicMaterial
            color={highlightFor(palette)}
            side={THREE.DoubleSide}
            transparent
            opacity={active ? 1 : 0.92}
          />
        </mesh>
      )}
      {/* 含编辑口径濒危记录的产区：柱底一圈细环（非权威结论，见诚实映射表） */}
      {cluster.hasEndangered && (
        <mesh position={[0, 0, 0.008]}>
          <ringGeometry args={[radius * 1.22, radius * 1.46, 22]} />
          <meshBasicMaterial
            color={palette.endangeredRing}
            side={THREE.DoubleSide}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}
    </group>
  );
};

/**
 * 隐形命中盘：细柱（1 条记录半径只有 0.06）在屏幕上不到 10px，直接点柱身很难点中。
 * 每个簇在柱顶铺一张半径 `hitRadiusFor` 的透明圆盘，实例化后只占 1 个 draw call。
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
      dummy.position.set(cluster.position[0], cluster.position[1], stackTopFor(cluster.total) + 0.02);
      // 圆盘几何半径 1，靠缩放取每簇自己的命中半径
      const scale = hitRadiusFor(cluster);
      dummy.scale.set(scale, scale, 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [clusters, dummy]);

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

  const clusters = useMemo(() => buildSiteClusters(), []);
  const visible = useMemo(() => clustersForLens(clusters, lens, category), [clusters, lens, category]);

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
   * 候选表比「细光柱时代」整体抬高：柱子现在最高约 1.6 世界单位，俯角太低时
   * 后排柱子会被前排完全遮住。
   */
  const home = useMemo<FramingSolution>(
    () =>
      solveFraming({
        box: framing.box ?? fallbackBox,
        minHeight: 0,
        maxHeight: MAX_EXTRUDE,
        fovDeg: CAMERA_FOV,
        aspect,
        margin: 1.03,
        insets: hudInsets,
        elevations: [0.6, 0.7, 0.8, 0.9, 1.0, 1.12, 1.24],
      }),
    [framing.box, aspect, hudInsets],
  );

  /** 省域聚焦：把该省（含挤出）塞进画面。 */
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
      maxHeight: MAX_EXTRUDE,
      fovDeg: CAMERA_FOV,
      aspect,
      margin: 1.28,
      insets: hudInsets,
      elevations: [Math.min(home.elevation, 1.0)],
    });
  }, [provinces, selectedProvince, aspect, hudInsets, home.elevation]);

  /** 视角预设：只换机位方向，包围盒与留白沿用主场解算。 */
  const presetView = useMemo<FramingSolution | null>(() => {
    if (!preset) return null;
    return solveFraming({
      box: framing.box ?? fallbackBox,
      minHeight: 0,
      maxHeight: MAX_EXTRUDE,
      fovDeg: CAMERA_FOV,
      aspect,
      margin: 1.06,
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
      <ambientLight intensity={palette.beamBlending === 'additive' ? 0.5 : 0.95} />
      <directionalLight position={[4, 9, 6]} intensity={palette.beamBlending === 'additive' ? 0.85 : 1.15} />
      <directionalLight position={[-6, 6, -4]} intensity={0.35} />

      {/* 展台台面：版图落在实体台面上，而不是浮在虚空里（浅色底上是宣纸衬板） */}
      <mesh rotation={PLANE_ROTATION} position={planeToWorld(framing.center[0], framing.center[1], -0.012).toArray()}>
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color={palette.floor} roughness={1} metalness={0} />
      </mesh>

      {/* 省块 / 产区堆叠柱 / 命中盘：同一旋转组，同一坐标系 */}
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
        {visible.map((cluster) => (
          <ClusterStack
            key={cluster.id}
            cluster={cluster}
            palette={palette}
            selected={cluster.members.some((member) => member.id === selectedId)}
            hovered={cluster.id === hoveredClusterId}
            onSelect={() => onSelectCluster(cluster)}
            onHover={(hovered) => setHoveredClusterId(hovered ? cluster.id : null)}
          />
        ))}
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
      */}
      {softShadows && (
        <ContactShadows
          position={[framing.center[0], -0.005, -framing.center[1]]}
          opacity={palette.beamBlending === 'additive' ? 0.45 : 0.38}
          scale={15}
          blur={2.4}
          far={4.5}
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
   * 每秒重画 47 块挤出几何 + 上百根堆叠柱——实测那会把主线程占满，连 Playwright
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
  const isDark = palette.beamBlending === 'additive';
  const baseEmissive = isDark ? 0.22 : 0.1;

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
