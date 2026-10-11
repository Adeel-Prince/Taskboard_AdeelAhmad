import { createId } from "../utils/id.js";

export const PRIORITIES = ["high", "medium", "low"];
export const MAX_TITLE = 120;
export const MAX_NOTES = 400;

/** Builds a new, valid task. */
export function createTask({
  title,
  notes = "",
  priority = "medium",
  dueDate = null,
  completed = false,
  createdAt = Date.now(),
}) {
  return {
    id: createId(),
    title: title.trim().slice(0, MAX_TITLE),
    notes: notes.trim().slice(0, MAX_NOTES),
    priority: PRIORITIES.includes(priority) ? priority : "medium",
    completed: Boolean(completed),
    dueDate: dueDate || null,
    createdAt,
  };
}

/**
 * Validates data read from localStorage. Anything unusable returns null and is dropped,
 * so a hand-edited or corrupted entry can never crash the app.
 */
export function sanitizeTask(raw) {
  if (!raw || typeof raw !== "object") return null;
  if (typeof raw.title !== "string" || !raw.title.trim()) return null;
  return {
    id: String(raw.id ?? createId()),
    title: raw.title.trim().slice(0, MAX_TITLE),
    notes: typeof raw.notes === "string" ? raw.notes.slice(0, MAX_NOTES) : "",
    priority: PRIORITIES.includes(raw.priority) ? raw.priority : "medium",
    completed: Boolean(raw.completed),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(raw.dueDate ?? "") ? raw.dueDate : null,
    createdAt: Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now(),
  };
}
