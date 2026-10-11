// =========================================================
// COMMAND PATTERN: undo / redo
// Every user action is a command object with execute(store),
// undo(store) and a human-readable label. The history keeps
// two stacks; the undo stack is capped at 20 actions.
// =========================================================

export const HISTORY_LIMIT = 20;

export class CommandHistory {
  #undoStack = [];
  #redoStack = [];
  #listeners = new Set();
  #limit;

  constructor(limit = HISTORY_LIMIT) {
    this.#limit = limit;
  }

  /** Runs a NEW action. Any redoable future is discarded, and the oldest action drops off past the limit. */
  execute(command, store) {
    command.execute(store);
    this.#undoStack.push(command);
    if (this.#undoStack.length > this.#limit) this.#undoStack.shift();
    this.#redoStack = [];
    this.#emit();
  }

  undo(store) {
    const command = this.#undoStack.pop();
    if (!command) return null;
    command.undo(store);
    this.#redoStack.push(command);
    this.#emit();
    return command;
  }

  redo(store) {
    const command = this.#redoStack.pop();
    if (!command) return null;
    command.execute(store);
    this.#undoStack.push(command);
    this.#emit();
    return command;
  }

  get canUndo() {
    return this.#undoStack.length > 0;
  }

  get canRedo() {
    return this.#redoStack.length > 0;
  }

  get limit() {
    return this.#limit;
  }

  /** Labels oldest to newest. `undone` lists the next redo first. */
  snapshot() {
    return {
      done: this.#undoStack.map((command) => command.label),
      undone: [...this.#redoStack].reverse().map((command) => command.label),
      limit: this.#limit,
    };
  }

  subscribe(listener) {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit() {
    this.#listeners.forEach((listener) => listener());
  }
}
