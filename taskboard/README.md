# Taskboard

A single-page task manager built with plain JavaScript, HTML and CSS. No frameworks, no build step, organised as ES modules.

## Run it

ES modules need an HTTP server (opening `index.html` by double-click will not work).

- **VS Code:** right-click `index.html` and choose **Open with Live Server**.
- **Terminal:** `npm start` (serves on http://localhost:5500).

On a first visit the list is empty. Click **Load sample tasks** to fill it.

## Features

| Feature                        | Notes                                                                                                 |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| Create, edit, complete, delete | Quick-add form, edit dialog, checkbox, delete button                                                  |
| Filters and sort in the URL    | `?status=active&priority=high&sort=due&dir=desc&q=report` survives reload, bookmarks and Back/Forward |
| Drag and drop reordering       | HTML5 drag events; works with filters; off while a sort is active                                     |
| localStorage with migrations   | Saved as `{ version, tasks }`; v1 to v2 to v3 upgrades; original kept as a backup                     |
| Keyboard shortcuts             | Press `?` in the app for the full list                                                                |
| Undo and redo                  | Command pattern, 20-action history, History panel shows the timeline                                  |
| Debounced search               | 250 ms delay, matches highlighted with `<mark>`                                                       |

Extras: dark theme, responsive layout, empty states, sample data.

## Keyboard shortcuts

| Key                                    | Action                                       |
| -------------------------------------- | -------------------------------------------- |
| `N`                                    | New task                                     |
| `/`                                    | Search                                       |
| `J` / `K` or arrows                    | Select next / previous task                  |
| `Space` or `X`                         | Complete or reopen                           |
| `E` or `Enter`                         | Edit selected task                           |
| `Del`                                  | Delete selected task                         |
| `Alt` + arrows                         | Move the selected task                       |
| `Ctrl+Z`, `Ctrl+Shift+Z` (or `Ctrl+Y`) | Undo, redo                                   |
| `?`                                    | Show shortcuts                               |
| `Esc`                                  | Leave a field, clear search, clear selection |

Shortcuts pause while you type in a field, so `Ctrl+Z` still undoes your typing there.

## Try the schema migration

Open **Developer tools** in the right-hand panel and click **Load old-format (v1) data**. The page reloads, upgrades the data to the current version and shows a notice. The original is kept under the `taskboard:backup` key (see DevTools, Application, Local Storage).

## Project structure

```
index.html
css/        fonts, tokens (light and dark), base layout, components
js/
  main.js             controller: wires everything together
  state/              store, storage, migrations, selectors
  commands/           history (undo/redo, 20 actions), task-commands
  ui/                 render, dragdrop, shortcuts, toast
  utils/              url-state, debounce, highlight, dom, dates, id
  models/, data/      task model and validation, sample tasks
tests/                unit tests, plus tests/e2e for the browser test
assets/fonts/         Barlow (SIL Open Font License)
```

Data flows one way: input, then a command, then the store, then storage and the screen.

## Tests

```
npm test          # 26 unit tests with Node's built-in runner (Node 20 or newer)
npm run test:e2e  # 60 browser checks; one-time setup below
```

For the browser test: `npm install --save-dev playwright` and `npx playwright install chromium`.

## Notes and limits

- Undo history is kept in memory and resets on reload.
- Two open tabs do not sync with each other.
- Task text is rendered with DOM calls (never `innerHTML`), so markup typed into a task is shown as text.
