// =========================================================
// Keyboard shortcuts as DATA: one table drives both the key
// handler and the help dialog, so they can never disagree.
// =========================================================

const hasMod = (event) => event.ctrlKey || event.metaKey;
const key = (event) => event.key.toLowerCase();
const INTERACTIVE = "button, a, input, select, textarea, summary";
const TEXT_ENTRY =
  'input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select, [contenteditable=""], [contenteditable=true]';

export const BINDINGS = [
  {
    id: "focus-add",
    keys: ["N"],
    label: "New task",
    match: (e) => !hasMod(e) && !e.altKey && key(e) === "n",
  },
  {
    id: "focus-search",
    keys: ["/"],
    label: "Search",
    match: (e) => !hasMod(e) && e.key === "/",
  },
  {
    id: "select-next",
    keys: ["\u2193", "J"],
    label: "Select next task",
    match: (e) =>
      !hasMod(e) && !e.altKey && (e.key === "ArrowDown" || key(e) === "j"),
  },
  {
    id: "select-prev",
    keys: ["\u2191", "K"],
    label: "Select previous task",
    match: (e) =>
      !hasMod(e) && !e.altKey && (e.key === "ArrowUp" || key(e) === "k"),
  },
  {
    id: "toggle",
    keys: ["Space", "X"],
    label: "Complete or reopen",
    match: (e) =>
      !hasMod(e) &&
      !e.altKey &&
      (key(e) === "x" || (e.key === " " && !e.target.closest?.(INTERACTIVE))),
  },
  {
    id: "edit",
    keys: ["E", "Enter"],
    label: "Edit selected task",
    match: (e) =>
      !hasMod(e) &&
      !e.altKey &&
      (key(e) === "e" ||
        (e.key === "Enter" && !e.target.closest?.(INTERACTIVE))),
  },
  {
    id: "delete",
    keys: ["Del"],
    label: "Delete selected task",
    match: (e) => !hasMod(e) && (e.key === "Delete" || e.key === "Backspace"),
  },
  {
    id: "move-up",
    keys: ["Alt", "\u2191"],
    combo: true,
    label: "Move task up",
    match: (e) => e.altKey && e.key === "ArrowUp",
  },
  {
    id: "move-down",
    keys: ["Alt", "\u2193"],
    combo: true,
    label: "Move task down",
    match: (e) => e.altKey && e.key === "ArrowDown",
  },
  {
    id: "undo",
    keys: ["Ctrl", "Z"],
    combo: true,
    label: "Undo",
    match: (e) => hasMod(e) && !e.shiftKey && key(e) === "z",
  },
  {
    id: "redo",
    keys: ["Ctrl", "Shift", "Z"],
    combo: true,
    label: "Redo (Ctrl+Y also works)",
    match: (e) =>
      hasMod(e) && ((e.shiftKey && key(e) === "z") || key(e) === "y"),
  },
  {
    id: "help",
    keys: ["?"],
    label: "Show this list",
    match: (e) => !hasMod(e) && e.key === "?",
  },
  {
    id: "escape",
    keys: ["Esc"],
    label: "Leave a field, clear search",
    allowWhileTyping: true,
    match: (e) => e.key === "Escape",
  },
];

export function initShortcuts(actions) {
  document.addEventListener("keydown", (event) => {
    // Dialogs handle their own keys (Esc closes them natively).
    if (document.querySelector("dialog[open]")) return;
    // A field inside a closed dialog is hidden, so it cannot really be "typed into".
    const typing =
      Boolean(event.target.closest?.(TEXT_ENTRY)) &&
      !event.target.closest?.("dialog:not([open])");

    const binding = BINDINGS.find((item) => item.match(event));
    if (!binding) return;
    // While typing, only Esc is ours. Everything else (including Ctrl+Z) stays native to the field.
    if (typing && !binding.allowWhileTyping) return;

    event.preventDefault();
    actions[binding.id]?.(event);
  });
}
