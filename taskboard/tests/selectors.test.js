import test from "node:test";
import assert from "node:assert/strict";
import {
  getVisibleTasks,
  getCounts,
  matchesQuery,
} from "../js/state/selectors.js";
import {
  parseView,
  serializeView,
  DEFAULT_VIEW,
} from "../js/utils/url-state.js";
import { splitByQuery } from "../js/utils/highlight.js";
import { debounce } from "../js/utils/debounce.js";
import { describeDue } from "../js/utils/dates.js";

const T = (title, extra = {}) => ({
  id: title,
  title,
  notes: "",
  priority: "medium",
  completed: false,
  dueDate: null,
  createdAt: 1,
  ...extra,
});
const view = (patch = {}) => ({ ...DEFAULT_VIEW, ...patch });
const names = (tasks) => tasks.map((t) => t.title);

const sample = [
  T("Write report", { priority: "high", dueDate: "2026-10-12", createdAt: 3 }),
  T("Review notes", {
    priority: "low",
    completed: true,
    createdAt: 1,
    notes: "array methods",
  }),
  T("alpha task", { priority: "medium", dueDate: "2026-10-10", createdAt: 2 }),
  T("Zeta task", { priority: "high", createdAt: 4 }),
];

test("status and priority filters", () => {
  assert.deepEqual(
    names(getVisibleTasks(sample, view({ status: "completed" }))),
    ["Review notes"],
  );
  assert.equal(getVisibleTasks(sample, view({ status: "active" })).length, 3);
  assert.deepEqual(names(getVisibleTasks(sample, view({ priority: "high" }))), [
    "Write report",
    "Zeta task",
  ]);
});

test("search matches title and notes, case-insensitively", () => {
  assert.deepEqual(names(getVisibleTasks(sample, view({ q: "REPORT" }))), [
    "Write report",
  ]);
  assert.deepEqual(names(getVisibleTasks(sample, view({ q: "array" }))), [
    "Review notes",
  ]);
  assert.equal(matchesQuery(sample[0], "   "), true);
});

test("sorting by title, priority, created and due", () => {
  assert.deepEqual(names(getVisibleTasks(sample, view({ sort: "title" }))), [
    "alpha task",
    "Review notes",
    "Write report",
    "Zeta task",
  ]);
  assert.deepEqual(
    names(getVisibleTasks(sample, view({ sort: "title", dir: "desc" }))),
    ["Zeta task", "Write report", "Review notes", "alpha task"],
  );
  assert.equal(
    getVisibleTasks(sample, view({ sort: "priority" }))[3].priority,
    "low",
  );
  assert.deepEqual(names(getVisibleTasks(sample, view({ sort: "created" }))), [
    "Review notes",
    "alpha task",
    "Write report",
    "Zeta task",
  ]);
});

test("due sort puts tasks without a date last in both directions", () => {
  const asc = names(getVisibleTasks(sample, view({ sort: "due" })));
  const desc = names(
    getVisibleTasks(sample, view({ sort: "due", dir: "desc" })),
  );
  assert.deepEqual(asc.slice(0, 2), ["alpha task", "Write report"]);
  assert.deepEqual(desc.slice(0, 2), ["Write report", "alpha task"]);
  assert.deepEqual(
    [asc.at(-1), desc.at(-1)].every((n) =>
      ["Review notes", "Zeta task"].includes(n),
    ),
    true,
  );
});

test("manual order keeps the stored order", () => {
  assert.deepEqual(names(getVisibleTasks(sample, view())), names(sample));
});

test("counts", () => {
  assert.deepEqual(getCounts(sample), { total: 4, done: 1, open: 3 });
});

test("URL state: parse, validate and serialize", () => {
  assert.deepEqual(
    parseView("?status=active&priority=high&sort=due&dir=desc&q=report"),
    {
      status: "active",
      priority: "high",
      sort: "due",
      dir: "desc",
      q: "report",
    },
  );
  assert.deepEqual(
    parseView("?status=hacked&sort=<script>&dir=up"),
    DEFAULT_VIEW,
  );
  assert.equal(serializeView(DEFAULT_VIEW), "");
  assert.equal(
    serializeView(view({ status: "completed", q: "a b" })),
    "?status=completed&q=a+b",
  );
  const round = view({ priority: "low", sort: "title", dir: "desc", q: "x" });
  assert.deepEqual(parseView(serializeView(round)), round);
});

test("highlight splitting handles case, special characters and empty queries", () => {
  assert.deepEqual(splitByQuery("Write report", "REP"), [
    { text: "Write ", match: false },
    { text: "rep", match: true },
    { text: "ort", match: false },
  ]);
  assert.deepEqual(splitByQuery("Price (v2.0)?", "(v2.0)?"), [
    { text: "Price ", match: false },
    { text: "(v2.0)?", match: true },
  ]);
  assert.deepEqual(splitByQuery("abc", ""), [{ text: "abc", match: false }]);
  assert.equal(splitByQuery("a.b a.b", "a.b").filter((s) => s.match).length, 2);
  assert.equal(
    splitByQuery("axb", "a.b").some((s) => s.match),
    false,
  );
});

test("debounce runs once, after the last call", async () => {
  let calls = [];
  const fn = debounce((v) => calls.push(v), 30);
  fn("a");
  fn("ab");
  fn("abc");
  assert.deepEqual(calls, []);
  await new Promise((r) => setTimeout(r, 60));
  assert.deepEqual(calls, ["abc"]);
});

test("due descriptions", () => {
  const now = new Date(2026, 9, 10, 15, 0);
  assert.equal(describeDue("2026-10-10", now).when, "Today");
  assert.equal(describeDue("2026-10-11", now).when, "Tomorrow");
  assert.deepEqual(describeDue("2026-10-07", now), {
    when: "7 Oct",
    note: "3 days late",
    overdue: true,
    empty: false,
  });
  assert.equal(describeDue(null, now).empty, true);
});
