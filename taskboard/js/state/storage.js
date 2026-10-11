import { CURRENT_VERSION, migrate } from "./migrations.js";
import { sanitizeTask } from "../models/task.js";

export const STORAGE_KEY = "taskboard:data";
export const BACKUP_KEY = "taskboard:backup";

/**
 * Loads tasks from storage, migrating old formats on the way in.
 *   status "empty"     nothing saved yet
 *   status "ok"        current schema, loaded as-is
 *   status "migrated"  old schema upgraded (original kept under BACKUP_KEY)
 *   status "recovered" data was unreadable; original kept under BACKUP_KEY
 */
export function loadTasks(storage = localStorage) {
  const text = storage.getItem(STORAGE_KEY);
  if (text == null) return { tasks: [], status: "empty" };

  try {
    const { data, from, to, migrated } = migrate(JSON.parse(text));
    const tasks = data.tasks.map(sanitizeTask).filter(Boolean);
    if (migrated) {
      storage.setItem(BACKUP_KEY, text);
      saveTasks(tasks, storage);
    }
    return { tasks, status: migrated ? "migrated" : "ok", from, to };
  } catch (error) {
    storage.setItem(BACKUP_KEY, text);
    return { tasks: [], status: "recovered", error: error.message };
  }
}

/** Returns false if the browser refuses the write (quota exceeded, private mode). */
export function saveTasks(tasks, storage = localStorage) {
  try {
    storage.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: CURRENT_VERSION, tasks }),
    );
    return true;
  } catch {
    return false;
  }
}

/** Developer tool: writes a version-1 payload so the migration can be demonstrated. */
export const LEGACY_V1_SAMPLE = [
  { id: 1, text: "Write unit tests", done: true },
  { id: 2, text: "Review pull request", done: false },
  { id: 3, text: "Update the README", done: false },
  { id: 4, text: "Deploy to staging", done: false },
];

export function writeLegacySample(storage = localStorage) {
  storage.setItem(STORAGE_KEY, JSON.stringify(LEGACY_V1_SAMPLE));
}

export function resetStorage(storage = localStorage) {
  storage.removeItem(STORAGE_KEY);
  storage.removeItem(BACKUP_KEY);
}
