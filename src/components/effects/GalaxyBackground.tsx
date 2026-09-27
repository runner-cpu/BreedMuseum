import { useEffect, useRef } from 'react';

interface GalaxyBackgroundProps {
  className?: string;
  /** 密度系数（默认 3，移动端自动降低基准数） */
  density?: number;
  /** 旋转速度（弧度系数，默认 0.2） */
  rotationSpeed?: number;
  /** 闪烁强度 0-1（默认 0.6） */
  twinkleIntensity?: number;
  /** 是否开启鼠标交互 */
  mouseInteraction?: boolean;
  /** 是否开启鼠标推斥 */
  mouseRepulsion?: boolean;
  /** 推斥力度（默认 4） */
  repulsionStrength?: number;
}

/**
 * 星系动态背景（Canvas2D 实现，轻量稳定，无需 WebGL 依赖）。
 * 星星绕中心椭圆轨道旋转，支持鼠标推斥扰动与闪烁。
 */
const GalaxyBackground = ({
  className = '',
  density = 3,
  rotationSpeed = 0.2,
  twinkleIntensity = 0.6,
  mouseInteraction = true,
  mouseRepulsion = true,
  repulsionStrength = 4,
}: GalaxyBackgroundProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let raf = 0;
    let w = 0;
    let h = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const isMobile = window.innerWidth < 768;
    const count = Math.floor((isMobile ? 110 : 220) * density);

    interface Star {
      ang: number;
      rad: number;
      z: number;
      r: number;
      tw: number;
      hue: number;
      ox: number;
      oy: number;
    }
    let stars: Star[] = [];
    const mouse = { x: -9999, y: -9999 };

    const init = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = Math.max(1, Math.floor(w * dpr));
      canvas.height = Math.max(1, Math.floor(h * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const maxR = Math.hypot(w, h) / 2;
      stars = Array.from({ length: count }, () => ({
        ang: Math.random() * Math.PI * 2,
        rad: Math.sqrt(Math.random()) * maxR,
        z: Math.random() * 0.8 + 0.2,
        r: Math.random() * 1.4 + 0.3,
        tw: Math.random() * Math.PI * 2,
        hue: Math.random(),
        ox: 0,
        oy: 0,
      }));
    };

    init();
    const onResize = () => init();
    window.addEventListener('resize', onResize);

    const onMouse = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    const onLeave = () => {
      mouse.x = -9999;
      mouse.y = -9999;
    };
    if (mouseInteraction) {
      window.addEventListener('mousemove', onMouse);
      window.addEventListener('mouseleave', onLeave);
    }

    let t = 0;
    const draw = () => {
      t += 0.016;
      ctx.clearRect(0, 0, w, h);
      const cx = w / 2;
      const cy = h / 2;

      // 星云辉光
      const g = ctx.createRadialGradient(w * 0.72, h * 0.28, 0, w * 0.72, h * 0.28, w * 0.55);
      g.addColorStop(0, 'rgba(90,70,160,0.10)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, w, h);

      const g2 = ctx.createRadialGradient(w * 0.2, h * 0.8, 0, w * 0.2, h * 0.8, w * 0.45);
      g2.addColorStop(0, 'rgba(40,120,140,0.08)');
      g2.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g2;
      ctx.fillRect(0, 0, w, h);

      for (const s of stars) {
        // 绕中心旋转（椭圆轨道营造星系感）
        s.ang += rotationSpeed * 0.016 * s.z;
        let x = cx + Math.cos(s.ang) * s.rad;
        let y = cy + Math.sin(s.ang) * s.rad * 0.6;

        // 鼠标推斥扰动
        if (mouseRepulsion) {
          const dx = x - mouse.x;
          const dy = y - mouse.y;
          const dist = Math.hypot(dx, dy);
          if (dist < 150 && dist > 0.01) {
            const f = (1 - dist / 150) * repulsionStrength;
            s.ox += (dx / dist) * f;
            s.oy += (dy / dist) * f;
          }
          s.ox *= 0.9;
          s.oy *= 0.9;
          x += s.ox;
          y += s.oy;
        }

        // 闪烁
        const alpha = (0.35 + twinkleIntensity * (0.5 + 0.5 * Math.sin(t * 2 + s.tw))) * s.z;
        const color = s.hue < 0.5 ? `rgba(220,225,255,${alpha})` : `rgba(170,195,255,${alpha})`;
        ctx.beginPath();
        ctx.arc(x, y, s.r * s.z, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    draw();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
      if (mouseInteraction) {
        window.removeEventListener('mousemove', onMouse);
        window.removeEventListener('mouseleave', onLeave);
      }
    };
  }, [density, rotationSpeed, twinkleIntensity, mouseInteraction, mouseRepulsion, repulsionStrength]);

  return <canvas ref={canvasRef} className={`absolute inset-0 w-full h-full ${className}`} />;
};

export default GalaxyBackground;
