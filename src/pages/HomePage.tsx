import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Map as MapIcon,
  BookOpen,
  Bot,
  ArrowLeftRight,
  Download,
  MapPin,
  FileText,
  Database,
  Cpu,
  Mail,
} from 'lucide-react';
import { breeds, categories } from '@/data/breeds';
import { categoryColors } from '@/lib/categoryIcons';
import { renderCategorySvgIcon } from '@/lib/categorySvgIcons';
import { useMuseum } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import SpotlightHero from '@/components/effects/SpotlightHero';
import BackgroundWrapper from '@/components/effects/BackgroundWrapper';
import ChromaGrid, { type ChromaItem } from '@/components/effects/ChromaGrid';
import ScrollFloat from '@/components/effects/ScrollFloat';
import CircularGallery from '@/components/effects/CircularGallery';
import MagicBento from '@/components/effects/MagicBento';
import { BreedImage } from '@/components/common/BreedImage';


const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCategory, setSelectedBreedId, setSearchValue } = useMuseum();
  const { t } = useSettings();

  const distinctProvinces = useMemo(() => new Set(breeds.map((b) => b.province)).size, []);
  const endangeredCount = useMemo(
    () => breeds.filter((b) => b.endangered === '濒危' || b.endangered === '极危').length,
    [],
  );

  const statItems: ChromaItem[] = [
    {
      title: String(breeds.length),
      subtitle: t('home.statBreedsLabel'),
      handle: '按实际馆藏记录统计',
      borderColor: '#4F46E5',
      gradient: 'linear-gradient(145deg, #1e2a5e, #0a0f24)',
      url: '/encyclopedia',
      countUp: true,
    },
    {
      title: String(distinctProvinces),
      subtitle: t('home.statProvincesLabel'),
      handle: `${distinctProvinces}${t('home.statProvincesSub')}`,
      borderColor: '#10B981',
      gradient: 'linear-gradient(145deg, #0f3d2e, #06140f)',
      url: '/map',
      countUp: true,
    },
    {
      title: String(categories.length),
      subtitle: t('home.statCategoriesLabel'),
      handle: `${categories.length}${t('home.statCategoriesSub')}`,
      borderColor: '#d4a853',
      gradient: 'linear-gradient(145deg, #4a3a14, #1a1408)',
      url: '/encyclopedia',
      countUp: true,
    },
    {
      title: String(endangeredCount),
      subtitle: t('home.statEndangeredLabel'),
      handle: t('home.statEndangeredSub'),
      borderColor: '#e0533a',
      gradient: 'linear-gradient(145deg, #4a1e16, #1a0a08)',
      url: '/map',
      countUp: true,
    },
  ];

  const bentoCards = [
    { icon: <MapIcon className="w-5 h-5" />, title: t('home.fMap'), description: t('home.fMapDesc'), label: 'MAP', to: '/map' },
    { icon: <BookOpen className="w-5 h-5" />, title: t('home.fEnc'), description: t('home.fEncDesc'), label: 'WIKI', to: '/encyclopedia' },
    { icon: <Bot className="w-5 h-5" />, title: t('home.fAI'), description: t('home.fAIDesc'), label: 'AI', to: '/ai' },
    { icon: <ArrowLeftRight className="w-5 h-5" />, title: t('home.fCompare'), description: t('home.fCompareDesc'), label: 'VS', to: '/compare' },
    { icon: <Download className="w-5 h-5" />, title: t('home.fExport'), description: t('home.fExportDesc'), label: 'DATA', to: '/dashboard' },
  ];

  const categoryCounts = useMemo(
    () =>
      categories.map((cat) => ({
        cat,
        count: breeds.filter((b) => b.category === cat).length,
      })),
    [],
  );

  const latestBreeds = useMemo(() => breeds.slice(-10).reverse(), []);

  const handleHeroSearch = (q: string) => {
    const query = q.trim();
    setSearchValue(query);
    // 首页搜索与百科页全局联动
    if (query) {
      navigate(`/encyclopedia?search=${encodeURIComponent(query)}`);
    } else {
      navigate('/map');
    }
  };

  const handleCategory = (cat: string) => {
    setSelectedCategory(cat);
    navigate('/encyclopedia');
  };

  const handleBreedClick = (id: string, cat: string) => {
    setSelectedBreedId(id);
    setSelectedCategory(cat);
    navigate(`/map?breed_id=${id}`);
  };

  return (
    <div className="relative bg-[#0a0a1a]">
      {/* 模块一：光标聚光地图英雄区 */}
      <SpotlightHero
        titleTop={t('home.heroTitleTop')}
        titleBottom={t('home.heroTitleBottom')}
        descLeft={t('home.heroDescLeft')}
        descRight={t('home.heroDescRight')}
        badge={t('home.heroBadge')}
        cta={t('home.startExplore')}
        searchPh={t('home.heroSearchPh')}
        searchBtn={t('common.search')}
        onExplore={() => navigate('/map')}
        onSearch={handleHeroSearch}
      />

      {/* 其余区域：星系动态背景（首页固定深色，密度x3） */}
      <BackgroundWrapper density={3}>
        {/* 模块二：核心数据看板（ChromaGrid） */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.coreData')} />
            </h2>
            <ChromaGrid items={statItems} columns={4} onNavigate={(url) => navigate(url)} />
            <p className="text-center text-xs text-white/40 mt-8">{t('home.dataSource')}</p>
          </div>
        </section>

        {/* 模块三：品种类别速览 */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.categoryOverview')} />
            </h2>
            <CircularGallery
              items={categoryCounts.map(({ cat, count }) => ({
                icon: renderCategorySvgIcon(cat, categoryColors[cat] ?? '#95A5A6', 40),
                text: t(`cat.${cat}`),
                sub: `${count} ${t('cat.count')}`,
              }))}
              onSelect={(i) => handleCategory(categoryCounts[i].cat)}
            />
          </div>
        </section>

        {/* 模块四：核心功能入口 */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.features')} />
            </h2>
            <MagicBento
              cards={bentoCards}
              glowColor="212, 168, 83"
              spotlightRadius={400}
              particleCount={12}
              enableStars={false}
              enableSpotlight={false}
              enableBorderGlow={false}
              clickEffect={false}
              onNavigate={(to) => navigate(to)}
            />
          </div>
        </section>

        {/* 模块五：最新收录品种 */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.latestTitle')} />
            </h2>
            {latestBreeds.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
                {latestBreeds.map((breed) => (
                  <button
                    key={breed.id}
                    type="button"
                    onClick={() => handleBreedClick(breed.id, breed.category)}
                    className="snap-start shrink-0 w-40 bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:border-white/30 transition-colors text-left"
                  >
                    <BreedImage
                      src={breed.image}
                      alt={breed.name}
                      className="aspect-[4/3] bg-white/5"
                      imgClassName="object-cover"
                    />
                    <div className="p-2.5">
                      <h3 className="text-sm font-semibold text-white truncate">{breed.name}</h3>
                      <p className="text-xs text-white/40 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {breed.province}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-white/10 rounded-xl bg-white/5">
                <p className="text-sm text-white/60">{t('home.noLatestBreeds')}</p>
              </div>
            )}
          </div>
        </section>

        {/* 模块六：关于本项目 */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.aboutTitle')} />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-x-12 md:gap-y-8 items-start">
              <div className="about-item">
                <div className="flex items-center gap-2 h-7 mb-3 text-base font-semibold text-white">
                  <FileText className="w-5 h-5 text-[#d4a853] shrink-0" />
                  <span>{t('home.aboutIntro')}</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed text-pretty">{t('home.aboutIntroText')}</p>
              </div>
              <div className="about-item">
                <div className="flex items-center gap-2 h-7 mb-3 text-base font-semibold text-white">
                  <Cpu className="w-5 h-5 text-[#d4a853] shrink-0" />
                  <span>{t('home.aboutTech')}</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed text-pretty">{t('home.aboutTechText')}</p>
              </div>
              <div className="about-item">
                <div className="flex items-center gap-2 h-7 mb-3 text-base font-semibold text-white">
                  <Database className="w-5 h-5 text-[#d4a853] shrink-0" />
                  <span>{t('home.aboutSource')}</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed text-pretty">{t('home.aboutSourceText')}</p>
              </div>
              <div className="about-item">
                <div className="flex items-center gap-2 h-7 mb-3 text-base font-semibold text-white">
                  <Mail className="w-5 h-5 text-[#d4a853] shrink-0" />
                  <span>{t('home.aboutContact')}</span>
                </div>
                <p className="text-sm text-white/60 leading-relaxed text-pretty">{t('home.aboutContactText')}</p>
              </div>
            </div>
          </div>
        </section>

        {/* 品牌页脚 */}
        <footer className="bg-[#050810] text-white/70">
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-8 h-8 rounded-full bg-[#d4a853] flex items-center justify-center text-[#1a3a2a] font-bold text-sm">
                    畜
                  </div>
                  <span className="font-serif text-white font-semibold">{t('home.footerBrand')}</span>
                </div>
                <p className="text-white/50 leading-relaxed text-pretty">{t('home.footerBrandDesc')}</p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-3">{t('home.footerSourceTitle')}</h4>
                <p className="text-white/50 leading-relaxed text-pretty">{t('home.footerSourceText')}</p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-3">{t('home.footerLogTitle')}</h4>
                <ul className="space-y-1.5 text-white/50">
                  <li>{t('home.footerLog6')}</li>
                  <li>{t('home.footerLog5')}</li>
                  <li>{t('home.footerLog4')}</li>
                  <li>{t('home.footerLog1')}</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-white/40">
              {t('home.footerCopyright')} · {t('home.footerContact')}
            </div>
          </div>
        </footer>
      </BackgroundWrapper>
    </div>
  );
};

export default HomePage;
