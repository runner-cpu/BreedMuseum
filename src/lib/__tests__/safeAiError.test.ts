import { describe, expect, it } from 'vitest';
import { safeAiErrorMessage } from '../safeAiError';

describe('safe AI error messages', () => {
  it('does not expose provider response bodies or keys', () => {
    expect(safeAiErrorMessage(new Error('401 provider secret=abc123'))).toBe('AI service request failed. Please try again.');
    expect(safeAiErrorMessage(new Error('network timeout'))).toBe('AI service request failed. Please try again.');
  });
});
