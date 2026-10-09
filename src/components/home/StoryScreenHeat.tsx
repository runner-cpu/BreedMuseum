import React from 'react';
import { motion, useReducedMotion } from 'motion/react';
import { ChevronDown } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';
import { publicAsset } from '@/lib/publicAsset';

/**
 * 屏① 痛点：夜色高原，牦牛与藏羊面对越来越热的夏天。
 * 不用任何外部数字——背景插画是项目原创 SVG，文案只描述可验证的事实性情境。
 */
const StoryScreenHeat: React.FC = () => {
  const { t } = useSettings();
  const reduceMotion = useReducedMotion();

  return (
    <section
      aria-label={t('story.heatTitle')}
      className="relative flex min-h-[86vh] items-center justify-center overflow-hidden bg-black"
    >
      {/* 背景：原创作原牧场插画（浅色夜空压暗） */}
      <img
        src={publicAsset('brand/plateau-hero.svg')}
        alt=""
        aria-hidden="true"
        className="absolute inset-0 h-full w-full object-cover opacity-70"
      />
      {/* 夜色 → 暖橙 渐变叠加，暗示热浪上涌 */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-gradient-to-b from-black/85 via-[#0b1220]/70 to-[#3a2418]/80"
      />

      <div className="relative mx-auto max-w-3xl px-6 py-20 text-center">
        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs text-white/80 backdrop-blur"
        >
          <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full bg-[#e08a4a]" />
          {t('story.heatBadge')}
        </motion.p>

        <motion.h1
          initial={reduceMotion ? false : { opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          className="mt-6 font-serif text-3xl font-bold leading-tight text-white text-balance [text-shadow:0_2px_24px_rgba(0,0,0,0.65)] md:text-5xl"
        >
          {t('story.heatTitle')}
        </motion.h1>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          className="mx-auto mt-6 max-w-2xl text-sm leading-relaxed text-white/75 text-pretty md:text-base"
        >
          {t('story.heatBody')}
        </motion.p>

        <motion.p
          initial={reduceMotion ? false : { opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true, amount: 0.4 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          className="mt-8 inline-flex items-center gap-1.5 text-xs text-white/55"
        >
          <ChevronDown className="h-4 w-4 animate-bounce" aria-hidden="true" />
          {t('story.scrollHint')}
        </motion.p>
      </div>
    </section>
  );
};

export default StoryScreenHeat;
