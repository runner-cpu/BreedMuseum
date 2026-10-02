import React, { useId } from 'react';
import { AccessibleChartSummary } from '@/components/common/AccessibleChartSummary';
import { MapPin, Tag, AlertTriangle, ScrollText, GitCompare, Share2, ExternalLink, ShieldCheck } from 'lucide-react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer } from 'recharts';
import type { Breed } from '@/data/breeds';
import { categoryColors, endangeredColors } from '@/lib/categoryIcons';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { useSettings } from '@/contexts/AppSettings';
import { getBreedMetadata, getBreedSource } from '@/data/breedMetadata';
import { BreedImage } from '@/components/common/BreedImage';

interface BreedDetailProps {
  breed: Breed | null;
  loading?: boolean;
  onToggleCompare?: () => void;
  isInCompare?: boolean;
}

const BreedDetail: React.FC<BreedDetailProps> = ({
  breed,
  loading = false,
  onToggleCompare,
  isInCompare = false,
}) => {
  const { t } = useSettings();
  const provenanceId = useId();

  if (loading) {
    return (
      <div className="flex flex-col h-full overflow-y-auto">
        <Skeleton className="w-full aspect-[4/3] shrink-0 bg-muted" />
        <div className="p-4 flex flex-col gap-4">
          <div className="space-y-2">
            <Skeleton className="h-6 w-2/3 bg-muted" />
            <Skeleton className="h-4 w-1/3 bg-muted" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4 bg-muted" />
            <Skeleton className="h-3 w-full bg-muted" />
            <Skeleton className="h-3 w-5/6 bg-muted" />
          </div>
          <Skeleton className="h-52 w-full bg-muted" />
          <div className="space-y-2">
            <Skeleton className="h-4 w-1/4 bg-muted" />
            <Skeleton className="h-3 w-full bg-muted" />
            <Skeleton className="h-3 w-4/5 bg-muted" />
          </div>
        </div>
      </div>
    );
  }

  if (!breed) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <ScrollText className="w-8 h-8 text-muted-foreground" />
        </div>
        <p className="text-muted-foreground text-sm">{t('detail.selectPrompt')}</p>
      </div>
    );
  }

  const radarData = [
    { dimension: t('detail.dim.meat'), value: breed.radar.meat },
    { dimension: t('detail.dim.milk'), value: breed.radar.milk },
    { dimension: t('detail.dim.reproduction'), value: breed.radar.reproduction },
    { dimension: t('detail.dim.labor'), value: breed.radar.labor },
    { dimension: t('detail.dim.adaptability'), value: breed.radar.adaptability },
  ];
  const hasRadarData = Object.values(breed.radar).every((value) => value !== null);
  const metadata = getBreedMetadata(breed);
  const sourceRecords = metadata.sourceIds
    .map((sourceId) => getBreedSource(sourceId))
    .filter((source): source is NonNullable<typeof source> => Boolean(source));
  const protectionLabel =
    metadata.protectionStatus === 'national-list'
      ? t('detail.protectionNational')
      : metadata.protectionStatus === 'not-on-national-list'
        ? t('detail.protectionNotListed')
        : t('detail.protectionPending');

  const catColor = categoryColors[breed.category] ?? 'hsl(var(--primary))';
  const endColor = endangeredColors[breed.endangered] ?? 'hsl(var(--muted-foreground))';

  const handleShare = async () => {
    const url = `${window.location.origin}${window.location.pathname}#/map?breed_id=${breed.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t('common.copied'));
    } catch {
      toast.error(t('common.copyFail'));
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="relative w-full aspect-[4/3] overflow-hidden bg-muted shrink-0">
        <BreedImage
          src={breed.image}
          alt={breed.name}
          className="absolute inset-0 h-full w-full"
          imgClassName="object-cover"
        />
        <div className="absolute top-2 right-2 flex gap-1.5">
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
            style={{ backgroundColor: catColor }}
          >
            {breed.category}
          </span>
          <span
            className="px-2 py-0.5 rounded-full text-xs font-medium text-white flex items-center gap-0.5"
            style={{ backgroundColor: endColor }}
          >
            <AlertTriangle className="w-3 h-3" />
            {breed.endangered}
          </span>
        </div>
        {/* 收藏按钮已移除（站点为公开科普站，无需登录） */}
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h3 className="text-xl font-serif font-bold text-foreground text-balance">{breed.name}</h3>
          <p className="text-sm text-muted-foreground mt-0.5">{breed.englishName}</p>
          <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />
              {breed.province}
            </span>
            <span className="flex items-center gap-1">
              <Tag className="w-3.5 h-3.5" />
              {breed.category}{t('detail.categorySuffix')}
            </span>
          </div>
        </div>

        {/* 操作按钮：对比 + 分享 */}
        <div className="flex items-center gap-2">
          {onToggleCompare && (
            <button
              type="button"
              onClick={onToggleCompare}
              className={`flex-1 inline-flex items-center justify-center gap-1.5 min-h-11 rounded-md text-sm font-medium border transition-colors ${
                isInCompare
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-card text-foreground border-border hover:bg-accent'
              }`}
            >
              <GitCompare className="w-4 h-4" />
              {isInCompare ? t('detail.inCompare') : t('detail.addCompare')}
            </button>
          )}
          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center justify-center gap-1.5 min-h-11 px-3 rounded-md text-sm font-medium bg-card text-foreground border border-border hover:bg-accent transition-colors"
          >
            <Share2 className="w-4 h-4" />
            {t('detail.share')}
          </button>
        </div>

        {metadata.metricBasis === 'not-available' && (
          <p className="rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground">
            {t('detail.editNotice')}
          </p>
        )}

        <div>
          <h4 className="text-sm font-semibold text-foreground border-l-2 border-primary pl-2 mb-1.5">{t('detail.appearance')}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{breed.appearance}</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground border-l-2 border-primary pl-2 mb-2">{t('detail.performance')}</h4>
          {hasRadarData ? (
            <>
              <div className="w-full h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData} cx="50%" cy="50%" outerRadius="70%">
                    <PolarGrid stroke="hsl(var(--border))" />
                    <PolarAngleAxis dataKey="dimension" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                    <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
                    <Radar
                      name={t('detail.radarName')}
                      dataKey="value"
                      stroke={catColor}
                      fill={catColor}
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
              <AccessibleChartSummary caption={t('detail.metricCaption')} columns={[t('detail.colDim'), t('detail.colValue')]} rows={radarData.map(d => [d.dimension, d.value ?? t('detail.radarPending')])} />
            </>
          ) : (
            <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-6 text-center text-sm text-muted-foreground">
              {t('detail.radarPending')}
            </div>
          )}
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty mt-1">{breed.performance}</p>
        </div>

        <div>
          <h4 className="text-sm font-semibold text-foreground border-l-2 border-primary pl-2 mb-1.5">{t('detail.story')}</h4>
          <p className="text-sm text-muted-foreground leading-relaxed text-pretty">{breed.story}</p>
        </div>

        <section aria-labelledby={provenanceId} className="rounded-lg border border-border/70 bg-muted/30 p-3">
          <h4
            id={provenanceId}
            className="text-sm font-semibold text-foreground border-l-2 border-primary pl-2 mb-2 flex items-center gap-1.5"
          >
            <ShieldCheck className="w-4 h-4 text-primary" aria-hidden="true" />
            {t('detail.provenanceTitle')}
          </h4>
          <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs leading-relaxed">
            <dt className="text-muted-foreground">{metadata.protectionStatus === 'national-list' ? t('detail.officialName') : t('detail.museumName')}</dt>
            <dd className="text-foreground">{metadata.officialName}</dd>
            <dt className="text-muted-foreground">{t('detail.protectionStatus')}</dt>
            <dd className="text-foreground">{protectionLabel}</dd>
            <dt className="text-muted-foreground">{t('detail.verifiedAt')}</dt>
            <dd className="text-foreground">{metadata.verifiedAt}</dd>
            <dt className="text-muted-foreground">{t('detail.metricBasis')}</dt>
            <dd className="text-foreground">
              {metadata.metricBasis === 'not-available'
                ? t('detail.metricNA')
                : t('detail.metricCaption')}
            </dd>
            <dt className="text-muted-foreground">{t('detail.imageStatus')}</dt>
            <dd className="text-foreground">
              {metadata.imageRights === 'project-svg' ? t('detail.imageSvg') : t('detail.imageUnverified')}
            </dd>
          </dl>
          <p className="mt-3 text-xs text-muted-foreground leading-relaxed">{t('detail.provenanceNote')}</p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground" aria-label={t('detail.sourceListLabel')}>
            {sourceRecords.map((source) => (
              <li key={source.id} className="flex items-start gap-1.5">
                <span aria-hidden="true">·</span>
                {source.url ? (
                  <a
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    {source.title}
                    <ExternalLink className="w-3 h-3 shrink-0" aria-hidden="true" />
                    <span className="sr-only">{t('detail.newWindow')}</span>
                  </a>
                ) : (
                  <span>{source.title}</span>
                )}
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
};

export default BreedDetail;
