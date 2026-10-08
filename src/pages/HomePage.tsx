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

/** 入口卡缩略预览：THI 色带 + 大数字（纯 CSS/SVG，截图级示意） */
const ThiPreview: React.FC = () => (
  <svg viewBox="0 0 200 110" aria-hidden="true" className="h-full w-full">
    <rect x="0" y="0" width="200" height="110" rx="8" fill="#101820" />
    <text x="14" y="34" fontSize="26" fontWeight="700" fill="#f97316">27.4</text>
    <text x="72" y="34" fontSize="11" fill="#9ca3af">THI</text>
    <rect x="14" y="46" width="172" height="10" rx="5" fill="#1f2937" />
    <rect x="14" y="46" width="60" height="10" rx="5" fill="#22c55e" />
    <rect x="74" y="46" width="44" height="10" fill="#eab308" />
    <rect x="118" y="46" width="40" height="10" fill="#f97316" />
    <rect x="158" y="46" width="28" height="10" rx="5" fill="#dc2626" />
    <circle cx="138" cy="51" r="6" fill="#fff" stroke="#101820" strokeWidth="2" />
    <text x="14" y="80" fontSize="10" fill="#9ca3af">温度 30℃ · 湿度 60% · 海拔 3200m</text>
    <text x="14" y="96" fontSize="10" fill="#f97316">危险：停止午间放牧 · 通风 · 夜间补饲</text>
  </svg>
);

/** 入口卡缩略预览：适配评分进度条 + 三条匹配 */
const ScorePreview: React.FC = () => (
  <svg viewBox="0 0 200 110" aria-hidden="true" className="h-full w-full">
    <rect x="0" y="0" width="200" height="110" rx="8" fill="#101820" />
    <text x="14" y="30" fontSize="12" fontWeight="700" fill="#e5e7eb">环湖牦牛</text>
    <text x="150" y="30" fontSize="12" fontWeight="700" fill="#7aa87a">100 分</text>
    <rect x="14" y="38" width="172" height="8" rx="4" fill="#1f2937" />
    <rect x="14" y="38" width="172" height="8" rx="4" fill="#7aa87a" />
    <text x="14" y="62" fontSize="10" fill="#9ca3af">✓ 海拔匹配　✓ 用途匹配　✓ 模式匹配</text>
    <text x="14" y="80" fontSize="10" fill="#6b7280">适宜区间 3000–5000 米 · 肉用 · 放牧</text>
    <text x="14" y="98" fontSize="10" fill="#7aa87a">点击查看品种详情 →</text>
  </svg>
);

/** 入口卡缩略预览：地图散点 + 濒危红点 */
const MapPreview: React.FC = () => (
  <svg viewBox="0 0 200 110" aria-hidden="true" className="h-full w-full">
    <rect x="0" y="0" width="200" height="110" rx="8" fill="#101820" />
    <path d="M30 30 L70 18 L110 26 L150 22 L170 40 L150 70 L110 88 L70 82 L36 62 Z" fill="#1f2937" stroke="#3b4a5a" strokeWidth="1.5" />
    <circle cx="60" cy="46" r="3.5" fill="#6b8fb5" />
    <circle cx="92" cy="40" r="3.5" fill="#6b8fb5" />
    <circle cx="118" cy="58" r="3.5" fill="#6b8fb5" />
    <circle cx="84" cy="66" r="3.5" fill="#6b8fb5" />
    <circle cx="136" cy="44" r="4" fill="#e0533a" />
    <circle cx="104" cy="34" r="4" fill="#e0533a" />
    <text x="14" y="102" fontSize="10" fill="#9ca3af">31 省 · 青海 28 · 红点为濒危品种</text>
  </svg>
);

const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const { setSelectedCategory, setSelectedBreedId } = useMuseum();
  const { t } = useSettings();

  const distinctProvinces = COLLECTION_SUMMARY.provinces;
  const plateauProtected = COLLECTION_SUMMARY.plateauNationalProtected;
  const plateauCount = COLLECTION_SUMMARY.plateau;

  // 首屏四大核心数字（真实运行时值，滚动计数动画）
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
      title: String(plateauCount),
      subtitle: t('home.statPlateauLabel'),
      handle: t('home.statPlateauSub'),
      borderColor: '#22c55e',
      gradient: 'linear-gradient(145deg, #0f3d2e, #06140f)',
      url: '/dashboard',
      countUp: true,
    },
    {
      title: String(distinctProvinces),
      subtitle: t('home.statProvincesLabel'),
      handle: `${distinctProvinces}${t('home.statProvincesSub')}`,
      borderColor: '#38bdf8',
      gradient: 'linear-gradient(145deg, #123a52, #061620)',
      url: '/map',
      countUp: true,
    },
    {
      title: String(plateauProtected),
      subtitle: t('home.statProtectedLabel'),
      handle: t('home.statProtectedSub'),
      borderColor: '#d4a853',
      gradient: 'linear-gradient(145deg, #3d2f12, #1a1206)',
      url: '/dashboard',
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

  // 三大核心入口（牧场决策 / 品种推荐 / 品种地图），各带一张缩略预览图
  const coreEntries = [
    {
      icon: <Thermometer className="w-5 h-5" />,
      title: t('home.entryPasture'),
      description: t('home.entryPastureDesc'),
      to: '/pasture',
      accent: '#d4a853',
      isNew: true,
      preview: <ThiPreview />,
      alt: t('home.entryPastureAlt'),
    },
    {
      icon: <Sparkles className="w-5 h-5" />,
      title: t('home.entryRecommend'),
      description: t('home.entryRecommendDesc'),
      to: '/recommend',
      accent: '#7aa87a',
      isNew: true,
      preview: <ScorePreview />,
      alt: t('home.entryRecommendAlt'),
    },
    {
      icon: <MapIcon className="w-5 h-5" />,
      title: t('home.entryMap'),
      description: t('home.entryMapDesc'),
      to: '/map',
      accent: '#6b8fb5',
      isNew: false,
      preview: <MapPreview />,
      alt: t('home.entryMapAlt'),
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
                  className="group relative overflow-hidden rounded-xl border border-white/15 bg-white/5 text-left transition-all hover:border-white/40 hover:bg-white/10"
                >
                  <span
                    aria-hidden="true"
                    className="absolute inset-x-0 top-0 h-1 z-10"
                    style={{ backgroundColor: entry.accent }}
                  />
                  {/* 缩略预览：一眼看出模块长什么样 */}
                  <span className="block aspect-[20/11] w-full overflow-hidden border-b border-white/10 bg-black/40" role="img" aria-label={entry.alt}>
                    {entry.preview}
                  </span>
                  <span className="block p-5">
                    <span className="flex items-center gap-3">
                      <span
                        className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg text-white"
                        style={{ backgroundColor: entry.accent }}
                      >
                        {entry.icon}
                      </span>
                      <span className="text-base font-semibold text-white">{entry.title}</span>
                      {entry.isNew && (
                        <span className="ml-auto rounded-full bg-[#d4a853] px-2 py-0.5 text-[10px] font-bold text-[#1a3a2a]">
                          {t('home.entryNew')}
                        </span>
                      )}
                    </span>
                    <span className="mt-3 block text-sm text-white/65 leading-relaxed text-pretty">{entry.description}</span>
                    <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium" style={{ color: entry.accent }}>
                      {t('home.entryOpen')}
                      <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                    </span>
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
            <p className="text-center text-[11px] text-white/45 mt-2">{t('home.statsFootnote')}</p>
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
