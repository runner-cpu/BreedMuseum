import React from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'motion/react';
import { Trash2, Download, GitCompare, X } from 'lucide-react';
import type { Breed } from '@/data/breeds';
import { useMuseum, getBreedById } from '@/contexts/MuseumContext';
import { useSettings } from '@/contexts/AppSettings';
import { exportBreedsToCSV } from '@/lib/export';
import { categoryColors, endangeredColors } from '@/lib/categoryIcons';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

const ComparePage: React.FC = () => {
  const navigate = useNavigate();
  const { compareIds, removeFromCompare, clearCompare } = useMuseum();
  const { t } = useSettings();

  const breeds = compareIds.map(getBreedById).filter((b): b is Breed => b !== null);

  const dimensions = [
    { key: 'name', label: t('compare.dim.name') },
    { key: 'appearance', label: t('compare.dim.appearance') },
    { key: 'performance', label: t('compare.dim.performance') },
    { key: 'province', label: t('compare.dim.province') },
    { key: 'endangered', label: t('compare.dim.endangered') },
    { key: 'story', label: t('compare.dim.story') },
  ] as const;

  const handleExport = () => {
    if (breeds.length === 0) return;
    exportBreedsToCSV(breeds, '品种对比结果.csv');
    toast.success(t('compare.exported'));
  };

  if (breeds.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] text-center p-6">
        <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center mb-5">
          <GitCompare className="w-10 h-10 text-muted-foreground" />
        </div>
        <h2 className="text-lg font-serif font-bold text-foreground mb-2">{t('compare.title')}</h2>
        <p className="text-sm text-muted-foreground max-w-xs">{t('compare.empty')}</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6"
      >
        <h1 className="text-xl md:text-2xl font-serif font-bold text-foreground border-l-4 border-primary pl-3 flex items-center gap-2">
          <GitCompare className="w-6 h-6 text-primary" />
          {t('compare.title')}
        </h1>
        <div className="flex items-center gap-2 shrink-0">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="w-4 h-4 mr-1.5" />
            {t('compare.export')}
          </Button>
          <Button variant="outline" size="sm" className="text-destructive" onClick={clearCompare}>
            <Trash2 className="w-4 h-4 mr-1.5" />
            {t('compare.clearAll')}
          </Button>
        </div>
      </motion.div>

      <div className="w-full max-w-full overflow-x-auto bg-card border border-border rounded-xl">
        <table className="w-full min-w-max text-sm">
          <thead>
            <tr>
              <th className="whitespace-nowrap text-left p-3 text-muted-foreground font-medium w-28 border-b border-border">
                {t('compare.dim.dim')}
              </th>
              {breeds.map((b) => (
                <th key={b!.id} className="whitespace-nowrap p-3 text-left border-b border-l border-border min-w-[200px]">
                  <div className="flex items-start gap-2">
                    <div className="aspect-[4/3] w-20 rounded overflow-hidden bg-muted shrink-0">
                      <img
                        src={b!.image}
                        alt={b!.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="font-semibold text-foreground truncate">{b!.name}</p>
                      <span
                        className="inline-block mt-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: categoryColors[b!.category] }}
                      >
                        {b!.category}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeFromCompare(b!.id)}
                      className="shrink-0 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dimensions.map((dim) => (
              <tr key={dim.key} className="align-top">
                <td className="whitespace-nowrap p-3 text-muted-foreground font-medium border-b border-border">
                  {dim.label}
                </td>
                {breeds.map((b) => (
                  <td key={b!.id} className="p-3 border-b border-l border-border">
                    {dim.key === 'endangered' ? (
                      <span
                        className="inline-block px-1.5 py-0.5 rounded-full text-[10px] font-medium text-white"
                        style={{ backgroundColor: endangeredColors[b!.endangered] }}
                      >
                        {b!.endangered}
                      </span>
                    ) : dim.key === 'name' ? (
                      <span className="font-medium text-foreground">{b!.name}</span>
                    ) : dim.key === 'province' ? (
                      <span className="text-foreground">{b!.province}</span>
                    ) : (
                      <p className="text-foreground/90 leading-relaxed text-pretty max-w-[260px]">
                        {b![dim.key as 'appearance' | 'performance' | 'story']}
                      </p>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-4">
        <Button variant="ghost" onClick={() => navigate('/encyclopedia')}>
          {t('compare.continue')}
        </Button>
      </div>
    </div>
  );
};

export default ComparePage;