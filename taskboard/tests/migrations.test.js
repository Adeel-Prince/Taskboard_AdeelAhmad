import test from "node:test";
import assert from "node:assert/strict";
import {
  CURRENT_VERSION,
  detectVersion,
  migrate,
} from "../js/state/migrations.js";
import {
  loadTasks,
  saveTasks,
  STORAGE_KEY,
  BACKUP_KEY,
} from "../js/state/storage.js";

// A tiny in-memory stand-in for localStorage.
const fakeStorage = (initial = {}) => {
  const data = { ...initial };
  return {
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = String(value);
    },
    removeItem: (key) => {
      delete data[key];
    },
    dump: () => data,
  };
};

test("detects schema versions", () => {
  assert.equal(detectVersion([{ id: 1, text: "a", done: false }]), 1);
  assert.equal(detectVersion({ version: 2, tasks: [] }), 2);
  assert.equal(detectVersion({ nope: true }), 0);
  assert.equal(detectVersion(null), 0);
});

test("v1 -> v3 renames fields and fills new ones with defaults", () => {
  const { data, from, to, migrated } = migrate([
    { id: 7, text: "Write tests", done: true },
  ]);
  assert.deepEqual([from, to, migrated], [1, CURRENT_VERSION, true]);
  assert.equal(data.version, 3);
  const [task] = data.tasks;
  assert.equal(task.id, "7");
  assert.equal(task.title, "Write tests");
  assert.equal(task.completed, true);
  assert.equal(task.priority, "medium");
  assert.equal(task.dueDate, null);
  assert.equal(task.notes, "");
});

test("v2 -> v3 keeps existing fields and adds defaults", () => {
  const { data } = migrate({
    version: 2,
    tasks: [{ id: "a", title: "T", completed: false, createdAt: 5 }],
  });
  assert.equal(data.tasks[0].createdAt, 5);
  assert.equal(data.tasks[0].priority, "medium");
});

test("current version is returned untouched", () => {
  const payload = { version: CURRENT_VERSION, tasks: [] };
  const result = migrate(payload);
  assert.equal(result.migrated, false);
  assert.equal(result.data, payload);
});

test("unknown and future versions are rejected", () => {
  assert.throws(
    () => migrate({ version: 99, tasks: [] }),
    /Unsupported schema version/,
  );
  assert.throws(() => migrate("garbage"), /Unsupported schema version/);
});

test("loadTasks migrates v1 storage, saves v3 and keeps a backup of the original", () => {
  const original = JSON.stringify([{ id: 1, text: "Old task", done: false }]);
  const storage = fakeStorage({ [STORAGE_KEY]: original });
  const result = loadTasks(storage);
  assert.equal(result.status, "migrated");
  assert.equal(result.tasks.length, 1);
  assert.equal(storage.getItem(BACKUP_KEY), original);
  assert.equal(
    JSON.parse(storage.getItem(STORAGE_KEY)).version,
    CURRENT_VERSION,
  );
});

test("loadTasks recovers from corrupt JSON without throwing", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: "{not json" });
  const result = loadTasks(storage);
  assert.equal(result.status, "recovered");
  assert.deepEqual(result.tasks, []);
  assert.equal(storage.getItem(BACKUP_KEY), "{not json");
});

test("loadTasks drops invalid task entries", () => {
  const storage = fakeStorage();
  storage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      version: 3,
      tasks: [{ id: "a", title: "Good" }, { id: "b", title: "" }, null, 5],
    }),
  );
  assert.deepEqual(
    loadTasks(storage).tasks.map((t) => t.title),
    ["Good"],
  );
});

test("saveTasks writes the current version and reports failure", () => {
  const storage = fakeStorage();
  assert.equal(saveTasks([], storage), true);
  assert.equal(
    JSON.parse(storage.getItem(STORAGE_KEY)).version,
    CURRENT_VERSION,
  );
  const full = {
    setItem() {
      throw new Error("quota");
    },
  };
  assert.equal(saveTasks([], full), false);
});
