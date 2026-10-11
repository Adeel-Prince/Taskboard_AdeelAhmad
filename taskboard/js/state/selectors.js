// Pure functions: (tasks, view) -> what should be visible.
// No DOM, no storage, so they are trivial to unit test.

const PRIORITY_RANK = { high: 0, medium: 1, low: 2 };

export function matchesQuery(task, query) {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return (
    task.title.toLowerCase().includes(needle) ||
    task.notes.toLowerCase().includes(needle)
  );
}

export function applyFilters(tasks, view) {
  return tasks.filter((task) => {
    if (view.status === "active" && task.completed) return false;
    if (view.status === "completed" && !task.completed) return false;
    if (view.priority !== "all" && task.priority !== view.priority)
      return false;
    return matchesQuery(task, view.q);
  });
}

const compareText = (a, b) =>
  a.localeCompare(b, undefined, { sensitivity: "base" });

export function applySort(tasks, view) {
  // Manual order is simply the order of the stored array.
  if (view.sort === "manual") return tasks;
  const sign = view.dir === "desc" ? -1 : 1;

  const comparators = {
    created: (a, b) => sign * (a.createdAt - b.createdAt),
    priority: (a, b) =>
      sign * (PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]),
    title: (a, b) => sign * compareText(a.title, b.title),
    // Tasks without a due date always go last, whichever direction is chosen.
    due: (a, b) => {
      if (!a.dueDate && !b.dueDate) return 0;
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return (
        sign * (a.dueDate < b.dueDate ? -1 : a.dueDate > b.dueDate ? 1 : 0)
      );
    },
  };

  return [...tasks].sort(comparators[view.sort]);
}

export const getVisibleTasks = (tasks, view) =>
  applySort(applyFilters(tasks, view), view);

export function getCounts(tasks) {
  const done = tasks.filter((task) => task.completed).length;
  return { total: tasks.length, done, open: tasks.length - done };
}
