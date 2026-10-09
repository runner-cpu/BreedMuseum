import React from 'react';
import { useSettings } from '@/contexts/AppSettings';
import ThiConsolePanel from '@/components/thi/ThiConsolePanel';

/**
 * 屏③ 工具：把 THI 决策台直接嵌进叙事流。
 * 复用 /pasture 的同一组件（compact + 夜色配色），保证两处行为一致。
 */
const StoryScreenConsole: React.FC = () => {
  const { t } = useSettings();

  return (
    <section aria-label={t('story.consoleTitle')} className="relative bg-black py-20 md:py-28">
      <div className="mx-auto max-w-6xl px-4 md:px-6">
        <h2 className="font-serif text-2xl font-bold leading-tight text-white text-balance md:text-4xl">
          {t('story.consoleTitle')}
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-white/70 text-pretty md:text-base">
          {t('story.consoleBody')}
        </p>

        <ThiConsolePanel variant="compact" tone="dark" className="mt-8" />

        <p className="mt-4 text-xs leading-relaxed text-white/50">{t('story.consoleFootnote')}</p>
      </div>
    </section>
  );
};

export default StoryScreenConsole;
