import { createId } from "../utils/id.js";

// =========================================================
// SCHEMA MIGRATIONS
// Saved data is versioned. Each migration upgrades the shape by
// exactly ONE version, and they are chained until the data reaches
// CURRENT_VERSION. Old saves therefore keep working after the app
// changes shape.
//
//   v1  bare array:   [{ id, text, done }]
//   v2  wrapped:      { version: 2, tasks: [{ id, title, completed, createdAt }] }
//   v3  current:      { version: 3, tasks: [{ ..., notes, priority, dueDate }] }
// =========================================================

export const CURRENT_VERSION = 3;
export const migrations = {
  // v1 -> v2: rename text/done, add createdAt, wrap in an object with a version.
  1: (data) => ({
    version: 2,
    tasks: data.map((item, index) => ({
      id: String(item.id ?? createId()),
      title: item.text ?? "",
      completed: Boolean(item.done),
      createdAt: item.createdAt ?? Date.now() + index,
    })),
  }),

  // v2 -> v3: add notes, priority and dueDate with safe defaults.
  2: (data) => ({
    version: 3,
    tasks: data.tasks.map((task) => ({
      notes: "",
      priority: "medium",
      dueDate: null,
      ...task,
    })),
  }),
};

/** Works out which schema version a parsed payload is. 0 means "not recognised". */
export function detectVersion(raw) {
  if (Array.isArray(raw)) return 1;
  if (raw && typeof raw === "object" && Number.isInteger(raw.version))
    return raw.version;
  return 0;
}

/**
 * Upgrades any supported payload to the current schema.
 * Returns { data, from, to, migrated }. Throws for unknown or future versions.
 */
export function migrate(raw) {
  const from = detectVersion(raw);
  if (from < 1 || from > CURRENT_VERSION) {
    throw new Error(`Unsupported schema version: ${from || "unknown"}`);
  }
  const steps = Array.from(
    { length: CURRENT_VERSION - from },
    (_, i) => from + i,
  );
  const data = steps.reduce(
    (current, version) => migrations[version](current),
    raw,
  );
  return { data, from, to: CURRENT_VERSION, migrated: steps.length > 0 };
}
