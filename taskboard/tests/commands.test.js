import test from "node:test";
import assert from "node:assert/strict";
import { createStore } from "../js/state/store.js";
import { CommandHistory, HISTORY_LIMIT } from "../js/commands/history.js";
import {
  AddTaskCommand,
  UpdateTaskCommand,
  ToggleTaskCommand,
  DeleteTaskCommand,
  ClearCompletedCommand,
  ReorderTaskCommand,
} from "../js/commands/task-commands.js";
import { createTask } from "../js/models/task.js";

const make = (title, extra = {}) => createTask({ title, ...extra });
const titles = (store) => store.getTasks().map((t) => t.title);

test("history is capped at 20 actions", () => {
  const store = createStore([]);
  const history = new CommandHistory();
  assert.equal(HISTORY_LIMIT, 20);
  for (let i = 1; i <= 25; i += 1)
    history.execute(new AddTaskCommand(make(`Task ${i}`)), store);
  assert.equal(store.getTasks().length, 25);
  assert.equal(history.snapshot().done.length, 20);
  // Only the 20 newest can be undone; the 5 oldest adds stay.
  for (let i = 0; i < 30; i += 1) history.undo(store);
  assert.equal(store.getTasks().length, 5);
  assert.equal(history.canUndo, false);
});

test("a new action clears the redo stack", () => {
  const store = createStore([]);
  const history = new CommandHistory();
  history.execute(new AddTaskCommand(make("A")), store);
  history.execute(new AddTaskCommand(make("B")), store);
  history.undo(store);
  assert.equal(history.canRedo, true);
  history.execute(new AddTaskCommand(make("C")), store);
  assert.equal(history.canRedo, false);
  assert.deepEqual(titles(store).sort(), ["A", "C"]);
});

test("undo then redo restores the exact same state", () => {
  const store = createStore([]);
  const history = new CommandHistory();
  history.execute(new AddTaskCommand(make("A")), store);
  const before = store.getTasks();
  history.undo(store);
  assert.equal(store.getTasks().length, 0);
  history.redo(store);
  assert.deepEqual(store.getTasks(), before);
});

test("update, toggle and delete are all reversible", () => {
  const a = make("A");
  const store = createStore([a, make("B")]);
  const history = new CommandHistory();
  const snapshot = JSON.stringify(store.getTasks());

  history.execute(
    new UpdateTaskCommand(a, { title: "A2", priority: "high" }),
    store,
  );
  history.execute(new ToggleTaskCommand(store.getTasks()[0]), store);
  history.execute(new DeleteTaskCommand(store.getTasks()[0], 0), store);
  assert.deepEqual(titles(store), ["B"]);

  history.undo(store);
  history.undo(store);
  history.undo(store);
  assert.equal(JSON.stringify(store.getTasks()), snapshot);
});

test("reorder: drop before/after maps to the right indexes and undoes", () => {
  const [a, b, c, d] = ["A", "B", "C", "D"].map((t) => make(t));
  const store = createStore([a, b, c, d]);
  const history = new CommandHistory();

  history.execute(
    ReorderTaskCommand.fromDrop(store.getTasks(), a.id, c.id, "after"),
    store,
  );
  assert.deepEqual(titles(store), ["B", "C", "A", "D"]);
  history.execute(
    ReorderTaskCommand.fromDrop(store.getTasks(), d.id, b.id, "before"),
    store,
  );
  assert.deepEqual(titles(store), ["D", "B", "C", "A"]);

  history.undo(store);
  assert.deepEqual(titles(store), ["B", "C", "A", "D"]);
  history.undo(store);
  assert.deepEqual(titles(store), ["A", "B", "C", "D"]);
});

test("reorder returns null when nothing would change", () => {
  const [a, b] = ["A", "B"].map((t) => make(t));
  assert.equal(ReorderTaskCommand.fromDrop([a, b], a.id, b.id, "before"), null);
  assert.equal(ReorderTaskCommand.fromDrop([a, b], a.id, a.id, "after"), null);
  assert.equal(
    ReorderTaskCommand.fromDrop([a, b], "missing", b.id, "after"),
    null,
  );
});

test("clear completed restores tasks at their original positions", () => {
  const list = [
    make("A"),
    make("B", { completed: true }),
    make("C"),
    make("D", { completed: true }),
  ];
  const store = createStore(list);
  const history = new CommandHistory();
  history.execute(new ClearCompletedCommand(store.getTasks()), store);
  assert.deepEqual(titles(store), ["A", "C"]);
  history.undo(store);
  assert.deepEqual(titles(store), ["A", "B", "C", "D"]);
});
