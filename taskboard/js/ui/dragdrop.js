// =========================================================
// HTML5 Drag and Drop reordering.
// One set of listeners on the list (event delegation), so it keeps
// working when rows are re-rendered. The module only reports
// "move X before/after Y"; the command layer decides what that means.
// =========================================================

/** Which row is the pointer closest to, and is it in the top or bottom half? */
function locateDrop(listEl, clientY) {
  const rows = [...listEl.querySelectorAll(".task")];
  const target = rows.find((row) => {
    const box = row.getBoundingClientRect();
    return clientY < box.top + box.height / 2;
  });
  if (target) return { row: target, position: "before" };
  return { row: rows.at(-1), position: "after" };
}

export function initDragAndDrop(listEl, { canDrag, onReorder }) {
  let draggedId = null;

  const clearIndicators = () =>
    listEl
      .querySelectorAll(".task--drop-before, .task--drop-after")
      .forEach((row) =>
        row.classList.remove("task--drop-before", "task--drop-after"),
      );

  const finish = () => {
    draggedId = null;
    clearIndicators();
    listEl
      .querySelectorAll(".task--dragging")
      .forEach((row) => row.classList.remove("task--dragging"));
  };

  listEl.addEventListener("dragstart", (event) => {
    const row = event.target.closest?.(".task");
    if (!row || !canDrag()) {
      event.preventDefault();
      return;
    }
    draggedId = row.dataset.id;
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", draggedId);
    // Style after the browser has captured the drag image, otherwise the ghost looks faded too.
    requestAnimationFrame(() => row.classList.add("task--dragging"));
  });

  listEl.addEventListener("dragover", (event) => {
    if (!draggedId) return;
    event.preventDefault(); // required, otherwise the drop event never fires
    event.dataTransfer.dropEffect = "move";
    const { row, position } = locateDrop(listEl, event.clientY);
    clearIndicators();
    if (row && row.dataset.id !== draggedId) {
      row.classList.add(
        position === "before" ? "task--drop-before" : "task--drop-after",
      );
    }
  });

  listEl.addEventListener("dragleave", (event) => {
    if (!listEl.contains(event.relatedTarget)) clearIndicators();
  });

  listEl.addEventListener("drop", (event) => {
    if (!draggedId) return;
    event.preventDefault();
    const id = draggedId;
    const { row, position } = locateDrop(listEl, event.clientY);
    finish();
    if (row && row.dataset.id !== id) onReorder(id, row.dataset.id, position);
  });

  listEl.addEventListener("dragend", finish);
}
