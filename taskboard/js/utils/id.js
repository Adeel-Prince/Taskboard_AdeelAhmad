/** Unique id. Uses crypto.randomUUID when available (secure contexts), with a fallback. */
export function createId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `t_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
}
