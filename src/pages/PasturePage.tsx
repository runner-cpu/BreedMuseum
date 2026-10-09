import React from 'react';
import { motion } from 'motion/react';
import { useSettings } from '@/contexts/AppSettings';
import ThiConsolePanel from '@/components/thi/ThiConsolePanel';

/**
 * 高原牧场环境决策台（完整页）。
 * 面板实现已抽到 src/components/thi/ThiConsolePanel，首页叙事屏复用同一组件。
 */
const PasturePage: React.FC = () => {
  const { t } = useSettings();

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-8">
      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-xl md:text-2xl font-serif font-bold text-foreground border-l-4 border-primary pl-3"
      >
        {t('pasture.title')}
      </motion.h1>
      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{t('pasture.intro')}</p>

      <ThiConsolePanel variant="full" tone="default" className="mt-6" />
    </div>
  );
};

export default PasturePage;
