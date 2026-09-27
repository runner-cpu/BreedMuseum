import type { ReactNode } from 'react';
import GalaxyBackground from './GalaxyBackground';

interface BackgroundWrapperProps {
  children: ReactNode;
  className?: string;
  /** 星星密度系数 */
  density?: number;
}

/**
 * 星系背景容器：在内容层下方放置星系动态背景（固定深色），
 * 内容层置于其上，营造星空/科技感。
 */
const BackgroundWrapper = ({ children, className = '', density = 3 }: BackgroundWrapperProps) => {
  return (
    <div className={`relative bg-[#0a0a1a] ${className}`}>
      <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
        <GalaxyBackground density={density} />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default BackgroundWrapper;