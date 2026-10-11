// =========================================================
// MAIN: the only file that knows about everything.
// Data flow: user event -> command -> store -> (save + render).
// =========================================================

import { createStore } from "./state/store.js";
import {
  loadTasks,
  saveTasks,
  writeLegacySample,
  resetStorage,
} from "./state/storage.js";
import { getVisibleTasks, getCounts } from "./state/selectors.js";
import { CommandHistory } from "./commands/history.js";
import {
  AddTaskCommand,
  AddManyCommand,
  UpdateTaskCommand,
  ToggleTaskCommand,
  DeleteTaskCommand,
  ClearCompletedCommand,
  ReorderTaskCommand,
} from "./commands/task-commands.js";
import { createTask, MAX_TITLE, MAX_NOTES } from "./models/task.js";
import { buildSampleTasks } from "./data/sample-tasks.js";
import { parseView, writeView, DEFAULT_VIEW } from "./utils/url-state.js";
import { debounce } from "./utils/debounce.js";
import { h } from "./utils/dom.js";
import {
  renderTaskList,
  applySelection,
  renderEmpty,
  renderStats,
  renderHistory,
  syncControls,
} from "./ui/render.js";
import { initDragAndDrop } from "./ui/dragdrop.js";
import { initShortcuts, BINDINGS } from "./ui/shortcuts.js";
import { showToast } from "./ui/toast.js";

const $ = (id) => document.getElementById(id);
const refs = {
  list: $("task-list"),
  empty: $("empty-state"),
  stats: $("stats"),
  clearCompleted: $("clear-completed"),
  addForm: $("add-form"),
  addTitle: $("add-title"),
  addPriority: $("add-priority"),
  addDue: $("add-due"),
  search: $("search"),
  statusButtons: [...document.querySelectorAll("#status-filter button")],
  priorityFilter: $("priority-filter"),
  sortSelect: $("sort-select"),
  dirButton: $("dir-btn"),
  dragHint: $("drag-hint"),
  undoBtn: $("undo-btn"),
  redoBtn: $("redo-btn"),
  helpBtn: $("help-btn"),
  themeBtn: $("theme-btn"),
  historyList: $("history-list"),
  historyCount: $("history-count"),
  notice: $("notice"),
  noticeText: $("notice-text"),
  noticeClose: $("notice-close"),
  editDialog: $("edit-dialog"),
  editForm: $("edit-form"),
  editTitle: $("edit-title"),
  editNotes: $("edit-notes"),
  editPriority: $("edit-priority"),
  editDue: $("edit-due"),
  editCancel: $("edit-cancel"),
  helpDialog: $("help-dialog"),
  shortcutList: $("shortcut-list"),
  helpClose: $("help-close"),
  toast: $("toast"),
  loadLegacy: $("load-legacy"),
  resetData: $("reset-data"),
};

// ---------- State ----------
const loaded = loadTasks();
const store = createStore(loaded.tasks);
const history = new CommandHistory(); // 20-action limit lives in history.js
let view = parseView(location.search);
let selectedId = null;
let editingId = null;
let saveWarningShown = false;
let returnFocusTo = null; // element that had focus before a dialog opened

const toast = (message, options) => showToast(refs.toast, message, options);
const findTask = (id) => store.getTasks().find((task) => task.id === id);
const visibleTasks = () => getVisibleTasks(store.getTasks(), view);
const run = (command) => history.execute(command, store);

// ---------- Rendering ----------
function render() {
  // A full re-render replaces the DOM nodes, so remember which control had keyboard focus.
  const active = document.activeElement;
  const focusRowId = active?.closest?.(".task")?.dataset.id;
  const focusSelector = active?.matches?.(".task__check input")
    ? ".task__check input"
    : active?.dataset?.action
      ? `[data-action="${active.dataset.action}"]`
      : null;

  const tasks = store.getTasks();
  const visible = visibleTasks();
  if (selectedId && !visible.some((task) => task.id === selectedId))
    selectedId = null;

  const manual = view.sort === "manual";
  renderTaskList(refs.list, visible, {
    query: view.q,
    selectedId,
    draggable: manual,
  });
  refs.list.classList.toggle("is-reorderable", manual);
  refs.dragHint.hidden = manual || visible.length < 2;

  const counts = getCounts(tasks);
  renderStats(refs.stats, counts, visible.length);
  renderEmpty(
    refs.empty,
    { totalTasks: tasks.length, visibleTasks: visible.length },
    {
      onLoadSamples: loadSamples,
      onClearFilters: () => setView({ ...DEFAULT_VIEW }),
    },
  );
  refs.clearCompleted.disabled = counts.done === 0;

  if (focusRowId && focusSelector) {
    refs.list
      .querySelector(
        `.task[data-id="${CSS.escape(focusRowId)}"] ${focusSelector}`,
      )
      ?.focus();
  }
}

function renderHistoryPanel() {
  renderHistory(refs.historyList, refs.historyCount, history.snapshot());
  refs.undoBtn.disabled = !history.canUndo;
  refs.redoBtn.disabled = !history.canRedo;
}

// ---------- View (filters, sort, search) <-> URL ----------
function setView(patch, { replace = false } = {}) {
  view = { ...view, ...patch };
  writeView(view, { replace });
  syncControls(view, refs);
  render();
}

// ---------- Actions ----------
function addTask(event) {
  event.preventDefault();
  const title = refs.addTitle.value.trim();
  if (!title) {
    refs.addTitle.focus();
    return;
  }
  const task = createTask({
    title,
    priority: refs.addPriority.value,
    dueDate: refs.addDue.value || null,
  });
  selectedId = task.id;
  run(new AddTaskCommand(task));
  refs.addTitle.value = "";
  refs.addDue.value = "";
  refs.addTitle.focus();
  if (!visibleTasks().some((item) => item.id === task.id)) {
    toast("Task added, but the current filters hide it.", {
      actionLabel: "Clear filters",
      onAction: () => setView({ ...DEFAULT_VIEW }),
    });
  }
}

function toggleTask(id) {
  const task = findTask(id);
  if (!task) return;
  selectedId = id;
  run(new ToggleTaskCommand(task));
}

function deleteTask(id) {
  const tasks = store.getTasks();
  const index = tasks.findIndex((task) => task.id === id);
  if (index === -1) return;
  // Move the selection to a neighbour so keyboard users can keep going.
  const visible = visibleTasks();
  const at = visible.findIndex((task) => task.id === id);
  selectedId = (visible[at + 1] ?? visible[at - 1])?.id ?? null;
  const task = tasks[index];
  run(new DeleteTaskCommand(task, index));
  toast(`Deleted \u201C${task.title}\u201D.`, {
    actionLabel: "Undo",
    onAction: undo,
  });
}

function clearCompleted() {
  const command = new ClearCompletedCommand(store.getTasks());
  if (command.removed.length === 0) {
    toast("There are no completed tasks to clear.");
    return;
  }
  run(command);
  const count = command.removed.length;
  toast(`Cleared ${count} completed task${count === 1 ? "" : "s"}.`, {
    actionLabel: "Undo",
    onAction: undo,
  });
}

function loadSamples() {
  run(new AddManyCommand(buildSampleTasks(), "Load sample tasks"));
}

function undo() {
  const command = history.undo(store);
  toast(
    command ? `Undid: ${command.label}` : "There is nothing to undo.",
    command ? { actionLabel: "Redo", onAction: redo } : {},
  );
}

function redo() {
  const command = history.redo(store);
  toast(
    command ? `Redid: ${command.label}` : "There is nothing to redo.",
    command ? { actionLabel: "Undo", onAction: undo } : {},
  );
}

// ---------- Selection and keyboard movement ----------
function select(id) {
  selectedId = id;
  applySelection(refs.list, id);
}

function moveSelection(step) {
  const visible = visibleTasks();
  if (visible.length === 0) return;
  const current = visible.findIndex((task) => task.id === selectedId);
  const next =
    current === -1
      ? step > 0
        ? 0
        : visible.length - 1
      : Math.min(visible.length - 1, Math.max(0, current + step));
  select(visible[next].id);
  refs.list
    .querySelector(".task--selected")
    ?.scrollIntoView({ block: "nearest" });
}

function moveSelected(step) {
  if (!selectedId) return;
  if (view.sort !== "manual") {
    toast("Choose Manual order in Sort to reorder tasks.");
    return;
  }
  const visible = visibleTasks();
  const at = visible.findIndex((task) => task.id === selectedId);
  const neighbour = visible[at + step];
  if (at === -1 || !neighbour) return;
  const command = ReorderTaskCommand.fromDrop(
    store.getTasks(),
    selectedId,
    neighbour.id,
    step < 0 ? "before" : "after",
  );
  if (command) {
    run(command);
    refs.list
      .querySelector(".task--selected")
      ?.scrollIntoView({ block: "nearest" });
  }
}

// ---------- Dialog focus handling ----------
// Without this, closing a dialog with Esc can leave focus on a hidden input inside it,
// and every keyboard shortcut would then be ignored as "typing".
function openDialog(dialog) {
  returnFocusTo = document.activeElement;
  dialog.showModal();
}
[refs.editDialog, refs.helpDialog].forEach((dialog) =>
  dialog.addEventListener("close", () => {
    const target = returnFocusTo;
    returnFocusTo = null;
    if (target && target !== document.body && target.isConnected)
      target.focus();
    else if (dialog.contains(document.activeElement))
      document.activeElement.blur();
  }),
);

// ---------- Edit dialog ----------
function openEdit(id) {
  const task = findTask(id);
  if (!task) return;
  editingId = id;
  refs.editTitle.value = task.title;
  refs.editNotes.value = task.notes;
  refs.editPriority.value = task.priority;
  refs.editDue.value = task.dueDate ?? "";
  openDialog(refs.editDialog);
  refs.editTitle.select();
}

refs.editForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const task = findTask(editingId);
  const title = refs.editTitle.value.trim();
  if (!task || !title) {
    refs.editTitle.focus();
    return;
  }
  const changes = {
    title: title.slice(0, MAX_TITLE),
    notes: refs.editNotes.value.trim().slice(0, MAX_NOTES),
    priority: refs.editPriority.value,
    dueDate: refs.editDue.value || null,
  };
  const changed = Object.keys(changes).some(
    (key) => changes[key] !== task[key],
  );
  refs.editDialog.close();
  if (changed) {
    selectedId = task.id;
    run(new UpdateTaskCommand(task, changes));
  }
});
refs.editCancel.addEventListener("click", () => refs.editDialog.close());

// ---------- Help dialog (built from the same table the key handler uses) ----------
refs.shortcutList.replaceChildren(
  ...BINDINGS.flatMap((binding) => [
    h(
      "dt",
      {},
      binding.keys.flatMap((keyName, index) => [
        index > 0
          ? h(
              "span",
              { class: "shortcut-list__sep" },
              binding.combo ? "+" : "or",
            )
          : null,
        h("kbd", {}, keyName),
      ]),
    ),
    h("dd", {}, binding.label),
  ]),
);
const openHelp = () => openDialog(refs.helpDialog);
refs.helpBtn.addEventListener("click", openHelp);
refs.helpClose.addEventListener("click", () => refs.helpDialog.close());

// ---------- Events ----------
refs.addForm.addEventListener("submit", addTask);

refs.list.addEventListener("click", (event) => {
  const row = event.target.closest(".task");
  if (!row) return;
  const id = row.dataset.id;
  const action = event.target.closest("[data-action]")?.dataset.action;
  if (action === "edit") return openEdit(id);
  if (action === "delete") return deleteTask(id);
  select(id);
});
refs.list.addEventListener("change", (event) => {
  if (event.target.matches(".task__check input"))
    toggleTask(event.target.closest(".task").dataset.id);
});
refs.list.addEventListener("dblclick", (event) => {
  if (event.target.closest(".task__main"))
    openEdit(event.target.closest(".task").dataset.id);
});

refs.statusButtons.forEach((button) =>
  button.addEventListener("click", () =>
    setView({ status: button.dataset.value }),
  ),
);
refs.priorityFilter.addEventListener("change", () =>
  setView({ priority: refs.priorityFilter.value }),
);
refs.sortSelect.addEventListener("change", () =>
  setView({ sort: refs.sortSelect.value }),
);
refs.dirButton.addEventListener("click", () =>
  setView({ dir: view.dir === "asc" ? "desc" : "asc" }),
);

// Debounced search: the list only updates 250 ms after the last keystroke.
// replaceState (not pushState) so typing does not fill the Back button history.
const applySearch = debounce(
  (value) => setView({ q: value.trim().slice(0, 80) }, { replace: true }),
  250,
);
refs.search.addEventListener("input", (event) =>
  applySearch(event.target.value),
);

// Back / Forward: rebuild the view from the URL.
window.addEventListener("popstate", () => {
  view = parseView(location.search);
  syncControls(view, refs);
  render();
});

refs.clearCompleted.addEventListener("click", clearCompleted);
refs.undoBtn.addEventListener("click", undo);
refs.redoBtn.addEventListener("click", redo);

// ---------- Drag and drop ----------
initDragAndDrop(refs.list, {
  canDrag: () => view.sort === "manual",
  onReorder: (id, targetId, position) => {
    const command = ReorderTaskCommand.fromDrop(
      store.getTasks(),
      id,
      targetId,
      position,
    );
    if (command) {
      selectedId = id;
      run(command);
    }
  },
});

// ---------- Keyboard shortcuts ----------
initShortcuts({
  "focus-add": () => refs.addTitle.focus(),
  "focus-search": () => {
    refs.search.focus();
    refs.search.select();
  },
  "select-next": () => moveSelection(1),
  "select-prev": () => moveSelection(-1),
  toggle: () => selectedId && toggleTask(selectedId),
  edit: () => selectedId && openEdit(selectedId),
  delete: () => selectedId && deleteTask(selectedId),
  "move-up": () => moveSelected(-1),
  "move-down": () => moveSelected(1),
  undo,
  redo,
  help: openHelp,
  escape: (event) => {
    const el = event.target;
    if (el === refs.search && el.value) {
      applySearch.cancel();
      el.value = "";
      setView({ q: "" }, { replace: true });
    } else if (el !== document.body && el.blur) {
      el.blur();
    } else if (selectedId) {
      select(null);
    }
  },
});

// ---------- Theme ----------
const THEME_KEY = "taskboard:theme";
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme;
  refs.themeBtn.textContent = theme === "dark" ? "Light theme" : "Dark theme";
}
applyTheme(
  document.documentElement.dataset.theme === "dark" ? "dark" : "light",
);
refs.themeBtn.addEventListener("click", () => {
  const next =
    document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  try {
    localStorage.setItem(THEME_KEY, next);
  } catch {
    /* theme just will not persist */
  }
  applyTheme(next);
});

// ---------- Storage notices and developer tools ----------
refs.noticeClose.addEventListener("click", () => {
  refs.notice.hidden = true;
});
function showNotice(message) {
  refs.noticeText.textContent = message;
  refs.notice.hidden = false;
}
if (loaded.status === "migrated") {
  showNotice(
    `Your saved tasks were upgraded from format v${loaded.from} to v${loaded.to}. The original was kept as a backup.`,
  );
} else if (loaded.status === "recovered") {
  showNotice(
    "Your saved data could not be read, so Taskboard started fresh. The original was kept as a backup in this browser.",
  );
}

refs.loadLegacy.addEventListener("click", () => {
  if (
    confirm(
      "Replace your saved tasks with sample data in the old v1 format? The page will reload and migrate it.",
    )
  ) {
    writeLegacySample();
    location.reload();
  }
});
refs.resetData.addEventListener("click", () => {
  if (confirm("Delete all saved tasks in this browser?")) {
    resetStorage();
    location.reload();
  }
});

// ---------- Wire up and start ----------
store.subscribe((tasks) => {
  if (!saveTasks(tasks) && !saveWarningShown) {
    saveWarningShown = true;
    toast(
      "Your browser blocked saving. Changes will be lost when you close this tab.",
      { duration: 8000 },
    );
  }
  render();
});
history.subscribe(renderHistoryPanel);

syncControls(view, refs);
renderHistoryPanel();
render();
