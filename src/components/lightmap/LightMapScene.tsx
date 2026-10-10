import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildProvinceGeometries,
  disposeProvinceGeometries,
  measureSceneFraming,
  type ProvinceGeometry,
} from '@/lib/geo3d/buildProvinceGeometry';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest, buildPillars, type PillarInstance } from '@/lib/geo3d/lightMapData';
import { beamColorFor, type StagePalette } from '@/lib/stagePalette';
import { useReducedMotion } from './useSceneCapability';

/**
 * 畜种光图（3D 主展项）。
 *
 * 坐标约定（唯一一套，DOM 与 WebGL 共用）：
 * 所有图层都在**同一个旋转组**里构建，组内 XY 是地图平面（+X 向东、+Y 向北）、
 * 组内 +Z 是「向上」；外层 `group rotation={[-π/2, 0, 0]}` 把组内 +Z 抬成世界 +Y。
 * 因此省块、光柱、光晕、澳门圆点全部共享同一坐标系 —— 这是「光必须钉在省份上」的前提。
 *
 * 四个镜头是同一场景的灯光切换（不是四个页面）：
 *   all      全部分布
 *   category 类别构成（选中类别）
 *   protect  国家级保护（940 号公告 271）
 *   risk     濒危之窗（编辑口径 82，0.8Hz 呼吸）
 */

export type LensId = 'all' | 'category' | 'protect' | 'risk';

/** 组内共用的平面→挤出约定：先绕 X 轴 -90°，组内 +Z 即为世界「上」。 */
const ROT: [number, number, number] = [-Math.PI / 2, 0, 0];
/** 相机俯角（弧度）与距离上下限。 */
const CAMERA_ELEVATION = 0.6;
const CAMERA_MIN_DISTANCE = 6;
const CAMERA_MAX_DISTANCE = 16;

/** 只用到 OrbitControls 的 enabled 字段，避免为了一个类型引入 three-stdlib 直接依赖。 */
interface ControlsLike {
  enabled: boolean;
}

interface LightMapSceneProps {
  lens: LensId;
  category: string | null;
  selectedProvince: string | null;
  selectedId: string | null;
  palette: StagePalette;
  onSelectProvince: (province: string | null) => void;
  onHoverProvince: (province: string | null) => void;
  onSelectPillar: (pillar: PillarInstance) => void;
}

/**
 * 镜头可见性（诚实映射）：每个镜头只切换「哪一束光算数」，
 * 不改变任何数据本身的取值。
 */
function useLensVisibility(lens: LensId, category: string | null, isDark: boolean) {
  const pillars = useMemo(() => buildPillars(), []);
  // 浅色底把亮色种类色压深，否则（如兔 #FFB6C1）在宣纸色省块上几乎看不见
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

/** 高亮色（选中/悬停）也随主题走：深色底用亮金，浅色底用深金。 */
const highlightFor = (palette: StagePalette): string =>
  palette.beamBlending === 'additive' ? palette.gold : '#5c3f0b';

const PillarLayer = ({
  pillars,
  colors,
  mask,
  palette,
  reducedMotion,
  selectedId,
  onSelectPillar,
}: {
  pillars: PillarInstance[];
  colors: string[];
  mask: boolean[];
  palette: StagePalette;
  reducedMotion: boolean;
  selectedId: string | null;
  onSelectPillar: (pillar: PillarInstance) => void;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [hovered, setHovered] = useState<number | null>(null);
  const highlight = highlightFor(palette);

  // 光柱几何：圆柱默认沿 +Y，这里预旋转为沿组内 +Z（即世界「上」）
  const beamGeometry = useMemo(() => {
    const geometry = new THREE.CylinderGeometry(0.006, 0.006, 1, 6, 1, true);
    geometry.rotateX(Math.PI / 2);
    geometry.translate(0, 0, 0.5);
    return geometry;
  }, []);
  useEffect(() => () => beamGeometry.dispose(), [beamGeometry]);

  // 静态布局（reduced-motion 与首次渲染共用）：实例矩阵 + 实例颜色一次写入
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    pillars.forEach((pillar, index) => {
      const visible = mask[index];
      const highlighted = pillar.id === selectedId || index === hovered;
      const thickness = highlighted ? 2.4 : 1;
      const length = visible ? (highlighted ? 1.6 : 1) : 0.0001;
      dummy.position.set(pillar.position[0], pillar.position[1], 0);
      dummy.scale.set(thickness, thickness, pillar.height * length);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(index === hovered || pillar.id === selectedId ? highlight : colors[index]);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pillars, colors, mask, highlight, selectedId, hovered, dummy]);

  // 呼吸动画：仅正常动效模式（reduced-motion 走上面的静态分支）
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    const time = clock.getElapsedTime();
    const breathe = 0.88 + 0.12 * Math.sin(time * 2);
    for (let index = 0; index < pillars.length; index += 1) {
      if (!mask[index]) continue;
      const pillar = pillars[index];
      const highlighted = pillar.id === selectedId || index === hovered;
      const thickness = highlighted ? 2.4 : 1;
      dummy.position.set(pillar.position[0], pillar.position[1], 0);
      dummy.scale.set(thickness, thickness, pillar.height * breathe * (highlighted ? 1.6 : 1));
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
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
    gradient.addColorStop(0.35, 'rgba(255,255,255,0.35)');
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
        size={palette.beamBlending === 'additive' ? 0.075 : 0.05}
        sizeAttenuation
        transparent
        opacity={palette.beamBlending === 'additive' ? 1 : 0.75}
        color={palette.beamBlending === 'additive' ? '#ffffff' : palette.gold}
        depthWrite={false}
        blending={palette.beamBlending === 'additive' ? THREE.AdditiveBlending : THREE.NormalBlending}
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
    <points geometry={geometry} rotation={ROT}>
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
}) => (
  <group rotation={ROT}>
    {provinces.map((province) => {
      const selected = province.simpleName === selectedProvince;
      const hovered = province.simpleName === hoveredProvince;
      const lift = selected ? 0.06 : hovered ? 0.03 : 0;
      const emissive = selected ? 0.85 : hovered ? 0.55 : 0.22;

      if (province.degraded) {
        return (
          <mesh
            key={province.fullName}
            position={[province.center[0], province.center[1], 0.03]}
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
            <sphereGeometry args={[0.032, 12, 12]} />
            <meshStandardMaterial color={palette.gold} emissive={palette.gold} emissiveIntensity={0.6} />
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
            color={palette.province}
            roughness={0.9}
            metalness={0.04}
            emissive={palette.provinceEmissive}
            emissiveIntensity={emissive}
          />
        </mesh>
      );
    })}
  </group>
);

/**
 * 相机：进场与镜头切换统一走 flyTo（≤1.2s）；reduced-motion 直接到位。
 *
 * 落点 = 实测地图包围盒中心（不是世界原点——中国版图中心并不在原点），
 * 距离按视口宽高比自适应，因此窄屏自动拉远，不会只看到一片光而看不到中国。
 */
const CameraRig = ({
  framing,
  focus,
  reducedMotion,
}: {
  framing: { center: [number, number]; radius: number };
  focus: { position: [number, number]; distance: number } | null;
  reducedMotion: boolean;
}) => {
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);
  const controls = useThree((state) => state.controls) as ControlsLike | null;
  const fromRef = useRef(new THREE.Vector3());
  const toRef = useRef(new THREE.Vector3());
  const targetRef = useRef(new THREE.Vector3());
  const startedAt = useRef(0);

  const seatFor = (radius: number) => {
    const perspective = camera as THREE.PerspectiveCamera;
    const fov = ((perspective.fov ?? 45) * Math.PI) / 180;
    const aspect = Math.max(0.5, size.width / Math.max(1, size.height));
    const byHeight = (radius / Math.tan(fov / 2)) * 0.95;
    const byWidth = (radius / (Math.tan(fov / 2) * aspect)) * 1.04;
    return THREE.MathUtils.clamp(
      Math.max(byHeight, byWidth),
      CAMERA_MIN_DISTANCE,
      CAMERA_MAX_DISTANCE,
    );
  };

  useEffect(() => {
    /** 平面坐标 → 世界 xz（组内 +Y 朝北 ⇒ 世界 -Z 朝北）。 */
    const toWorld = (plane: [number, number]) => new THREE.Vector3(plane[0], 0, -plane[1]);

    if (focus) {
      const center = toWorld(focus.position);
      targetRef.current.copy(center);
      const d = THREE.MathUtils.clamp(focus.distance, CAMERA_MIN_DISTANCE, CAMERA_MAX_DISTANCE);
      toRef.current.set(
        center.x,
        center.y + d * Math.sin(CAMERA_ELEVATION),
        center.z + d * Math.cos(CAMERA_ELEVATION),
      );
    } else {
      const center = toWorld(framing.center);
      targetRef.current.copy(center);
      const d = seatFor(framing.radius);
      toRef.current.set(
        center.x,
        center.y + d * Math.sin(CAMERA_ELEVATION),
        center.z + d * Math.cos(CAMERA_ELEVATION),
      );
    }

    fromRef.current.copy(camera.position);
    startedAt.current = performance.now();
    if (reducedMotion) {
      camera.position.copy(toRef.current);
      camera.lookAt(targetRef.current);
      if (controls) controls.enabled = true;
    }
  }, [framing, focus, camera, reducedMotion, controls, size.width, size.height]);

  useFrame(() => {
    if (reducedMotion) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const progress = Math.min(1, elapsed / 1.2);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    camera.position.lerpVectors(fromRef.current, toRef.current, eased);
    camera.lookAt(targetRef.current);
  });

  return null;
};

export function LightMapScene({
  lens,
  category,
  selectedProvince,
  selectedId,
  palette,
  onSelectProvince,
  onHoverProvince,
  onSelectPillar,
}: LightMapSceneProps) {
  const reducedMotion = useReducedMotion();
  const { pillars, colors, mask } = useLensVisibility(lens, category, palette.beamBlending === 'additive');
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  const digest = useMemo(() => buildDigest(), []);
  const provinces = useMemo(() => {
    const counts = new Map(digest.provinces.map((item) => [item.province, item.total]));
    return buildProvinceGeometries(counts);
  }, [digest]);
  useEffect(() => () => disposeProvinceGeometries(provinces), [provinces]);

  const framing = useMemo(() => {
    const measured = measureSceneFraming(provinces);
    return { center: measured.center, radius: measured.radius };
  }, [provinces]);

  const focus = useMemo(() => {
    if (!selectedProvince) return null;
    const province = provinces.find((item) => item.simpleName === selectedProvince);
    if (!province) return null;
    return { position: province.center, distance: 4.2 };
  }, [provinces, selectedProvince]);

  const frameCenter = useMemo(
    () => new THREE.Vector3(framing.center[0], 0, -framing.center[1]),
    [framing],
  );
  const initialSeat = Math.max(CAMERA_MIN_DISTANCE, framing.radius * 2.2);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{
        position: [
          frameCenter.x,
          frameCenter.y + initialSeat * Math.sin(CAMERA_ELEVATION),
          frameCenter.z + initialSeat * Math.cos(CAMERA_ELEVATION),
        ],
        fov: 45,
        near: 0.1,
        far: 160,
      }}
      onPointerMissed={() => onSelectProvince(null)}
    >
      <color attach="background" args={[palette.bg]} />
      <fogExp2 attach="fog" args={[palette.bg, palette.fogDensity]} />
      <ambientLight intensity={palette.beamBlending === 'additive' ? 0.35 : 0.8} />
      <directionalLight position={[4, 9, 6]} intensity={palette.beamBlending === 'additive' ? 0.6 : 0.85} />
      <directionalLight position={[-6, 6, -4]} intensity={0.25} />

      <StardustLayer palette={palette} />

      {/* 省块 / 光柱 / 光晕 / 澳门圆点：同一旋转组，同一坐标系 */}
      <group rotation={ROT}>
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
          reducedMotion={reducedMotion}
          selectedId={selectedId}
          onSelectPillar={onSelectPillar}
        />
        <GlowLayer pillars={pillars} palette={palette} />
      </group>

      <ContactShadows
        position={[0, -0.005, 0]}
        opacity={palette.beamBlending === 'additive' ? 0.42 : 0.28}
        scale={20}
        blur={2.6}
        far={4}
        color={palette.shadow}
      />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        target={[frameCenter.x, 0, frameCenter.z]}
        minDistance={CAMERA_MIN_DISTANCE}
        maxDistance={CAMERA_MAX_DISTANCE * 1.4}
        maxPolarAngle={Math.PI * 0.46}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.25}
      />
      <CameraRig framing={framing} focus={focus} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
