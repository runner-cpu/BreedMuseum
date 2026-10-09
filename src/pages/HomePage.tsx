import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin } from 'lucide-react';
import { featuredBreeds } from '@/data/featuredBreeds';
import { breedSources } from '@/data/breedSources';
import { useMuseum } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import { BreedImage } from '@/components/common/BreedImage';
import { BrandLogo } from '@/components/brand/BrandLogo';
import StoryScreenHeat from '@/components/home/StoryScreenHeat';
import StoryScreenThiCurve from '@/components/home/StoryScreenThiCurve';
import StoryScreenConsole from '@/components/home/StoryScreenConsole';
import StoryScreenPlateau from '@/components/home/StoryScreenPlateau';
import StoryScreenCta from '@/components/home/StoryScreenCta';

/**
 * 首页：5 屏滚动叙事。
 * ① 痛点（高原变热）→ ② 量化（THI 曲线）→ ③ 工具（内嵌决策台）
 * → ④ 家底（66 品种 / 13 保护星）→ ⑤ 行动（三入口 + 来源说明）。
 */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCategory, setSelectedBreedId } = useMuseum();
  const { t } = useSettings();
  const catalogSource = breedSources['nahs-catalog-2024'];

  const highlightedBreeds = useMemo(() => featuredBreeds.slice(0, 8), []);

  const handleBreedClick = (id: string, cat: string) => {
    setSelectedBreedId(id);
    setSelectedCategory(cat);
    navigate(`/map?breed_id=${id}`);
  };

  return (
    <div className="relative bg-black">
      <StoryScreenHeat />
      <StoryScreenThiCurve />
      <StoryScreenConsole />
      <StoryScreenPlateau />

      {/* 屏④ 与屏⑤ 之间：青海精选（横向浏览，保持原有交互） */}
      <section aria-label={t('home.featuredTitle')} className="bg-black py-14 md:py-16">
        <div className="mx-auto max-w-5xl px-4 md:px-6">
          <h2 className="font-serif text-xl font-bold text-white md:text-2xl">
            {t('home.featuredTitle')}
          </h2>
          {highlightedBreeds.length > 0 ? (
            <div className="mt-6 flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
              {highlightedBreeds.map((breed) => (
                <button
                  key={breed.id}
                  type="button"
                  onClick={() => handleBreedClick(breed.id, breed.category)}
                  className="snap-start shrink-0 w-40 bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-colors text-left"
                >
                  <BreedImage src={breed.image} alt={breed.name} className="aspect-[4/3] bg-white/5" imgClassName="object-cover" />
                  <div className="p-2.5">
                    <h3 className="text-sm font-semibold text-white truncate">{breed.name}</h3>
                    <p className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {breed.province}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="mt-6 text-sm text-white/60">{t('home.noFeaturedBreeds')}</p>
          )}
        </div>
      </section>

      <StoryScreenCta />

      {/* 数据来源与页脚 */}
      <footer className="bg-black text-white/70" aria-label={t('home.footerBrand')}>
        <div className="mx-auto max-w-5xl px-4 py-10 md:px-6">
          <div className="grid grid-cols-1 gap-6 text-sm md:grid-cols-3">
            <div>
              <div className="mb-3 flex items-center gap-2">
                <BrandLogo compact className="h-8 w-8" />
                <span className="font-serif font-semibold text-white">{t('home.footerBrand')}</span>
              </div>
              <p className="leading-relaxed text-white/70 text-pretty">{t('home.footerBrandDesc')}</p>
            </div>
            <div>
              <h4 className="mb-3 font-medium text-white">{t('home.footerSourceTitle')}</h4>
              <p className="leading-relaxed text-white/70 text-pretty">{t('home.footerSourceText')}</p>
              <p className="mt-2 leading-relaxed text-white/60 text-pretty">{t('home.authBody')}</p>
              {catalogSource?.url && (
                <a
                  href={catalogSource.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-2 inline-flex text-[#e8c98a] underline underline-offset-2 hover:text-white"
                >
                  {t('home.authLink404')}
                </a>
              )}
            </div>
            <div>
              <h4 className="mb-3 font-medium text-white">{t('home.footerLogTitle')}</h4>
              <ul className="space-y-1.5 text-white/70">
                <li>{t('home.footerLog8')}</li>
                <li>{t('home.footerLog6')}</li>
                <li>{t('home.footerLog5')}</li>
                <li>{t('home.footerLog4')}</li>
              </ul>
            </div>
          </div>
          <div className="mt-8 border-t border-white/10 pt-6 text-center text-xs text-white/60">
            {t('home.footerCopyright')} · {t('home.footerContact')}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default HomePage;
