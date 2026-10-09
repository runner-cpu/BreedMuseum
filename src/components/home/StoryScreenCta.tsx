import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, Map as MapIcon, Thermometer } from 'lucide-react';
import { useSettings } from '@/contexts/AppSettings';

/** 屏⑤ 行动：三个工具入口 + 收束句。 */
const StoryScreenCta: React.FC = () => {
  const { t } = useSettings();
  const navigate = useNavigate();

  const entries = [
    {
      to: '/pasture',
      icon: <Thermometer className="h-5 w-5" aria-hidden="true" />,
      accent: '#d4a853',
      title: t('story.ctaPasture'),
      desc: t('story.ctaPastureDesc'),
      alt: t('home.entryPastureAlt'),
    },
    {
      to: '/map',
      icon: <MapIcon className="h-5 w-5" aria-hidden="true" />,
      accent: '#6b8fb5',
      title: t('story.ctaMap'),
      desc: t('story.ctaMapDesc'),
      alt: t('home.entryMapAlt'),
    },
    {
      to: '/encyclopedia',
      icon: <BookOpen className="h-5 w-5" aria-hidden="true" />,
      accent: '#7aa87a',
      title: t('story.ctaEncyclopedia'),
      desc: t('story.ctaEncyclopediaDesc'),
      alt: t('home.entryRecommendAlt'),
    },
  ];

  return (
    <section aria-label={t('story.ctaTitle')} className="relative overflow-hidden bg-black py-20 md:py-28">
      {/* 金色微光 */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 bottom-0 h-64 bg-[radial-gradient(ellipse_at_center,rgba(212,168,83,0.22),transparent_70%)]"
      />
      <div className="relative mx-auto max-w-5xl px-4 md:px-6 text-center">
        <h2 className="font-serif text-2xl font-bold leading-tight text-white text-balance md:text-4xl">
          {t('story.ctaTitle')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-white/70 text-pretty md:text-base">
          {t('story.ctaBody')}
        </p>

        <div className="mt-10 grid grid-cols-1 gap-4 text-left md:grid-cols-3">
          {entries.map((entry) => (
            <button
              key={entry.to}
              type="button"
              onClick={() => navigate(entry.to)}
              className="group overflow-hidden rounded-xl border border-white/15 bg-white/5 transition-all hover:border-white/40 hover:bg-white/10"
              aria-label={entry.alt}
            >
              <span aria-hidden="true" className="block h-1 w-full" style={{ backgroundColor: entry.accent }} />
              <span className="block p-5">
                <span className="flex items-center gap-3">
                  <span
                    className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                    style={{ backgroundColor: entry.accent }}
                  >
                    {entry.icon}
                  </span>
                  <span className="text-base font-semibold text-white">{entry.title}</span>
                </span>
                <span className="mt-3 block text-sm leading-relaxed text-white/65 text-pretty">{entry.desc}</span>
                <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: entry.accent }}>
                  {t('home.entryOpen')}
                  <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StoryScreenCta;
