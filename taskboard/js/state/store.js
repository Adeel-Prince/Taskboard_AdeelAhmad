/**
 * Minimal observable store. It owns the task array and tells subscribers
 * (persistence + rendering) whenever it changes. Updates are always immutable:
 * commands pass in a NEW array, never mutate the old one.
 */
export function createStore(initialTasks = []) {
  let tasks = initialTasks;
  const listeners = new Set();

  return {
    getTasks: () => tasks,
    setTasks(next) {
      tasks = next;
      listeners.forEach((listener) => listener(tasks));
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
