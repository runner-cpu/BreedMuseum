/**
 * 互动厅装置清单（总览页与子页面共用同一份定义，避免标题/描述两处漂移）。
 */
export interface ArcadeGame {
  /** 子路由片段：`/arcade/<id>` */
  id: 'find-home' | 'identify' | 'quiz';
  title: string;
  /** 一局题量说明 */
  rounds: string;
  /** 练什么 */
  skill: string;
  summary: string;
}

export const ARCADE_GAMES: readonly ArcadeGame[] = [
  {
    id: 'find-home',
    title: '找家挑战',
    rounds: '三题一局',
    skill: '练地理分布',
    summary: '给出品种卡，在光图上点出它的家乡省份；点错会告诉你差多少公里。',
  },
  {
    id: 'identify',
    title: '识图挑战',
    rounds: '六题一局',
    skill: '练类别识别',
    summary: '看类别剪影选出它属于哪一类，答完给出该类别的三个真实品种。',
  },
  {
    id: 'quiz',
    title: '知识问答',
    rounds: '五题一局',
    skill: '练名录常识',
    summary: '随机考省份、类别、国家级保护身份与濒危口径，每题都能进档案核对。',
  },
] as const;

export type ArcadeGameId = (typeof ARCADE_GAMES)[number]['id'];

export const arcadeGameById = (id: string | undefined): ArcadeGame | null =>
  ARCADE_GAMES.find((game) => game.id === id) ?? null;
