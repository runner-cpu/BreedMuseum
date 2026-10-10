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
  cameraDirection,
  cameraSeat,
  solveFraming,
  type FitInsets,
  type FramingSolution,
} from '@/lib/geo3d/cameraFit';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest, buildPillars, type PillarInstance } from '@/lib/geo3d/lightMapData';
import { PLANE_ROTATION, planeToWorld } from '@/lib/geo3d/layerTransform';
import { beamColorFor, type StagePalette } from '@/lib/stagePalette';
import { useReducedMotion } from './useSceneCapability';

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
 * 约 1.1 个世界单位——页面上就是「省块和光柱完全错位」。现在旋转只从
 * `layerTransform` 取，并由 `layerTransform.test.ts` 断言全文件只出现一处。
 *
 * 取景不是「半径 × 系数」估算，而是把版图包围盒的 8 个角投影进视锥解析求解
 * 并**自动选俯角**（`@/lib/geo3d/cameraFit`）：舞台是扁宽的，固定俯角会让版图
 * 要么被裁掉、要么缩成一条横带；候选俯角各解一次取屏幕占比最大者，
 * 再把目标点平移到 HUD 之间的可见带中心。
 *
 * 四个镜头是同一场景的灯光切换（不是四个页面）：
 *   all      全部分布
 *   category 类别构成（选中类别）
 *   protect  国家级保护（940 号公告 271）
 *   risk      濒危之窗（编辑口径 82）
 */

export type LensId = 'all' | 'category' | 'protect' | 'risk';

const CAMERA_FOV = 45;
/** 版图最大挤出高度（与 EXTRUDE_STEPS 上限一致），用于包围盒的竖向范围。 */
const MAX_EXTRUDE = 0.3;

interface ControlsLike {
  enabled: boolean;
}

interface LightMapSceneProps {
  lens: LensId;
  category: string | null;
  selectedProvince: string | null;
  selectedId: string | null;
  palette: StagePalette;
  /** HUD 占用的安全区（比例 0–1），取景时排除，避免版图被标题/镜头条遮住 */
  hudInsets?: FitInsets;
  onSelectProvince: (province: string | null) => void;
  onHoverProvince: (province: string | null) => void;
  onSelectPillar: (pillar: PillarInstance) => void;
}

/** 镜头可见性（诚实映射）：只切换「哪一束光算数」，不改变数据本身。 */
function useLensVisibility(lens: LensId, category: string | null, isDark: boolean) {
  const pillars = useMemo(() => buildPillars(), []);
  const colors = useMemo(
    () => pillars.map((pillar) => beamColorFor(categoryColors[pillar.category] ?? '#95A5A6', isDark)),
    [pillars, isDark],
  );
  const mask = useMemo(
    () =>
      pillars.map((pillar) => {
        if (lens === 'all') return true;
        if (lens === 'category') return category ? pillar.category === category : true;
        if (lens === 'protect') return pillar.protectedByNationalList;
        return pillar.endangeredEditorial;
      }),
    [pillars, lens, category],
  );
  return { pillars, colors, mask };
}

const highlightFor = (palette: StagePalette): string =>
  palette.beamBlending === 'additive' ? palette.gold : palette.goldOnLight;

/** 隐藏状态：保留一个极薄的贴地圆盘，避免「完全消失」导致镜头切换后无处可点。 */
const HIDDEN_LENGTH = 0.0001;

const PillarLayer = ({
  pillars,
  colors,
  mask,
  palette,
  selectedId,
  onSelectPillar,
}: {
  pillars: PillarInstance[];
  colors: string[];
  mask: boolean[];
  palette: StagePalette;
  selectedId: string | null;
  onSelectPillar: (pillar: PillarInstance) => void;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [hovered, setHovered] = useState<number | null>(null);
  const highlight = highlightFor(palette);

  // 几何原点挪到底部：实例矩阵只需 position(平面) + scale(粗, 粗, 高)
  const beamGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.012, 0.017, 1, 6, 1, true);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, 0.5);
    return geometry;
  }, []);
  useEffect(() => () => beamGeometry.dispose(), [beamGeometry]);

  // 静态布局一次写入；呼吸只改材质透明度（不再逐帧重算 1062 个实例矩阵）
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    pillars.forEach((pillar, index) => {
      const visible = mask[index];
      const highlighted = pillar.id === selectedId || index === hovered;
      const thickness = highlighted ? 2.6 : 1;
      const length = visible ? pillar.height * (highlighted ? 1.6 : 1) : HIDDEN_LENGTH;
      dummy.position.set(pillar.position[0], pillar.position[1], 0);
      dummy.scale.set(thickness, thickness, length);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(highlighted ? highlight : colors[index]);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.computeBoundingSphere();
  }, [pillars, colors, mask, highlight, selectedId, hovered, dummy]);

  useFrame(({ clock }) => {
    const material = materialRef.current;
    if (!material) return;
    if (palette.beamBlending !== 'additive') {
      material.opacity = palette.beamOpacity;
      return;
    }
    material.opacity = palette.beamOpacity * (0.88 + 0.12 * Math.sin(clock.getElapsedTime() * 3.2));
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[beamGeometry, undefined, pillars.length]}
      onPointerMove={(event) => {
        event.stopPropagation();
        if (event.instanceId !== undefined && event.instanceId !== hovered) setHovered(event.instanceId);
      }}
      onPointerOut={() => setHovered(null)}
      onClick={(event) => {
        event.stopPropagation();
        const index = event.instanceId;
        if (index === undefined || !mask[index]) return;
        onSelectPillar(pillars[index]);
      }}
    >
      <meshBasicMaterial
        ref={materialRef}
        transparent
        opacity={palette.beamOpacity}
        blending={palette.beamBlending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
        depthWrite={false}
        side={THREE.DoubleSide}
        toneMapped={false}
      />
    </instancedMesh>
  );
};

/** 光柱根部光晕：径向渐变贴图由 canvas 程序化生成（零外部资产）。 */
const createGlowTexture = (): THREE.Texture => {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,0.95)');
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.42)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, size, size);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
};

const GlowLayer = ({ pillars, palette }: { pillars: PillarInstance[]; palette: StagePalette }) => {
  const texture = useMemo(createGlowTexture, []);
  const isDark = palette.beamBlending === 'additive';
  const geometry = useMemo(() => {
    const positions = new Float32Array(pillars.length * 3);
    pillars.forEach((pillar, index) => {
      positions[index * 3] = pillar.position[0];
      positions[index * 3 + 1] = pillar.position[1];
      positions[index * 3 + 2] = 0.02;
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [pillars]);

  useEffect(
    () => () => {
      texture.dispose();
      geometry.dispose();
    },
    [texture, geometry],
  );

  return (
    <points geometry={geometry}>
      <pointsMaterial
        map={texture}
        size={isDark ? 0.13 : 0.1}
        sizeAttenuation
        transparent
        opacity={isDark ? 0.85 : 0.62}
        color={isDark ? '#ffffff' : palette.gold}
        depthWrite={false}
        blending={isDark ? THREE.AdditiveBlending : THREE.NormalBlending}
        toneMapped={false}
      />
    </points>
  );
};

/** 背景颗粒：深色底是星尘、浅色底是纸面颗粒；确定性伪随机（固定种子）。 */
const StardustLayer = ({ palette }: { palette: StagePalette }) => {
  const count = palette.stardustCount;
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    let seed = 20261009;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (next() - 0.5) * 26;
      positions[index * 3 + 1] = (next() - 0.5) * 18;
      // 深处背景：永远落在地图平面之外，避免颗粒与光柱抢注意力
      positions[index * 3 + 2] = 4 - next() * 12;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry} rotation={PLANE_ROTATION}>
      <pointsMaterial
        size={0.02}
        color={palette.stardust}
        transparent
        opacity={palette.stardustOpacity}
        depthWrite={false}
      />
    </points>
  );
};

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

/** 进场 / 镜头切换 / 省份聚焦共用的相机曲线（≤1.1s）；reduced-motion 直接到位。 */
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
  const controls = useThree((state) => state.controls) as ControlsLike | null;
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
      if (controls) controls.enabled = true;
    }
  }, [camera, position, target, reducedMotion, controls]);

  useFrame(() => {
    if (reducedMotion) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const progress = Math.min(1, elapsed / 1.1);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    camera.position.lerpVectors(fromRef.current, toRef.current, eased);
    camera.lookAt(targetRef.current);
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
  onSelectProvince,
  onHoverProvince,
  onSelectPillar,
}: LightMapSceneProps) => {
  const reducedMotion = useReducedMotion();
  const { pillars, colors, mask } = useLensVisibility(lens, category, palette.beamBlending === 'additive');
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);
  const size = useThree((state) => state.size);

  const digest = useMemo(() => buildDigest(), []);
  const provinces = useMemo(() => {
    const counts = new Map(digest.provinces.map((item) => [item.province, item.total]));
    return buildProvinceGeometries(counts);
  }, [digest]);
  useEffect(() => () => disposeProvinceGeometries(provinces), [provinces]);

  const framing = useMemo(() => measureSceneFraming(provinces), [provinces]);
  const fallbackBox: PlaneBounds = { minX: -5, maxX: 5, minY: -4, maxY: 4 };
  const aspect = Math.max(0.4, size.width / Math.max(1, size.height));

  /** 主场取景：候选俯角各解一次，取屏幕占比最大者，并让版图落在 HUD 之间的可见带正中。 */
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
      }),
    [framing.box, aspect, hudInsets],
  );

  /** 省域聚焦：把该省（含挤出）塞进画面，俯角沿用主场的自动结果，避免切镜头时“翻桌”。 */
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
      margin: 1.22,
      insets: hudInsets,
      elevations: [Math.min(home.elevation, 0.94)],
    });
  }, [provinces, selectedProvince, aspect, hudInsets, home.elevation]);

  const view = focus ?? home;
  const maxDistance = Math.max(home.distance, view.distance) * 1.5;
  const minDistance = Math.max(1.4, Math.min(home.distance, view.distance) * 0.45);

  return (
    <>
      <color attach="background" args={[palette.bg]} />
      <fogExp2 attach="fog" args={[palette.bg, palette.fogDensity]} />
      <ambientLight intensity={palette.beamBlending === 'additive' ? 0.42 : 0.9} />
      <directionalLight position={[4, 9, 6]} intensity={palette.beamBlending === 'additive' ? 0.7 : 1.1} />
      <directionalLight position={[-6, 6, -4]} intensity={0.3} />

      <StardustLayer palette={palette} />

      {/* 展台台面：版图落在实体台面上，而不是浮在虚空里（浅色底上是宣纸衬板） */}
      <mesh rotation={PLANE_ROTATION} position={planeToWorld(framing.center[0], framing.center[1], -0.012).toArray()}>
        <planeGeometry args={[16, 14]} />
        <meshStandardMaterial color={palette.floor} roughness={1} metalness={0} />
      </mesh>

      {/* 省块 / 光柱 / 光晕（含澳门圆点）：同一旋转组，同一坐标系 */}
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
        <PillarLayer
          pillars={pillars}
          colors={colors}
          mask={mask}
          palette={palette}
          selectedId={selectedId}
          onSelectPillar={onSelectPillar}
        />
        <GlowLayer pillars={pillars} palette={palette} />
      </group>

      <ContactShadows
        position={[framing.center[0], -0.005, -framing.center[1]]}
        opacity={palette.beamBlending === 'additive' ? 0.5 : 0.42}
        scale={15}
        blur={2.6}
        far={4.5}
        color={palette.shadow}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        target={[view.target.x, view.target.y, view.target.z]}
        minDistance={minDistance}
        maxDistance={maxDistance}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI * 0.46}
      />
      <CameraRig target={view.target} position={view.seat} reducedMotion={reducedMotion} />
    </>
  );
};

export function LightMapScene(props: LightMapSceneProps) {
  const initialPosition = useMemo(
    () =>
      cameraSeat(new THREE.Vector3(0, 0, 0), cameraDirection(0.78), 16).toArray() as [number, number, number],
    [],
  );

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: initialPosition, fov: CAMERA_FOV, near: 0.1, far: 200 }}
      onPointerMissed={() => props.onSelectProvince(null)}
    >
      <SceneBody {...props} />
    </Canvas>
  );
}
