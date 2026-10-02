/** Never render provider response bodies, URLs or credentials in the UI. */
export function safeAiErrorMessage(_error: unknown, fallback = 'AI service request failed. Please try again.'): string {
  return fallback;
}
