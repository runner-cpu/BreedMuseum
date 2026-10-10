import { describe, expect, test } from 'vitest';
import { breeds } from '@/data/breeds';
import { getBreedMetadata } from '@/data/breedMetadata';
import { hasMappableLocation } from '@/lib/geo3d/lightMapData';
import {
  generateFindHomeRounds,
  generateQuiz,
  haversineKm,
  PROVINCE_CENTROIDS,
  type QuizQuestion,
} from '../quizGenerator';

/**
 * 互动厅出题契约：
 * - 同一种子完全可复现；
 * - 待核验记录（哨兵坐标 / “待核验”省份）绝不进入题干或选项；
 * - 正确答案必定存在于选项里，且选项互不重复；
 * - 找家挑战的答案坐标可用于距离提示。
 */

const unverifiedIds = new Set(
  breeds
    .filter((breed) => !hasMappableLocation(breed))
    .map((breed) => breed.id),
);

const unverifiedNames = new Set(
  breeds.filter((breed) => !hasMappableLocation(breed)).map((breed) => breed.name),
);

const assertClean = (questions: QuizQuestion[]) => {
  for (const question of questions) {
    expect(question.options).toHaveLength(4);
    const ids = question.options.map((option) => option.id);
    expect(new Set(ids).size).toBe(4);
    expect(ids, question.prompt).toContain(question.answerId);
    expect(unverifiedIds.has(question.subject.id), question.prompt + ' 主题为待核验记录').toBe(false);
    for (const option of question.options) {
      expect(unverifiedNames.has(option.label), option.label + ' 为待核验记录').toBe(false);
      expect(option.label).not.toBe('待核验');
    }
    // 题干中不得出现“待核验”字样
    expect(question.prompt).not.toContain('待核验');
  }
};

describe('quiz generator', () => {
  test('questions are reproducible for the same seed', () => {
    const first = generateQuiz(20261009, 5);
    const second = generateQuiz(20261009, 5);
    expect(first).toEqual(second);
    const other = generateQuiz(20261010, 5);
    expect(other).not.toEqual(first);
  });

  test('rotate through all four question kinds and stay clean', () => {
    const questions = generateQuiz(42, 8);
    const kinds = new Set(questions.map((question) => question.kind));
    expect(kinds).toEqual(new Set(['category', 'province', 'protection', 'silhouette']));
    assertClean(questions);
  });

  test('protection questions always answer with a 940-listed breed', () => {
    const questions = generateQuiz(7, 12).filter((question) => question.kind === 'protection');
    expect(questions.length).toBeGreaterThan(0);
    for (const question of questions) {
      const answer = breeds.find((breed) => breed.id === question.answerId)!;
      expect(getBreedMetadata(answer).protectionStatus).toBe('national-list');
    }
  });

  test('province questions never target the pending bucket', () => {
    const questions = generateQuiz(99, 16).filter((question) => question.kind === 'province');
    for (const question of questions) {
      expect(question.answerId).not.toBe('待核验');
      // 正确答案必须是该品种真实省份
      const answer = breeds.find((breed) => breed.id === question.subject.id)!;
      expect(question.answerId).toBe(answer.province);
    }
  });

  test('repeated generation never leaks pending records across many seeds', () => {
    for (let seed = 1; seed <= 60; seed += 1) {
      assertClean(generateQuiz(seed, 6));
    }
  });
});

describe('find-home rounds', () => {
  test('rounds come with verified provinces and coordinates', () => {
    const rounds = generateFindHomeRounds(2026, 3);
    expect(rounds).toHaveLength(3);
    const ids = new Set(rounds.map((round) => round.breed.id));
    expect(ids.size).toBe(3);
    for (const round of rounds) {
      expect(round.answerProvince).not.toBe('待核验');
      const breed = breeds.find((item) => item.id === round.breed.id)!;
      expect(hasMappableLocation(breed)).toBe(true);
      expect(round.answerCoordinate).toEqual([breed.longitude, breed.latitude]);
    }
  });

  test('rounds are reproducible per seed', () => {
    expect(generateFindHomeRounds(5, 3)).toEqual(generateFindHomeRounds(5, 3));
    expect(generateFindHomeRounds(5, 3)).not.toEqual(generateFindHomeRounds(6, 3));
  });
});

describe('distance feedback', () => {
  test('haversine returns 0 for identical points and known city distances', () => {
    expect(haversineKm([116.4, 39.9], [116.4, 39.9])).toBe(0);
    const beijingToShanghai = haversineKm([116.4, 39.9], [121.5, 31.2]);
    expect(beijingToShanghai).toBeGreaterThan(1000);
    expect(beijingToShanghai).toBeLessThan(1200);
  });

  test('every province with records has a centroid for the distance hint', () => {
    const provinces = new Set(
      breeds.filter(hasMappableLocation).map((breed) => breed.province),
    );
    for (const province of provinces) {
      expect(PROVINCE_CENTROIDS[province], province + ' 缺少中心点').toBeDefined();
    }
  });
});
