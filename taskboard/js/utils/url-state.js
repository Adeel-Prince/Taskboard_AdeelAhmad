// =========================================================
// URL <-> view state. Filters, sort and search live in the
// query string, so a refresh, a bookmark or the Back button
// all restore exactly the same view.
// =========================================================

export const STATUS_VALUES = ["all", "active", "completed"];
export const PRIORITY_FILTERS = ["all", "high", "medium", "low"];
export const SORT_VALUES = ["manual", "created", "due", "priority", "title"];
export const DIR_VALUES = ["asc", "desc"];

export const DEFAULT_VIEW = Object.freeze({
  status: "all",
  priority: "all",
  sort: "manual",
  dir: "asc",
  q: "",
});

const pick = (value, allowed, fallback) =>
  allowed.includes(value) ? value : fallback;

/** Reads a query string and returns a valid view. Unknown or tampered values fall back to defaults. */
export function parseView(search) {
  const params = new URLSearchParams(search);
  return {
    status: pick(params.get("status"), STATUS_VALUES, DEFAULT_VIEW.status),
    priority: pick(
      params.get("priority"),
      PRIORITY_FILTERS,
      DEFAULT_VIEW.priority,
    ),
    sort: pick(params.get("sort"), SORT_VALUES, DEFAULT_VIEW.sort),
    dir: pick(params.get("dir"), DIR_VALUES, DEFAULT_VIEW.dir),
    q: (params.get("q") ?? "").trim().slice(0, 80),
  };
}

/** Only non-default values are written, which keeps the URL short. */
export function serializeView(view) {
  const params = new URLSearchParams();
  Object.entries(view).forEach(([key, value]) => {
    if (value !== DEFAULT_VIEW[key]) params.set(key, value);
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

/** pushState for deliberate changes (Back button works), replaceState for typing. */
export function writeView(view, { replace = false } = {}) {
  const next = `${location.pathname}${serializeView(view)}`;
  if (next === `${location.pathname}${location.search}`) return;
  history[replace ? "replaceState" : "pushState"](null, "", next);
}
