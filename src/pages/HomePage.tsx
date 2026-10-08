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
  Thermometer,
  Sparkles,
  ArrowRight,
} from 'lucide-react';
import { breeds, categories } from '@/data/breeds';
import { featuredBreeds } from '@/data/featuredBreeds';
import { breedSources } from '@/data/breedSources';
import { getBreedMetadata } from '@/data/breedMetadata';
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
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import { BrandLogo } from '@/components/brand/BrandLogo';


const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCategory, setSelectedBreedId } = useMuseum();
  const { t } = useSettings();

  const distinctProvinces = COLLECTION_SUMMARY.provinces;
  const endangeredCount = COLLECTION_SUMMARY.editorialEndangered;

  const statItems: ChromaItem[] = [
    {
      title: String(COLLECTION_SUMMARY.total),
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
      title: String(COLLECTION_SUMMARY.categories),
      subtitle: t('home.statCategoriesLabel'),
      handle: `${COLLECTION_SUMMARY.categories}${t('home.statCategoriesSub')}`,
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

  // 三大核心入口：地图底座 + 环境决策台 + 品种推荐
  const coreEntries = [
    {
      icon: <MapIcon className="w-6 h-6" />,
      title: t('home.entryMap'),
      description: t('home.entryMapDesc'),
      to: '/map',
      accent: '#6b8fb5',
      isNew: false,
    },
    {
      icon: <Thermometer className="w-6 h-6" />,
      title: t('home.entryPasture'),
      description: t('home.entryPastureDesc'),
      to: '/pasture',
      accent: '#d4a853',
      isNew: true,
    },
    {
      icon: <Sparkles className="w-6 h-6" />,
      title: t('home.entryRecommend'),
      description: t('home.entryRecommendDesc'),
      to: '/recommend',
      accent: '#7aa87a',
      isNew: true,
    },
  ];

  const categoryCounts = useMemo(
    () => {
      const counts = new Map<string, number>();
      for (const breed of breeds) counts.set(breed.category, (counts.get(breed.category) ?? 0) + 1);
      return categories.map((cat) => ({ cat, count: counts.get(cat) ?? 0 }));
    },
    [categories],
  );

  const highlightedBreeds = featuredBreeds;

  // 三江源故事与数据权威性：统计全部由运行时数据推导，避免手写数字漂移
  const storyStats = useMemo(() => {
    const qinghai = breeds.filter((b) => b.province === '青海');
    const plateau = breeds.filter((b) => b.province === '青海' || b.province === '西藏');
    const endangered = qinghai.filter((b) => b.endangered === '濒危' || b.endangered === '极危');
    const protectedListed = qinghai.filter((b) => getBreedMetadata(b).protectionStatus === 'national-list');
    return {
      qinghai: qinghai.length,
      plateau: plateau.length,
      endangered: endangered.length,
      protectedListed: protectedListed.length,
    };
  }, []);
  const catalogSource = breedSources['nahs-catalog-2024'];

  const handleHeroSearch = (q: string) => {
    const query = q.trim();
    // 百科页自行从 URL 读取搜索词；这里不再写入全局状态，
    // 避免残留的搜索词在之后打开 /map 时造成“莫名被筛选”。
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
    <div className="relative bg-black">
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
        {/* 模块二：三大核心入口（地图 / 环境决策台 / 品种推荐） */}
        <section className="py-16 md:py-20" aria-label={t('home.entryTitle')}>
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.entryTitle')} />
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {coreEntries.map((entry) => (
                <button
                  key={entry.to}
                  type="button"
                  onClick={() => navigate(entry.to)}
                  className="group relative overflow-hidden rounded-xl border border-white/15 bg-white/5 p-6 text-left transition-all hover:border-white/40 hover:bg-white/10"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1"
                    style={{ backgroundColor: entry.accent }}
                  />
                  <div className="flex items-center gap-3">
                    <span
                      className="inline-flex h-11 w-11 items-center justify-center rounded-lg text-white"
                      style={{ backgroundColor: entry.accent }}
                    >
                      {entry.icon}
                    </span>
                    <h3 className="text-base font-semibold text-white">{entry.title}</h3>
                    {entry.isNew && (
                      <span className="ml-auto rounded-full bg-[#d4a853] px-2 py-0.5 text-[10px] font-bold text-[#1a3a2a]">
                        {t('home.entryNew')}
                      </span>
                    )}
                  </div>
                  <p className="mt-3 text-sm text-white/65 leading-relaxed text-pretty">{entry.description}</p>
                  <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: entry.accent }}>
                    {t('home.entryOpen')}
                    <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* 模块三：核心数据看板（ChromaGrid） */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.coreData')} />
            </h2>
            <ChromaGrid items={statItems} columns={4} onNavigate={(url) => navigate(url)} />
            <p className="text-center text-xs text-white/60 mt-8">{t('home.dataSource')}</p>
          </div>
        </section>

        {/* 模块四：品种类别速览 */}
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

        {/* 模块五：精选品种 */}
        <section className="py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-8 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.featuredTitle')} />
            </h2>
            {highlightedBreeds.length > 0 ? (
              <div className="flex gap-4 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
                {highlightedBreeds.map((breed) => (
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
                      <p className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {breed.province}
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border border-white/10 rounded-xl bg-white/5">
                <p className="text-sm text-white/60">{t('home.noFeaturedBreeds')}</p>
              </div>
            )}
          </div>
        </section>

        {/* 模块六：三江源故事 + 数据权威性 */}
        <section className="py-16 md:py-20" aria-label={t('home.storyTitle')}>
          <div className="max-w-5xl mx-auto px-4 md:px-6">
            <h2 className="text-xl md:text-2xl font-serif font-bold text-white mb-6 border-l-4 border-[#d4a853] pl-3">
              <ScrollFloat text={t('home.storyTitle')} />
            </h2>
            <div className="rounded-2xl border border-white/12 bg-gradient-to-br from-white/[0.06] to-white/[0.02] p-6 md:p-8">
              <p className="text-sm md:text-[15px] text-white/75 leading-relaxed text-pretty">{t('home.storyBody')}</p>
              <dl className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                {[
                  { label: t('home.storyStatBreeds'), value: storyStats.qinghai },
                  { label: t('home.storyStatPlateau'), value: storyStats.plateau },
                  { label: t('home.storyStatProtected'), value: storyStats.protectedListed },
                  { label: t('home.storyStatEndangered'), value: storyStats.endangered },
                ].map((item) => (
                  <div key={item.label} className="rounded-xl border border-white/10 bg-black/30 px-4 py-3">
                    <dt className="text-xs text-white/55">{item.label}</dt>
                    <dd className="mt-1 font-serif text-2xl md:text-3xl font-bold text-[#e8c98a] tabular-nums">{item.value}</dd>
                  </div>
                ))}
              </dl>
              <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-white/10 pt-4 text-xs text-white/60">
                <span className="inline-flex items-center gap-1.5 font-medium text-white/80">
                  <Database className="w-3.5 h-3.5 text-[#d4a853]" />
                  {t('home.authTitle')}
                </span>
                <span>{t('home.authBody')}</span>
                {catalogSource?.url && (
                  <a
                    href={catalogSource.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-[#e8c98a] underline underline-offset-2 hover:text-white"
                  >
                    {t('home.authLink404')}
                  </a>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* 模块七：关于本项目 */}
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
        <section className="bg-black text-white/70" aria-label={t('home.footerBrand')}>
          <div className="max-w-5xl mx-auto px-4 md:px-6 py-10">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <BrandLogo compact className="h-8 w-8" />
                  <span className="font-serif text-white font-semibold">{t('home.footerBrand')}</span>
                </div>
                <p className="text-white/70 leading-relaxed text-pretty">{t('home.footerBrandDesc')}</p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-3">{t('home.footerSourceTitle')}</h4>
                <p className="text-white/70 leading-relaxed text-pretty">{t('home.footerSourceText')}</p>
              </div>
              <div>
                <h4 className="text-white font-medium mb-3">{t('home.footerLogTitle')}</h4>
                <ul className="space-y-1.5 text-white/70">
                  <li>{t('home.footerLog6')}</li>
                  <li>{t('home.footerLog5')}</li>
                  <li>{t('home.footerLog4')}</li>
                  <li>{t('home.footerLog1')}</li>
                </ul>
              </div>
            </div>
            <div className="border-t border-white/10 mt-8 pt-6 text-center text-xs text-white/60">
              {t('home.footerCopyright')} · {t('home.footerContact')}
            </div>
          </div>
        </section>
      </BackgroundWrapper>
    </div>
  );
};

export default HomePage;
