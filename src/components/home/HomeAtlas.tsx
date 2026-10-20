import { ArrowUpRight, MapPinned, Search, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSettings } from '@/contexts/AppSettings';
import { COLLECTION_SUMMARY } from '@/data/collectionSummary';
import {
  HOME_ATLAS_CHIPS,
  HOME_ATLAS_PROVINCES,
  HOME_ATLAS_SITES,
  HOME_ATLAS_TOTALS,
} from '@/data/homeAtlas';
import { mapViewBox, provincePaths } from '@/data/chinaMap';
import { categoryLabel, fill, provinceLabel } from '@/lib/displayLabels';
import { buildProvinceChoropleth, CHOROPLETH_DARK_COLORS } from '@/lib/geo/provinceChoropleth';

type AtlasLens = 'all' | 'protect' | 'risk';

const LENSES: ReadonlyArray<{ id: AtlasLens; labelKey: string }> = [
  { id: 'all', labelKey: 'explore.lensAll' },
  { id: 'protect', labelKey: 'explore.lensProtect' },
  { id: 'risk', labelKey: 'explore.lensRisk' },
];

/** `provincePaths` 用全称，图集用简称；这里只做显示归并，不改数据。 */
const shortProvince = (name: string): string =>
  name.replace(/省|市|壮族自治区|回族自治区|维吾尔自治区|自治区|特别行政区/g, '');

const formatNumber = (value: number, language: 'zh' | 'en') =>
  new Intl.NumberFormat(language === 'en' ? 'en-US' : 'zh-CN').format(value);

/**
 * 首页「看 · 分布」：一张真正承载数据的中国地图。
 *
 * 赛道是数据可视化方向，首屏就不该只是一个装饰性轮廓。这里直接把
 * 154 个已核验产区画在省域轮廓上：
 * - 省块色阶 = 当前镜头下该省的可落点记录数（与 `/explore` 同一分位函数）；
 * - 每个金点 = 一个已核验产区，点径按该镜头下的记录数分档；
 * - 镜头（全部 / 国家级保护 / 濒危之窗）同时改变省块色阶与点位，
 *   切换的是「哪条记录算数」，不是换一张图；
 * - 点选省份在图下展开一行速览与三个代表品种，直接进百科。
 *
 * 数据来自预计算常量 `homeAtlas.ts`（首页不能 import 660 kB 的品种库），
 * 由 `homeAtlas.test.ts` 与运行时聚合逐项比对。
 */
export function HomeAtlas() {
  const { t, language, isDark } = useSettings();
  const navigate = useNavigate();
  const [lens, setLens] = useState<AtlasLens>('all');
  const [hovered, setHovered] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);
  const [query, setQuery] = useState('');

  /** 镜头只改变「哪条记录算数」，省块与点位都从同一组计数派生。 */
  const lensValue = (entry: (typeof HOME_ATLAS_PROVINCES)[number], id: AtlasLens): number => {
    if (id === 'protect') return entry.protected;
    if (id === 'risk') return entry.endangered;
    return entry.total;
  };

  const values = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of HOME_ATLAS_PROVINCES) map.set(entry.name, lensValue(entry, lens));
    return map;
  }, [lens]);

  const choropleth = useMemo(() => buildProvinceChoropleth(values), [values]);
  const palette = isDark ? CHOROPLETH_DARK_COLORS : choropleth.colors;

  const sites = useMemo(
    () =>
      HOME_ATLAS_SITES.filter(([, , , total, protectedCount, endangeredCount]) => {
        if (lens === 'protect') return protectedCount > 0;
        if (lens === 'risk') return endangeredCount > 0;
        return total > 0;
      }).map((site) => ({
        site,
        count: lens === 'protect' ? site[4] : lens === 'risk' ? site[5] : site[3],
      })),
    [lens],
  );

  const focusProvince = selected ?? hovered;
  const focusIndex = focusProvince
    ? HOME_ATLAS_PROVINCES.findIndex((entry) => entry.name === focusProvince)
    : -1;
  const focusEntry = focusIndex >= 0 ? HOME_ATLAS_PROVINCES[focusIndex] : null;
  const focusChips = focusIndex >= 0 ? HOME_ATLAS_CHIPS[focusIndex] ?? [] : [];

  const readout = focusEntry
    ? fill(t('home.atlasReadout'), {
        province: provinceLabel(focusEntry.name, language),
        n: formatNumber(lensValue(focusEntry, lens), language),
      })
    : t('home.atlasHint');

  return (
    <section className="museum-atlas" aria-labelledby="home-atlas-title">
      <div className="museum-atlas-copy">
        <p className="museum-eyebrow">{t('home.atlasEyebrow')}</p>
        <h1 id="home-atlas-title" className="museum-atlas-title">
          {/* 视觉上是钩子句，可访问名称仍以馆名开头，屏幕阅读器与搜索结果都能判断这是哪一页。 */}
          <span className="sr-only">{t('app.title')}：</span>
          {fill(t('home.hookTitle'), {
            total: formatNumber(COLLECTION_SUMMARY.total, language),
            visible: formatNumber(HOME_ATLAS_TOTALS.records, language),
          })}
        </h1>
        <p className="museum-atlas-dek">
          {fill(t('home.hookDek'), {
            visible: formatNumber(HOME_ATLAS_TOTALS.records, language),
          })}
        </p>

        <dl className="museum-atlas-stats">
          {[
            { value: HOME_ATLAS_TOTALS.records, label: t('home.statVisibleLabel') },
            { value: HOME_ATLAS_TOTALS.sites, label: t('home.atlasSitesLabel') },
            { value: HOME_ATLAS_TOTALS.provinces, label: t('home.statProvincesLabel') },
            { value: HOME_ATLAS_TOTALS.protected, label: t('home.atlasProtectedLabel') },
          ].map((item) => (
            <div key={item.label}>
              <dt>{item.label}</dt>
              <dd>{formatNumber(item.value, language)}</dd>
            </div>
          ))}
        </dl>

        <form
          role="search"
          className="museum-atlas-search"
          onSubmit={(event) => {
            event.preventDefault();
            navigate(
              query.trim() ? `/encyclopedia?search=${encodeURIComponent(query.trim())}` : '/encyclopedia',
            );
          }}
        >
          <Search className="h-4 w-4 shrink-0" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            aria-label={t('hero.searchAria')}
            placeholder={t('home.heroSearchPh')}
          />
          <button type="submit">{t('home.searchCta')}</button>
        </form>

        <div className="museum-atlas-actions">
          <Link to="/explore" className="museum-atlas-primary">
            {t('home.startExplore')}
            <ArrowUpRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <Link to="/dashboard" className="museum-link">
            {t('home.atlasScopeLink')}
          </Link>
        </div>
      </div>

      <div className="museum-atlas-stage">
        <div className="museum-atlas-toolbar">
          <div role="group" aria-label={t('explore.lensGroup')} className="museum-atlas-lenses">
            {LENSES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={lens === item.id}
                onClick={() => setLens(item.id)}
                className={`museum-atlas-lens ${lens === item.id ? 'is-active' : ''}`}
              >
                {t(item.labelKey)}
              </button>
            ))}
          </div>
          <p className="museum-atlas-readout" aria-live="polite">
            {readout}
          </p>
        </div>

        <div className="museum-atlas-map" role="group" aria-label={t('home.atlasMapAria')}>
          <svg viewBox={`0 0 ${mapViewBox.width} ${mapViewBox.height}`} className="h-full w-full">
            <title>{t('home.atlasMapAria')}</title>
            {Object.entries(provincePaths).map(([fullName, path]) => {
              const name = shortProvince(fullName);
              const count = values.get(name) ?? 0;
              const hasData = count > 0;
              const isFocus = focusProvince === name;
              const isDimmed = Boolean(focusProvince) && !isFocus;
              return (
                <path
                  key={fullName}
                  d={path}
                  role={hasData ? 'button' : undefined}
                  tabIndex={hasData ? 0 : undefined}
                  aria-label={
                    hasData
                      ? fill(t('home.atlasProvinceAria'), {
                          province: provinceLabel(name, language),
                          n: count,
                        })
                      : undefined
                  }
                  aria-pressed={hasData ? isFocus : undefined}
                  fill={hasData ? palette[choropleth.binFor(count)] : 'var(--stage-soft)'}
                  stroke={isFocus ? 'var(--stage-gold)' : 'var(--museum-line)'}
                  strokeWidth={isFocus ? 2.4 : 0.8}
                  opacity={isDimmed ? 0.42 : 1}
                  className={hasData ? 'museum-atlas-province is-live' : 'museum-atlas-province'}
                  onMouseEnter={() => setHovered(name)}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered(name)}
                  onBlur={() => setHovered(null)}
                  onClick={() => {
                    if (!hasData) return;
                    setSelected((current) => {
                      if (current === name) {
                        // 取消选中的同时清掉 hover 预览，否则焦点还留在省块上，
                        // 速览条会立刻被 hovered 重新点亮，看起来像没关掉。
                        setHovered(null);
                        return null;
                      }
                      return name;
                    });
                  }}
                  onKeyDown={(event) => {
                    if (!hasData) return;
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setSelected((current) => {
                        if (current === name) {
                          setHovered(null);
                          return null;
                        }
                        return name;
                      });
                    }
                  }}
                >
                  <title>
                    {hasData ? `${provinceLabel(name, language)} · ${count}` : provinceLabel(name, language)}
                  </title>
                </path>
              );
            })}

            {sites.map(({ site, count }, index) => {
              const [provinceIndex, x, y] = site;
              const province = HOME_ATLAS_PROVINCES[provinceIndex];
              const isDimmed = Boolean(focusProvince) && focusProvince !== province?.name;
              return (
                <circle
                  key={`${provinceIndex}-${x}-${y}-${index}`}
                  cx={x}
                  cy={y}
                  r={2.4 + Math.min(3.2, (count - 1) * 0.22)}
                  className="museum-atlas-dot"
                  fill={lens === 'risk' ? '#d98a4a' : lens === 'protect' ? '#c79a45' : 'var(--stage-gold)'}
                  stroke="rgb(8 19 14 / 0.55)"
                  strokeWidth={0.8}
                  opacity={isDimmed ? 0.22 : 0.94}
                  style={{ animationDelay: `${Math.min(index * 5, 620)}ms` }}
                />
              );
            })}
          </svg>
        </div>

        <div className="museum-atlas-legend">
          <span className="museum-atlas-legend-scale" aria-hidden="true">
            {palette.map((color) => (
              <i key={color} style={{ background: color }} />
            ))}
          </span>
          <span>{t('home.atlasLegendScale')}</span>
          <span className="museum-atlas-legend-dot" aria-hidden="true" />
          <span>{t('home.atlasLegendDot')}</span>
        </div>

        {focusEntry ? (
          <div
            className="museum-atlas-brief"
            role="region"
            aria-label={fill(t('home.atlasBriefAria'), {
              province: provinceLabel(focusEntry.name, language),
            })}
          >
            <div className="museum-atlas-brief-head">
              <p>
                <MapPinned className="h-4 w-4" aria-hidden="true" />
                <strong>{provinceLabel(focusEntry.name, language)}</strong>
                <span>
                  {fill(t('home.atlasBriefCount'), {
                    total: formatNumber(focusEntry.total, language),
                    protected: formatNumber(focusEntry.protected, language),
                  })}
                </span>
              </p>
              <Link
                to={`/explore?province=${encodeURIComponent(focusEntry.name)}`}
                className="museum-link"
              >
                {t('home.atlasOpenMap')}
              </Link>
            </div>
            <p className="museum-atlas-brief-cats">
              {fill(t('home.atlasBriefCategories'), {
                categories: focusEntry.categories
                  .map(([category, count]) => `${categoryLabel(category, language)} ${count}`)
                  .join(' · '),
              })}
            </p>
            <div className="museum-atlas-brief-chips">
              <span>{t('home.atlasChipsLabel')}</span>
              {focusChips.map(([id, name, englishName]) => (
                <Link key={id} to={`/encyclopedia?breed=${encodeURIComponent(id)}`}>
                  {language === 'en' ? englishName : name}
                </Link>
              ))}
            </div>
          </div>
        ) : (
          <p className="museum-atlas-empty">
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            {t('home.atlasTrustNote')}
          </p>
        )}
      </div>
    </section>
  );
}

export default HomeAtlas;
