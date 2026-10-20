/**
 * 互动厅装置清单（总览页与子页面共用同一份定义，避免标题/描述两处漂移）。
 *
 * 这里只存**翻译键**而不是中文常量：总览、子页标题与切换器都要随语言切换，
 * 写死中文会让英文界面残留三张中文卡片。
 */
export interface ArcadeGame {
  /** 子路由片段：`/arcade/<id>` */
  id: 'find-home' | 'identify' | 'quiz';
  titleKey: string;
  /** 一局题量说明 */
  roundsKey: string;
  /** 练什么 */
  skillKey: string;
  summaryKey: string;
}

export const ARCADE_GAMES: readonly ArcadeGame[] = [
  {
    id: 'find-home',
    titleKey: 'arcade.findHome',
    roundsKey: 'arcade.findHomeRounds',
    skillKey: 'arcade.findHomeSkill',
    summaryKey: 'arcade.findHomeSummary',
  },
  {
    id: 'identify',
    titleKey: 'arcade.identify',
    roundsKey: 'arcade.identifyRounds',
    skillKey: 'arcade.identifySkill',
    summaryKey: 'arcade.identifySummary',
  },
  {
    id: 'quiz',
    titleKey: 'arcade.quiz',
    roundsKey: 'arcade.quizRounds',
    skillKey: 'arcade.quizSkill',
    summaryKey: 'arcade.quizSummary',
  },
] as const;

export type ArcadeGameId = (typeof ARCADE_GAMES)[number]['id'];

export const arcadeGameById = (id: string | undefined): ArcadeGame | null =>
  ARCADE_GAMES.find((game) => game.id === id) ?? null;
