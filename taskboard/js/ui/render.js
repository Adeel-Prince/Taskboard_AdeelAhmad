import { h, icon, ICONS } from "../utils/dom.js";
import { highlight } from "../utils/highlight.js";
import { describeDue } from "../utils/dates.js";

const capitalize = (text) => text.charAt(0).toUpperCase() + text.slice(1);

/** One task "strip". Built with DOM calls (not innerHTML), so task text can never inject markup. */
function taskRow(task, { query, selectedId, draggable }) {
  const due = describeDue(task.dueDate);
  const overdue = due.overdue && !task.completed;
  const isSelected = task.id === selectedId;

  return h(
    "li",
    {
      class: [
        "task",
        `task--${task.priority}`,
        task.completed && "task--done",
        isSelected && "task--selected",
      ],
      dataset: { id: task.id },
      draggable,
      "aria-current": isSelected ? "true" : null,
    },
    h(
      "span",
      {
        class: "task__handle",
        title: draggable
          ? "Drag to reorder"
          : "Set Sort to Manual order to drag",
        "aria-hidden": "true",
      },
      h("span", { class: "task__grip" }),
    ),
    h(
      "label",
      { class: "task__check" },
      h("input", {
        type: "checkbox",
        checked: task.completed,
        "aria-label": `${task.completed ? "Reopen" : "Complete"} ${task.title}`,
      }),
    ),
    h(
      "div",
      { class: "task__main" },
      h("span", { class: "task__title" }, highlight(task.title, query)),
      task.notes
        ? h("span", { class: "task__notes" }, highlight(task.notes, query))
        : null,
    ),
    h("span", { class: "task__priority" }, capitalize(task.priority)),
    h(
      "span",
      {
        class: ["task__due", due.empty && "is-empty", overdue && "is-overdue"],
      },
      h("span", { class: "task__due-when" }, due.when),
      overdue ? h("span", { class: "task__due-note" }, due.note) : null,
    ),
    h(
      "div",
      { class: "task__actions" },
      h(
        "button",
        {
          class: "icon-btn",
          type: "button",
          dataset: { action: "edit" },
          title: "Edit (E)",
          "aria-label": `Edit ${task.title}`,
        },
        icon(...ICONS.edit),
      ),
      h(
        "button",
        {
          class: "icon-btn icon-btn--danger",
          type: "button",
          dataset: { action: "delete" },
          title: "Delete (Del)",
          "aria-label": `Delete ${task.title}`,
        },
        icon(...ICONS.remove),
      ),
    ),
  );
}

export function renderTaskList(listEl, tasks, options) {
  listEl.replaceChildren(...tasks.map((task) => taskRow(task, options)));
}

/** Toggle the selection outline without rebuilding the list (a rebuild between mousedown and mouseup would swallow clicks). */
export function applySelection(listEl, selectedId) {
  [...listEl.children].forEach((row) => {
    const selected = row.dataset.id === selectedId;
    row.classList.toggle("task--selected", selected);
    if (selected) row.setAttribute("aria-current", "true");
    else row.removeAttribute("aria-current");
  });
}

export function renderEmpty(
  el,
  { totalTasks, visibleTasks },
  { onLoadSamples, onClearFilters },
) {
  if (visibleTasks > 0) {
    el.hidden = true;
    el.replaceChildren();
    return;
  }
  el.hidden = false;
  if (totalTasks === 0) {
    el.replaceChildren(
      h("p", { class: "empty__title" }, "No tasks yet."),
      h(
        "p",
        {},
        "Type one above and press Enter, or start from a sample list.",
      ),
      h(
        "button",
        { class: "btn btn--primary", type: "button", onclick: onLoadSamples },
        "Load sample tasks",
      ),
    );
  } else {
    el.replaceChildren(
      h("p", { class: "empty__title" }, "Nothing matches these filters."),
      h("p", {}, "Change the search or filters to see your tasks again."),
      h(
        "button",
        { class: "btn", type: "button", onclick: onClearFilters },
        "Clear filters",
      ),
    );
  }
}

export function renderStats(el, counts, visibleCount) {
  const base = `${counts.open} open, ${counts.done} done`;
  el.textContent =
    visibleCount === counts.total
      ? base
      : `Showing ${visibleCount} of ${counts.total}. ${base}.`;
}

export function renderHistory(listEl, countEl, { done, undone, limit }) {
  countEl.textContent = `${done.length} of ${limit}`;
  if (done.length === 0 && undone.length === 0) {
    listEl.replaceChildren(
      h(
        "li",
        { class: "log__empty" },
        "Nothing yet. Add, edit or move a task and it shows up here.",
      ),
    );
    return;
  }
  listEl.replaceChildren(
    ...done.map((label) => h("li", { class: "log__item" }, label)),
    h("li", { class: "log__item log__item--now" }, "Current state"),
    ...undone.map((label) =>
      h(
        "li",
        {
          class: "log__item log__item--undone",
          title: "Undone. Redo to bring it back.",
        },
        label,
      ),
    ),
  );
  const now = listEl.querySelector(".log__item--now");
  now?.scrollIntoView({ block: "nearest" });
}

/** Keeps every toolbar control in step with the view (also used after Back/Forward). */
export function syncControls(view, refs) {
  refs.statusButtons.forEach((button) =>
    button.setAttribute(
      "aria-pressed",
      String(button.dataset.value === view.status),
    ),
  );
  refs.priorityFilter.value = view.priority;
  refs.sortSelect.value = view.sort;
  refs.dirButton.textContent = view.dir === "asc" ? "Ascending" : "Descending";
  refs.dirButton.disabled = view.sort === "manual";
  if (refs.search.value.trim() !== view.q) refs.search.value = view.q;
}
