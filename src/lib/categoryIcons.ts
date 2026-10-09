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
