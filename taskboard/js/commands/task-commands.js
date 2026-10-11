// Each command knows how to do AND undo one kind of change.
// They only talk to the store (immutable updates), never the DOM.

const quote = (title) =>
  `\u201C${title.length > 28 ? `${title.slice(0, 27)}\u2026` : title}\u201D`;

function moveItem(list, from, to) {
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export class AddTaskCommand {
  constructor(task) {
    this.task = task;
    this.label = `Add ${quote(task.title)}`;
  }
  execute(store) {
    store.setTasks([this.task, ...store.getTasks()]);
  }
  undo(store) {
    store.setTasks(store.getTasks().filter((task) => task.id !== this.task.id));
  }
}

/** One undo step for many tasks (used by "Load sample tasks"). */
export class AddManyCommand {
  constructor(tasks, label) {
    this.tasks = tasks;
    this.label = label;
  }
  execute(store) {
    store.setTasks([...this.tasks, ...store.getTasks()]);
  }
  undo(store) {
    const ids = new Set(this.tasks.map((task) => task.id));
    store.setTasks(store.getTasks().filter((task) => !ids.has(task.id)));
  }
}

export class UpdateTaskCommand {
  constructor(before, changes) {
    this.before = before;
    this.after = { ...before, ...changes };
    this.label = `Edit ${quote(before.title)}`;
  }
  #replace(store, task) {
    store.setTasks(
      store.getTasks().map((item) => (item.id === task.id ? task : item)),
    );
  }
  execute(store) {
    this.#replace(store, this.after);
  }
  undo(store) {
    this.#replace(store, this.before);
  }
}

export class ToggleTaskCommand {
  constructor(task) {
    this.id = task.id;
    this.completed = !task.completed;
    this.label = `${this.completed ? "Complete" : "Reopen"} ${quote(task.title)}`;
  }
  #set(store, completed) {
    store.setTasks(
      store
        .getTasks()
        .map((task) => (task.id === this.id ? { ...task, completed } : task)),
    );
  }
  execute(store) {
    this.#set(store, this.completed);
  }
  undo(store) {
    this.#set(store, !this.completed);
  }
}

export class DeleteTaskCommand {
  constructor(task, index) {
    this.task = task;
    this.index = index;
    this.label = `Delete ${quote(task.title)}`;
  }
  execute(store) {
    store.setTasks(store.getTasks().filter((task) => task.id !== this.task.id));
  }
  undo(store) {
    const next = [...store.getTasks()];
    next.splice(this.index, 0, this.task);
    store.setTasks(next);
  }
}

export class ClearCompletedCommand {
  constructor(tasks) {
    // Remember each removed task with its original position so undo restores the exact order.
    this.removed = tasks
      .map((task, index) => ({ task, index }))
      .filter(({ task }) => task.completed);
    this.label = `Clear ${this.removed.length} completed`;
  }
  execute(store) {
    const ids = new Set(this.removed.map(({ task }) => task.id));
    store.setTasks(store.getTasks().filter((task) => !ids.has(task.id)));
  }
  undo(store) {
    const next = [...store.getTasks()];
    // Ascending order: each earlier insert keeps later original indexes correct.
    this.removed.forEach(({ task, index }) => next.splice(index, 0, task));
    store.setTasks(next);
  }
}

export class ReorderTaskCommand {
  constructor(title, from, to) {
    this.from = from;
    this.to = to;
    this.label = `Move ${quote(title)}`;
  }

  /**
   * Builds a command from a drop target: "put task `id` before/after task `targetId`".
   * Indexes refer to the FULL list, so reordering still works while filters hide some tasks.
   * Returns null when the move would not change anything.
   */
  static fromDrop(tasks, id, targetId, position) {
    const from = tasks.findIndex((task) => task.id === id);
    let to = tasks.findIndex((task) => task.id === targetId);
    if (from === -1 || to === -1) return null;
    if (position === "after") to += 1;
    if (from < to) to -= 1; // the dragged item leaves its slot first
    return from === to
      ? null
      : new ReorderTaskCommand(tasks[from].title, from, to);
  }

  execute(store) {
    store.setTasks(moveItem(store.getTasks(), this.from, this.to));
  }
  undo(store) {
    store.setTasks(moveItem(store.getTasks(), this.to, this.from));
  }
}
