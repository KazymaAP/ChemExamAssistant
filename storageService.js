/**
 * Безопасно читает JSON из localStorage.
 */
export function getParsed(key, fallback = null) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch (error) {
    console.warn(`[storage] read failed for ${key}`, error);
    return fallback;
  }
}

/**
 * Безопасно пишет JSON в localStorage.
 */
export function setParsed(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(`[storage] write failed for ${key}`, error);
    return false;
  }
}
