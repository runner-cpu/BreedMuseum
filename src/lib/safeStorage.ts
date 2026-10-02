/** Read a validated value from browser storage without making storage a hard dependency. */
export function readStoredEnum<const T extends readonly string[]>(
  key: string,
  allowed: T,
  fallback: T[number],
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): T[number] {
  try {
    const value = storage?.getItem(key);
    return value && (allowed as readonly string[]).includes(value) ? (value as T[number]) : fallback;
  } catch {
    return fallback;
  }
}

export function writeStoredValue(
  key: string,
  value: string,
  storage: Storage | undefined = typeof window === 'undefined' ? undefined : window.localStorage,
): void {
  try {
    storage?.setItem(key, value);
  } catch {
    // Private browsing and strict enterprise policies may deny storage.
  }
}
