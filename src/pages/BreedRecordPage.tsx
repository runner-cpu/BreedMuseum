import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, ExternalLink, MapPin, ShieldCheck, Tag } from 'lucide-react';
import BreedDetail from '@/components/BreedDetail';
import { VerificationBadge } from '@/components/common/VerificationBadge';
import { getBreedById } from '@/data/breedLookup';
import { getBreedMetadata } from '@/data/breedMetadata';
import { protectionLabel } from '@/data/verification';
import batchMap from '@/data/breedBatch.generated.json';

/**
 * 单卷档案（`/breed/:id`）——可独立分享的品种页。
 *
 * 保留既有 `BreedDetail`（图片、体貌、性能、雷达、来源核验区），
 * 外层补上「卷宗头部」：档案编号 + 批次 + 三态核验徽章 + 官方来源链接，
 * 让光图上任意一道产区光束都能在 3 次点击内链回官方文件。
 */

export default function BreedRecordPage() {
  const { id } = useParams<{ id: string }>();
  const breed = getBreedById(id ?? null);

  if (!breed) {
    return (
      <div className="min-h-full bg-stage px-4 py-10 text-stage-fg">
        <div className="mx-auto max-w-2xl space-y-4">
          <h1 className="font-serif text-2xl">档案未找到</h1>
          <p className="text-sm text-stage-muted">
            这条记录不在馆藏中，可能已被合并为同物异名或链接有误。
          </p>
          <Link className="inline-flex min-h-11 items-center gap-1.5 underline underline-offset-4" to="/">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            返回光图
          </Link>
        </div>
      </div>
    );
  }

  const metadata = getBreedMetadata(breed);
  const batch = (batchMap.byId as Record<string, string>)[breed.id];
  const sources = metadata.sourceIds.map((sourceId) => ({
    id: sourceId,
    meta: metadata,
  }));

  return (
    <div className="min-h-full bg-stage px-4 py-6 text-stage-fg">
      <div className="mx-auto w-full max-w-4xl space-y-4">
        {/* 卷宗头部 */}
        <header className="space-y-3 rounded-xl border border-stage-border bg-stage-panel p-4">
          <div className="flex flex-wrap items-center gap-2 text-xs text-stage-muted">
            <span className="font-mono">档案编号 BM-{breed.id.toUpperCase()}</span>
            {batch && (
              <>
                <span aria-hidden="true">·</span>
                <span>{batch}</span>
              </>
            )}
            <VerificationBadge breed={breed} />
          </div>
          <div className="space-y-1">
            <h1 className="font-serif text-2xl">{breed.name}</h1>
            <p className="text-sm text-stage-muted">{breed.englishName}</p>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-stage-muted">
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5" aria-hidden="true" />
              {breed.province}
            </span>
            <span className="inline-flex items-center gap-1">
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              {breed.category}
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
              {protectionLabel(metadata.protectionStatus)}
            </span>
            {metadata.aliases.length > 0 && (
              <span>别名：{metadata.aliases.join('、')}</span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <Link className="underline underline-offset-4 hover:text-stage-gold" to="/">
              ← 回到光图
            </Link>
            <Link className="underline underline-offset-4 hover:text-stage-gold" to="/arcade">
              去互动厅
            </Link>
            <a
              className="inline-flex items-center gap-1 underline underline-offset-4 hover:text-stage-gold"
              href="https://www.nahs.org.cn/gk/tz/202502/t20250210_452797.htm"
              target="_blank"
              rel="noreferrer"
            >
              2024 名录官方页面
              <ExternalLink className="h-3 w-3" aria-hidden="true" />
            </a>
          </div>
        </header>

        {/* 既有详情组件：图片 / 体貌 / 性能 / 雷达 / 来源核验 */}
        <div className="rounded-xl border border-stage-border bg-stage-panel">
          <BreedDetail breed={breed} />
        </div>

        <p className="text-xs text-stage-muted">
          来源条目：{sources.map((item) => item.id).join(' · ') || 'breed-museum-legacy'} ·
          核验日期 {metadata.verifiedAt}
        </p>
      </div>
    </div>
  );
}
