import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, Edges, OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import {
  buildProvinceGeometries,
  disposeProvinceGeometries,
  type ProvinceGeometry,
} from '@/lib/geo3d/buildProvinceGeometry';
import { categoryColors } from '@/lib/categoryIcons';
import { buildDigest, buildPillars, type PillarInstance } from '@/lib/geo3d/lightMapData';
import { useReducedMotion } from './useSceneCapability';

/**
 * 畜种光图（3D 主展项）。
 *
 * 坐标约定：各图层在本地 XY 平面构建，外层 group 统一 rotateX(-90°) 把本地 +Z
 * 抬成世界 +Y —— 与仓库既有 2D 地图共用同一套经纬度投影（见 `lib/geo3d`）。
 *
 * 四个镜头是同一场景的灯光切换（不是四个页面）：
 *   all      全部分布
 *   category 类别构成（选中类别）
 *   protect  国家级保护（940 号公告 271）
 *   risk     濒危之窗（编辑口径 82，0.8Hz 呼吸）
 */

export type LensId = 'all' | 'category' | 'protect' | 'risk';

const ROT: [number, number, number] = [-Math.PI / 2, 0, 0];
const CAMERA_HOME: [number, number, number] = [0, 5.6, 7.4];
const PROTECTED_GOLD = '#d4a853';

/** 只用到 OrbitControls 的 enabled 字段，避免为了一个类型引入 three-stdlib 直接依赖。 */
interface ControlsLike {
  enabled: boolean;
}

interface LightMapSceneProps {
  lens: LensId;
  category: string | null;
  selectedProvince: string | null;
  selectedId: string | null;
  onSelectProvince: (province: string | null) => void;
  onHoverProvince: (province: string | null) => void;
  onSelectPillar: (pillar: PillarInstance) => void;
}

/**
 * 镜头可见性（诚实映射）：每个镜头只切换“哪一束光算数”，
 * 不改变任何数据本身的取值。
 */
function useLensVisibility(lens: LensId, category: string | null) {
  const pillars = useMemo(() => buildPillars(), []);
  const colors = useMemo(
    () => pillars.map((pillar) => categoryColors[pillar.category] ?? '#95A5A6'),
    [pillars],
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

const PillarLayer = ({
  pillars,
  colors,
  mask,
  reducedMotion,
  selectedId,
  onSelectPillar,
}: {
  pillars: PillarInstance[];
  colors: string[];
  mask: boolean[];
  reducedMotion: boolean;
  selectedId: string | null;
  onSelectPillar: (pillar: PillarInstance) => void;
}) => {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const [hovered, setHovered] = useState<number | null>(null);

  // 静态布局（reduced-motion 与首次渲染共用）：实例矩阵 + 实例颜色一次写入
  useEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const color = new THREE.Color();
    pillars.forEach((pillar, index) => {
      const visible = mask[index];
      const highlighted = pillar.id === selectedId || index === hovered;
      const scale = (visible ? 1 : 0.001) * (highlighted ? 1.6 : 1);
      dummy.position.set(pillar.position[0], pillar.position[1], (pillar.height / 2) * (visible ? 1 : 0.001));
      dummy.scale.set(scale, scale, highlighted ? 1.6 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
      color.set(index === hovered || pillar.id === selectedId ? PROTECTED_GOLD : colors[index]);
      mesh.setColorAt(index, color);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [pillars, colors, mask, selectedId, hovered, dummy]);

  // 呼吸动画：仅正常动效模式（reduced-motion 走上面的静态分支）
  useFrame(({ clock }) => {
    if (reducedMotion) return;
    const mesh = meshRef.current;
    if (!mesh) return;
    const time = clock.getElapsedTime();
    const breathe = 0.85 + 0.15 * Math.sin(time * 2);
    for (let index = 0; index < pillars.length; index += 1) {
      if (!mask[index]) continue;
      const pillar = pillars[index];
      dummy.position.set(pillar.position[0], pillar.position[1], (pillar.height / 2) * breathe);
      dummy.scale.set(1, 1, pillar.id === selectedId || index === hovered ? 1.6 : 1);
      dummy.updateMatrix();
      mesh.setMatrixAt(index, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, pillars.length]}
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
      <cylinderGeometry args={[0.006, 0.006, 1, 6, 1, true]} />
      <meshBasicMaterial
        transparent
        opacity={0.92}
        blending={THREE.AdditiveBlending}
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

const GlowLayer = ({ pillars }: { pillars: PillarInstance[] }) => {
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
        size={0.075}
        sizeAttenuation
        transparent
        depthWrite={false}
        blending={THREE.AdditiveBlending}
        toneMapped={false}
      />
    </points>
  );
};

/** 星尘背景：确定性伪随机（固定种子），避免每次刷新星空抖动。 */
const StardustLayer = ({ count = 600 }: { count?: number }) => {
  const geometry = useMemo(() => {
    const positions = new Float32Array(count * 3);
    let seed = 20261009;
    const next = () => {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      return seed / 0x7fffffff;
    };
    for (let index = 0; index < count; index += 1) {
      positions[index * 3] = (next() - 0.5) * 16;
      positions[index * 3 + 1] = (next() - 0.5) * 12;
      positions[index * 3 + 2] = -1.5 - next() * 4;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, [count]);
  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <points geometry={geometry}>
      <pointsMaterial size={0.018} color="#9fb8a8" transparent opacity={0.5} depthWrite={false} />
    </points>
  );
};

const ProvinceLayer = ({
  provinces,
  selectedProvince,
  hoveredProvince,
  onSelectProvince,
  onHoverProvince,
}: {
  provinces: ProvinceGeometry[];
  selectedProvince: string | null;
  hoveredProvince: string | null;
  onSelectProvince: (province: string | null) => void;
  onHoverProvince: (province: string | null) => void;
}) => (
  <group rotation={ROT}>
    {provinces.map((province) => {
      const selected = province.simpleName === selectedProvince;
      const hovered = province.simpleName === hoveredProvince;
      const lift = selected ? 0.12 : hovered ? 0.06 : 0;
      const emissive = selected ? 0.5 : hovered ? 0.34 : 0.12;

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
            <meshStandardMaterial color={PROTECTED_GOLD} emissive={PROTECTED_GOLD} emissiveIntensity={0.6} />
            <Edges color={PROTECTED_GOLD} />
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
            color="#16211c"
            roughness={0.88}
            metalness={0.05}
            emissive="#2d4a3e"
            emissiveIntensity={emissive}
          />
        </mesh>
      );
    })}
  </group>
);

/** 进场与镜头切换统一走 flyTo（≤1.2s）；reduced-motion 直接到位。 */
const CameraRig = ({
  focus,
  reducedMotion,
}: {
  focus: { position: [number, number, number]; distance: number } | null;
  reducedMotion: boolean;
}) => {
  const camera = useThree((state) => state.camera);
  const controls = useThree((state) => state.controls) as ControlsLike | null;
  const fromRef = useRef(new THREE.Vector3(...CAMERA_HOME));
  const toRef = useRef(new THREE.Vector3(...CAMERA_HOME));
  const startedAt = useRef(0);

  useEffect(() => {
    const destination = focus
      ? new THREE.Vector3(
          focus.position[0] + focus.distance * 0.4,
          focus.distance,
          focus.position[1] + focus.distance * 0.4,
        )
      : new THREE.Vector3(...CAMERA_HOME);
    fromRef.current.copy(camera.position);
    toRef.current.copy(destination);
    startedAt.current = performance.now();
    if (reducedMotion) {
      camera.position.copy(destination);
      camera.lookAt(0, 0, 0);
      if (controls) controls.enabled = true;
    }
  }, [focus, camera, reducedMotion, controls]);

  useFrame(() => {
    if (reducedMotion) return;
    const elapsed = (performance.now() - startedAt.current) / 1000;
    const progress = Math.min(1, elapsed / 1.2);
    const eased = progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
    camera.position.lerpVectors(fromRef.current, toRef.current, eased);
    camera.lookAt(0, 0, 0);
  });

  return null;
};

export function LightMapScene({
  lens,
  category,
  selectedProvince,
  selectedId,
  onSelectProvince,
  onHoverProvince,
  onSelectPillar,
}: LightMapSceneProps) {
  const reducedMotion = useReducedMotion();
  const { pillars, colors, mask } = useLensVisibility(lens, category);
  const [hoveredProvince, setHoveredProvince] = useState<string | null>(null);

  const digest = useMemo(() => buildDigest(), []);
  const provinces = useMemo(() => {
    const counts = new Map(digest.provinces.map((item) => [item.province, item.total]));
    return buildProvinceGeometries(counts);
  }, [digest]);
  useEffect(() => () => disposeProvinceGeometries(provinces), [provinces]);

  const focus = useMemo(() => {
    if (!selectedProvince) return null;
    const province = provinces.find((item) => item.simpleName === selectedProvince);
    if (!province) return null;
    return {
      position: [province.center[0], 0, province.center[1]] as [number, number, number],
      distance: 3.4,
    };
  }, [provinces, selectedProvince]);

  return (
    <Canvas
      dpr={[1, 2]}
      gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
      camera={{ position: CAMERA_HOME, fov: 45, near: 0.1, far: 120 }}
      onPointerMissed={() => onSelectProvince(null)}
    >
      <color attach="background" args={['#080b09']} />
      <fogExp2 attach="fog" args={['#080b09', 0.055]} />
      <ambientLight intensity={0.35} />
      <directionalLight position={[4, 8, 6]} intensity={0.6} />

      <StardustLayer />
      <ProvinceLayer
        provinces={provinces}
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
        reducedMotion={reducedMotion}
        selectedId={selectedId}
        onSelectPillar={onSelectPillar}
      />
      <GlowLayer pillars={pillars} />

      <ContactShadows position={[0, -0.01, 0]} opacity={0.45} scale={16} blur={2.6} far={4} color="#050807" />
      <OrbitControls
        enableDamping
        dampingFactor={0.08}
        enablePan={false}
        minDistance={2.6}
        maxDistance={13}
        maxPolarAngle={Math.PI * 0.46}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.25}
      />
      <CameraRig focus={focus} reducedMotion={reducedMotion} />
    </Canvas>
  );
}
