import { useNavigate } from 'react-router-dom';
import SpotlightHero from '@/components/effects/SpotlightHero';
import '@/styles/light-map-page.css';

export default function LightMapPage() {
  const navigate = useNavigate();
  return (
    <div className="museum-home min-h-full text-[var(--museum-fg)]">
      <SpotlightHero
        titleTop="中国地方畜禽"
        titleBottom="品种数字博物馆"
        badge="守护中华农业文明基因"
        cta="开始探索"
        searchPh="搜索品种名称，如 东北民猪、南阳牛……"
        searchBtn="搜索"
        descLeft="收录全国1000+畜禽品种，守护中华农业文明基因，从高原牦牛到江南黑猪，每一品种都承载着地域文化与生存智慧。"
        descRight="点击地图探索各地品种分布，或通过百科深入了解每个品种的独特故事。"
        onExplore={() => navigate('/explore')}
        onSearch={(value) => navigate(value.trim() ? `/encyclopedia?search=${encodeURIComponent(value.trim())}` : '/encyclopedia')}
      />
    </div>
  );
}
