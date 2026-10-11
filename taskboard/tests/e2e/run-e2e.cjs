// Browser end-to-end test: drives the real app in Chromium and checks every feature.
// Setup (once):  npm install --save-dev playwright  &&  npx playwright install chromium
// Run:           npm run test:e2e
const { chromium } = require("playwright");
const { start } = require("./server.cjs");

const results = [];
let currentArea = "CRUD";
const area = (name) => {
  currentArea = name;
};
const check = (name, ok, extra = "") => {
  results.push({ name, ok: !!ok, extra, area: currentArea });
  console.log(`${ok ? "PASS" : "FAIL"}  ${name}${ok ? "" : "  -> " + extra}`);
};

(async () => {
  const server = await start();
  const browser = await chromium.launch(
    process.env.CHROMIUM_PATH
      ? { executablePath: process.env.CHROMIUM_PATH }
      : {},
  );
  const context = await browser.newContext({
    viewport: { width: 1240, height: 900 },
  });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (e) => problems.push("pageerror: " + e.message));
  page.on("console", (m) => {
    if (["error", "warning"].includes(m.type()))
      problems.push(m.type() + ": " + m.text());
  });
  page.on("dialog", (d) => d.accept());

  const URL = "http://localhost:5511/";
  const rows = () => page.locator(".task");
  const titles = () =>
    page.$$eval(".task .task__title", (els) => els.map((e) => e.textContent));
  const stored = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("taskboard:data")));
  const blur = async () => {
    await page.click("h1");
  };
  const historyText = () => page.textContent("#history-count");

  await page.goto(URL);
  await page.waitForSelector("#empty-state:not([hidden])");
  check(
    "empty state shown on first visit",
    (await page.textContent("#empty-state")).includes("No tasks yet"),
  );

  await page.click("text=Load sample tasks");
  check(
    "sample tasks load as ONE history entry",
    (await rows().count()) === 9 && (await historyText()) === "1 of 20",
    await historyText(),
  );

  // ---- CREATE
  area("CRUD");
  await page.fill("#add-title", "Write unit tests");
  await page.selectOption("#add-priority", "high");
  await page.press("#add-title", "Enter");
  check(
    "add: new task appears at the top",
    (await titles())[0] === "Write unit tests" && (await rows().count()) === 10,
  );
  let data = await stored();
  check(
    "add: saved to localStorage with schema version 3",
    data.version === 3 &&
      data.tasks.length === 10 &&
      data.tasks[0].priority === "high",
  );

  // XSS safety
  await page.fill("#add-title", '<img src=x onerror="window.__xss=1">');
  await page.press("#add-title", "Enter");
  await page.waitForTimeout(100);
  check(
    "XSS: markup is shown as text, never executed",
    (await page.evaluate(() => window.__xss)) === undefined &&
      (await titles())[0].startsWith("<img"),
  );

  // ---- UPDATE (toggle + edit)
  area("CRUD");
  await rows().nth(2).locator(".task__check input").click();
  check(
    "toggle: task marked done",
    await rows()
      .nth(2)
      .evaluate((el) => el.classList.contains("task--done")),
  );
  await blur();
  await page.keyboard.press("Control+z");
  check(
    "undo (Ctrl+Z) reverses the toggle",
    !(await rows()
      .nth(2)
      .evaluate((el) => el.classList.contains("task--done"))),
  );
  await page.keyboard.press("Control+Shift+Z");
  check(
    "redo (Ctrl+Shift+Z) re-applies it",
    await rows()
      .nth(2)
      .evaluate((el) => el.classList.contains("task--done")),
  );
  await page.keyboard.press("Control+z");

  const before = (await titles())[3];
  await rows().nth(3).locator("[data-action=edit]").click();
  await page.fill("#edit-title", "Edited title");
  await page.fill("#edit-notes", "Some notes");
  await page.selectOption("#edit-priority", "low");
  await page.fill("#edit-due", "2026-12-25");
  await page.click("#edit-form button[type=submit]");
  check(
    "edit dialog saves title, notes, priority and due date",
    (await titles())[3] === "Edited title" &&
      (await rows().nth(3).textContent()).includes("Some notes") &&
      (await rows().nth(3).textContent()).includes("25 Dec"),
  );
  await blur();
  await page.keyboard.press("Control+z");
  check("undo restores the pre-edit task", (await titles())[3] === before);

  // ---- DELETE
  area("CRUD");
  const countBefore = await rows().count();
  const victim = (await titles())[4];
  await rows().nth(4).locator("[data-action=delete]").click();
  check(
    "delete removes the task and offers Undo",
    (await rows().count()) === countBefore - 1 &&
      (await page.textContent("#toast")).includes("Undo"),
  );
  await page.click("#toast button");
  check(
    "toast Undo restores it at the same position",
    (await titles())[4] === victim && (await rows().count()) === countBefore,
  );

  // ---- SEARCH (debounced + highlight)
  area("Search");
  await page.click("#search");
  await page.keyboard.type("report", { delay: 10 });
  const immediately = await rows().count();
  const urlImmediately = page.url();
  check(
    "search is debounced: nothing changes immediately",
    immediately === countBefore && !urlImmediately.includes("q="),
    `${immediately} ${urlImmediately}`,
  );
  await page.waitForTimeout(450);
  check(
    "search filters after the debounce delay",
    (await rows().count()) === 2,
    String(await rows().count()),
  );
  const marks = await page.$$eval("mark", (els) =>
    els.map((e) => e.textContent.toLowerCase()),
  );
  check(
    "matches are highlighted with <mark>",
    marks.length >= 2 && marks.every((m) => m === "report"),
    JSON.stringify(marks),
  );
  check("search term is written to the URL", page.url().includes("q=report"));
  await page.fill("#search", "");
  await page.waitForTimeout(400);

  // ---- FILTER / SORT + URL persistence
  area("Filters");
  await page.click("#status-filter button[data-value=active]");
  await page.selectOption("#priority-filter", "high");
  await page.selectOption("#sort-select", "due");
  await page.click("#dir-btn");
  const url = new globalThis.URL(page.url());
  check(
    "filters and sort are written to the URL",
    url.searchParams.get("status") === "active" &&
      url.searchParams.get("priority") === "high" &&
      url.searchParams.get("sort") === "due" &&
      url.searchParams.get("dir") === "desc",
    page.url(),
  );
  const filteredTitles = await titles();
  await page.reload();
  await page.waitForSelector(".task");
  check(
    "reload restores the same view from the URL",
    JSON.stringify(await titles()) === JSON.stringify(filteredTitles) &&
      (await page.getAttribute(
        "#status-filter button[data-value=active]",
        "aria-pressed",
      )) === "true" &&
      (await page.inputValue("#sort-select")) === "due" &&
      (await page.inputValue("#priority-filter")) === "high",
  );
  check(
    "tasks survive a reload (localStorage)",
    (await stored()).tasks.length === countBefore,
  );
  await page.goBack();
  check(
    "Back button steps to the previous view",
    (await page.inputValue("#sort-select")) === "due" &&
      (await page.textContent("#dir-btn")) === "Ascending",
    page.url(),
  );
  await page.goto(URL);
  await page.waitForSelector(".task");
  check(
    "plain URL shows the default view again",
    (await page.inputValue("#sort-select")) === "manual",
  );
  check(
    "tampered URL values fall back safely",
    await (async () => {
      await page.goto(URL + "?status=hack&sort=%3Cscript%3E");
      await page.waitForSelector(".task");
      return (await page.inputValue("#sort-select")) === "manual";
    })(),
  );
  await page.goto(URL);
  await page.waitForSelector(".task");

  // ---- SORT disables drag
  area("Drag");
  await page.selectOption("#sort-select", "title");
  check(
    "non-manual sort disables dragging and explains why",
    (await rows().first().getAttribute("draggable")) === null &&
      !(await page.isHidden("#drag-hint")),
  );
  await page.selectOption("#sort-select", "manual");
  check(
    "manual order re-enables dragging",
    (await rows().first().getAttribute("draggable")) === "true",
  );

  // ---- DRAG AND DROP
  area("Drag");
  const order0 = await titles();
  await rows()
    .nth(3)
    .dragTo(rows().nth(0), { targetPosition: { x: 300, y: 4 } });
  const order1 = await titles();
  check(
    "drag row 4 above row 1 reorders the list",
    order1[0] === order0[3] && order1[1] === order0[0],
    JSON.stringify(order1.slice(0, 3)),
  );
  check(
    "reorder is saved",
    JSON.stringify((await stored()).tasks.map((t) => t.title)) ===
      JSON.stringify(order1),
  );
  await blur();
  await page.keyboard.press("Control+z");
  check(
    "undo restores the original order",
    JSON.stringify(await titles()) === JSON.stringify(order0),
  );
  await rows()
    .nth(0)
    .dragTo(rows().nth(2), { targetPosition: { x: 300, y: 50 } });
  const order2 = await titles();
  check(
    "drop on lower half places the task after the target",
    order2[2] === order0[0],
    JSON.stringify(order2.slice(0, 4)),
  );
  await blur();
  await page.keyboard.press("Control+z");

  // ---- KEYBOARD
  area("Keyboard");
  await blur();
  await page.keyboard.press("Escape");
  check(
    "Esc on the page clears the selection",
    (await page.locator(".task--selected").count()) === 0,
  );
  await page.keyboard.press("j");
  check(
    "J selects the first task",
    await rows()
      .first()
      .evaluate((el) => el.classList.contains("task--selected")),
  );
  await page.keyboard.press("j");
  await page.keyboard.press("ArrowUp");
  check(
    "arrow keys move the selection",
    await rows()
      .first()
      .evaluate((el) => el.classList.contains("task--selected")),
  );
  const t0 = (await titles())[0];
  await page.keyboard.press("Alt+ArrowDown");
  check("Alt+Down moves the selected task", (await titles())[1] === t0);
  await page.keyboard.press("Alt+ArrowUp");
  check("Alt+Up moves it back", (await titles())[0] === t0);
  await page.keyboard.press("x");
  check(
    "X toggles the selected task",
    await rows()
      .first()
      .evaluate((el) => el.classList.contains("task--done")),
  );
  await page.keyboard.press("e");
  check(
    "E opens the edit dialog",
    await page.evaluate(() => document.getElementById("edit-dialog").open),
  );
  await page.keyboard.press("Escape");
  check(
    "Esc closes the dialog",
    !(await page.evaluate(() => document.getElementById("edit-dialog").open)),
  );
  await page.waitForTimeout(60);
  check(
    "focus leaves the closed dialog (shortcuts keep working)",
    await page.evaluate(() => !document.activeElement.closest("dialog")),
  );
  await page.keyboard.press("?");
  check(
    "? opens the shortcut help",
    (await page.evaluate(() => document.getElementById("help-dialog").open)) &&
      (await page.$$("#shortcut-list kbd")).length > 10,
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("n");
  check(
    "N focuses the add field",
    (await page.evaluate(() => document.activeElement.id)) === "add-title",
  );
  await page.keyboard.type("nnn");
  check(
    "shortcuts pause while typing in a field",
    (await page.inputValue("#add-title")) === "nnn",
  );
  await page.keyboard.press("Escape");
  await page.keyboard.press("/");
  check(
    "/ focuses search",
    (await page.evaluate(() => document.activeElement.id)) === "search",
  );
  await page.keyboard.type("zzz");
  await page.waitForTimeout(400);
  check(
    "no results shows an empty state with Clear filters",
    (await page.textContent("#empty-state")).includes("Clear filters"),
  );
  await page.keyboard.press("Escape");
  await page.waitForTimeout(100);
  check(
    "Esc in search clears it",
    (await page.inputValue("#search")) === "" && (await rows().count()) > 0,
  );
  await page.keyboard.press("Escape");
  check(
    "a second Esc leaves the search field",
    (await page.evaluate(() => document.activeElement.tagName)) === "BODY",
  );
  await page.keyboard.press("j");
  const cnt = await rows().count();
  await page.keyboard.press("Delete");
  check(
    "Delete key removes the selected task",
    (await rows().count()) === cnt - 1,
  );

  // ---- 20-ACTION HISTORY LIMIT
  area("History");
  await blur();
  for (let i = 0; i < 25; i++) {
    await page.fill("#add-title", "Bulk " + i);
    await page.press("#add-title", "Enter");
  }
  check(
    "history is capped at 20 actions",
    (await historyText()) === "20 of 20",
    await historyText(),
  );
  check(
    "history panel lists 20 entries plus the current-state marker",
    (await page.locator("#history-list li").count()) === 21,
  );
  await blur();
  for (let i = 0; i < 30; i++) await page.keyboard.press("Control+z");
  check(
    "only the 20 newest actions can be undone",
    (await page.textContent("#history-count")) === "0 of 20" &&
      (await page.locator("#history-list li").count()) > 1,
  );
  check(
    "Undo button disabled when history is empty",
    (await page.isDisabled("#undo-btn")) === true,
  );

  // ---- CLEAR COMPLETED
  area("History");
  await page.click("#clear-completed");
  const afterClear = (await stored()).tasks.filter((t) => t.completed).length;
  check("Clear completed removes done tasks", afterClear === 0);
  await blur();
  await page.keyboard.press("Control+z");
  check(
    "...and undo brings them all back",
    (await stored()).tasks.some((t) => t.completed),
  );

  // ---- THEME
  area("Theme");
  await page.click("#theme-btn");
  check(
    "theme toggles to dark",
    (await page.getAttribute("html", "data-theme")) === "dark",
  );
  await page.reload();
  await page.waitForSelector(".task");
  check(
    "theme persists across reloads",
    (await page.getAttribute("html", "data-theme")) === "dark",
  );
  await page.click("#theme-btn");

  // ---- MIGRATION
  area("Storage");
  await page.evaluate(() =>
    localStorage.setItem(
      "taskboard:data",
      JSON.stringify([
        { id: 1, text: "Old one", done: true },
        { id: 2, text: "Old two", done: false },
      ]),
    ),
  );
  await page.reload();
  await page.waitForSelector(".task");
  data = await stored();
  check(
    "v1 data is migrated to v3 on load",
    data.version === 3 &&
      data.tasks.length === 2 &&
      data.tasks[0].title === "Old one" &&
      data.tasks[0].completed === true &&
      data.tasks[0].priority === "medium",
  );
  check(
    "migration notice is shown",
    (await page.textContent("#notice-text")).includes("v1 to v3"),
  );
  check(
    "original data kept as a backup",
    (
      await page.evaluate(() => localStorage.getItem("taskboard:backup"))
    ).includes('"text":"Old one"'),
  );
  await page.click("#notice-close");
  await page.evaluate(() =>
    localStorage.setItem("taskboard:data", "{broken json"),
  );
  await page.reload();
  await page.waitForSelector("#empty-state:not([hidden])");
  check(
    "corrupt storage is recovered, not a crash",
    (await page.textContent("#notice-text")).includes("could not be read"),
  );
  await page.click('summary:has-text("Developer tools")');
  await page.click("#load-legacy");
  await page.waitForSelector(".task");
  check(
    'Developer tools: "Load old-format data" runs the migration',
    (await rows().count()) === 4 &&
      (await page.textContent("#notice-text")).includes("upgraded"),
  );
  await page.click('summary:has-text("Developer tools")');
  await page.click("#reset-data");
  await page.waitForSelector("#empty-state:not([hidden])");
  check(
    "Developer tools: reset clears storage",
    (await page.evaluate(() => localStorage.getItem("taskboard:data"))) ===
      null,
  );

  const real = problems.filter((p) => !p.includes("favicon"));
  check(
    "no console errors or warnings during the whole run",
    real.length === 0,
    JSON.stringify(real),
  );

  const areas = {};
  results.forEach((r) => {
    areas[r.area] = areas[r.area] || { pass: 0, total: 0 };
    areas[r.area].total++;
    if (r.ok) areas[r.area].pass++;
  });
  console.log("\nBy area:");
  Object.entries(areas).forEach(([n, a]) =>
    console.log(`  ${n.padEnd(10)} ${a.pass}/${a.total}`),
  );
  const failed = results.filter((r) => !r.ok);
  console.log(
    `\n${results.length - failed.length}/${results.length} checks passed`,
  );
  await browser.close();
  server.close();
  process.exit(failed.length ? 1 : 0);
})().catch((e) => {
  console.error("CRASH", e);
  process.exit(2);
});
