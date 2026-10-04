import type { ReactNode } from 'react';

interface BackgroundWrapperProps {
  children: ReactNode;
  className?: string;
  /** 星星密度系数 */
  density?: number;
}

/**
 * 首页背景容器：纯黑底 + 金色细点纹理，内容层置于其上。
 */
const BackgroundWrapper = ({ children, className = '', density = 3 }: BackgroundWrapperProps) => {
  return (
    <div className={`relative bg-black ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#C79A45 0.6px, transparent 0.6px)', backgroundSize: '20px 20px' }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default BackgroundWrapper;
