import type { ReactNode } from 'react';

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
    <div className={`relative bg-museum-ink ${className}`}>
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none opacity-10" style={{ backgroundImage: 'radial-gradient(#C79A45 0.6px, transparent 0.6px)', backgroundSize: '20px 20px' }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
};

export default BackgroundWrapper;
