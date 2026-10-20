import { Bird, Circle, Dna, Fish, Rabbit, type LucideIcon } from 'lucide-react';

export const categoryIcons: Record<string, LucideIcon> = {
  猪: Circle,
  牛: Circle,
  羊: Circle,
  鸡: Bird,
  鸭: Bird,
  马: Rabbit,
  驴: Rabbit,
  骆驼: Circle,
  兔: Rabbit,
  鹅: Bird,
  鸽: Bird,
  鹿: Circle,
  蜂: Fish,
  特种畜禽: Dna,
  其他: Dna,
};

export const categoryColors: Record<string, string> = {
  猪: '#FF6B81',
  牛: '#4A90D9',
  羊: '#27AE60',
  鸡: '#F39C12',
  鸭: '#9B59B6',
  马: '#E74C3C',
  驴: '#B4795A',
  骆驼: '#8B4513',
  兔: '#FFB6C1',
  鹅: '#20B2AA',
  鸽: '#708090',
  鹿: '#C0873F',
  蜂: '#D4A017',
  特种畜禽: '#5F9EA0',
  其他: '#95A5A6',
};

export const endangeredColors: Record<string, string> = {
  普通: '#27ae60',
  易危: '#f39c12',
  濒危: '#e67e22',
  极危: '#c0392b',
  待核验: '#64748b',
};

/**
 * 在任意类别色块上挑一个读得清的前景色。
 *
 * 类别色板是 15 个饱和度各异的品牌色（兔 #FFB6C1、蜂 #D4A017、骆驼 #8B4513……），
 * 统一用白字时浅色块只有 1.3:1 左右。这里按相对亮度二选一：
 * 亮块配深墨绿、暗块配近白，两套主题下徽章文字都不会糊成一片。
 */
export const readableOn = (hex: string): string => {
  const value = hex.replace('#', '');
  if (value.length !== 6) return '#f7f3e8';
  const [r, g, b] = [0, 2, 4].map((offset) => {
    const channel = Number.parseInt(value.slice(offset, offset + 2), 16) / 255;
    return channel <= 0.03928 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.42 ? '#14251c' : '#f7f3e8';
};
