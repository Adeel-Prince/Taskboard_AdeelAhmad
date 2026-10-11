import { createTask } from "../models/task.js";
import { toDateInputValue } from "../utils/dates.js";

const inDays = (days) => {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return toDateInputValue(date);
};

const SAMPLES = [
  {
    title: "Finish the modules report",
    notes: "Add screenshots of the barrel file example.",
    priority: "high",
    due: 1,
  },
  {
    title: "Record the demo video",
    notes: "Cover every feature in four to six minutes.",
    priority: "high",
    due: 2,
  },
  { title: "Push the project to GitHub", priority: "medium", due: 2 },
  {
    title: "Review the array methods notes",
    notes: "map, filter, reduce, some and every.",
    priority: "low",
    due: null,
  },
  { title: "Fix the dashboard header copy", priority: "medium", due: -1 },
  { title: "Send the weekly progress report", priority: "medium", due: 0 },
  { title: "Back up the demo recording", priority: "low", due: 5 },
  {
    title: "Clean up unused CSS tokens",
    priority: "low",
    due: 7,
    completed: true,
  },
  {
    title: "Submit the CSS token project",
    priority: "high",
    due: -3,
    completed: true,
  },
];

/** Fresh sample tasks every call (new ids, due dates relative to today). */
export function buildSampleTasks(now = Date.now()) {
  return SAMPLES.map(({ due, ...rest }, index) =>
    createTask({
      ...rest,
      dueDate: due === null ? null : inDays(due),
      createdAt: now + index,
    }),
  );
}
