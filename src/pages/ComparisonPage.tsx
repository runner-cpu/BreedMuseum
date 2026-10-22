import { ArrowLeft, Check, GitCompare, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { BreedImage } from '@/components/common/BreedImage';
import ScrollFloat from '@/components/effects/ScrollFloat';
import { useMuseum } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import { visibleBreeds } from '@/data/visibleBreeds';
import { categoryLabel, fill, levelLabel, provinceLabel } from '@/lib/displayLabels';

/**
 * 品种对比：最多四条记录并排。
 *
 * 旧实现的表头是「每个品种一个 `<th>`」，但表体每行又多出一个行标签列，
 * 于是表头和表体列数永远差一列：第一张卡片被拉成通行宽、后面的卡片缩成
 * 窄条，图片高度相同而宽度各不相同（见问题截图）。这里把行标签列抽到表头，
 * 并给每个品种一个固定宽度的列，卡片尺寸因此一致。
 */
export default function ComparisonPage() {
  const { compareIds, removeFromCompare, clearCompare } = useMuseum();
  const { t, language } = useSettings();

  const selected = compareIds
    .map((id) => visibleBreeds.find((breed) => breed.id === id))
    .filter((breed): breed is NonNullable<typeof breed> => Boolean(breed));

  const rows: Array<{ label: string; value: (breed: (typeof selected)[number]) => string }> = [
    { label: t('compare.dim.appearance'), value: (breed) => breed.appearance || t('compare.pending') },
    { label: t('compare.dim.performance'), value: (breed) => breed.performance || t('compare.pending') },
    { label: t('compare.dim.endangered'), value: (breed) => levelLabel(breed.endangered, language) },
    { label: t('compare.dim.story'), value: (breed) => breed.story || t('compare.pending') },
  ];

  return (
    <div className="min-h-full bg-stage text-stage-fg">
      <div className="mx-auto max-w-6xl px-4 py-7 sm:px-7 lg:px-10">
        <header className="flex flex-wrap items-start justify-between gap-4 border-b border-stage-border pb-5">
          <div>
            <Link to="/encyclopedia" className="mb-3 inline-flex items-center gap-1 text-xs text-stage-gold hover:underline">
              <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
              {t('compare.backToEnc')}
            </Link>
            <ScrollFloat
              as="h1"
              once
              containerClassName="font-serif text-3xl sm:text-4xl"
              stagger={0.028}
              animationDuration={0.8}
            >
              {t('compare.headline')}
            </ScrollFloat>
            <p className="mt-2 text-sm text-stage-muted">{t('compare.intro')}</p>
          </div>
          {selected.length > 0 && (
            <button
              type="button"
              onClick={clearCompare}
              className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-stage-border px-3 text-sm text-stage-muted hover:border-stage-gold hover:text-stage-fg"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
              {t('compare.clearAll')}
            </button>
          )}
        </header>

        {selected.length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-stage-border bg-stage-panel px-6 py-20 text-center">
            <GitCompare className="mx-auto h-8 w-8 text-stage-muted" aria-hidden="true" />
            <p className="mt-3 font-serif text-2xl">{t('compare.emptyTitle')}</p>
            <p className="mt-2 text-sm text-stage-muted">{t('compare.empty')}</p>
            <Link to="/encyclopedia" className="mt-5 inline-flex min-h-11 items-center rounded-lg bg-stage-gold px-4 text-sm font-semibold text-stage">
              {t('compare.browseEnc')}
            </Link>
          </div>
        ) : (
          <div className="mt-7 overflow-x-auto">
            <table className="w-full min-w-[640px] table-fixed border-separate border-spacing-0">
              <caption className="sr-only">{t('compare.tableCaption')}</caption>
              <thead>
                <tr>
                  <th scope="col" className="w-28 border-b border-stage-border bg-stage-panel p-3 align-bottom text-left text-xs font-medium text-stage-muted">
                    {t('compare.dim.name')}
                  </th>
                  {selected.map((breed) => (
                    <th key={breed.id} scope="col" className="border-b border-stage-border bg-stage-panel p-3 align-bottom">
                      {/* 列宽相等之后，两列时图片会被撑到 450px 以上；给卡片一个上限，
                          让它保持“品种卡”的比例，而不是变成横幅。 */}
                      <div className="mx-auto w-full max-w-[15rem]">
                        <div className="relative overflow-hidden rounded-xl bg-stage-soft">
                          <BreedImage
                            src={breed.image}
                            alt={fill(t('enc.imageAlt'), { name: breed.name })}
                            category={breed.category}
                            breedName={breed.name}
                            className="aspect-[4/3] w-full"
                            sizes="(min-width: 1024px) 240px, 45vw"
                          />
                          <button
                            type="button"
                            onClick={() => removeFromCompare(breed.id)}
                            aria-label={fill(t('compare.removeBreed'), { name: breed.name })}
                            className="absolute right-2 top-2 rounded-full bg-black/55 p-1.5 text-white hover:bg-black/75"
                          >
                            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                          </button>
                        </div>
                        <p className="mt-3 truncate font-serif text-lg text-stage-fg">{language === 'en' ? breed.englishName : breed.name}</p>
                        <p className="mt-0.5 truncate text-xs font-normal text-stage-muted">
                          {categoryLabel(breed.category, language)} · {provinceLabel(breed.province, language)}
                        </p>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.label} className="align-top">
                    <th scope="row" className="border-b border-stage-border/70 p-3 text-left text-xs font-medium text-stage-muted">
                      {row.label}
                    </th>
                    {selected.map((breed) => (
                      <td key={breed.id} className="border-b border-stage-border/70 p-3 text-sm leading-6 text-stage-fg/85">
                        {row.value(breed)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="mt-5 flex items-start gap-2 text-xs text-stage-muted">
          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-stage-gold" aria-hidden="true" />
          <span>{t('compare.disclaimer')}</span>
        </p>
      </div>
    </div>
  );
}
