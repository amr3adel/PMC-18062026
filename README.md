# Personal Task Manager

A standalone, single-user task management dashboard built with vanilla JavaScript, HTML, and CSS. It runs without a backend and persists all data in `localStorage`.

## How to run

Open `index.html` in a modern browser.

No build step, package install, API key, or server is required. If you prefer serving it locally, any static file server works:

```bash
python -m http.server 8000
```

Then open `http://localhost:8000`.

## Views

- **Kanban**: Four-column task workflow for Backlog, To Do, In Progress, and Done. Task cards can be dragged between columns. The Backlog column includes sorting by priority, due date, or creation date, plus priority and tag filtering.
- **Calendar**: Monthly calendar showing due tasks and scheduled tasks. Solid chips represent due dates, dashed chips represent scheduled work, and combined chips indicate tasks due and scheduled on the same day.
- **Weekly**: Time-block planner from 08:00 to 22:00 in 30-minute slots. Drag unscheduled tasks from the sidebar into the week grid, or drag placed tasks to reschedule them.

## Profiles

The app creates a default **Personal** profile on first load. Use the profile controls in the top navigation to:

- Add a new profile with a name and accent color.
- Rename the active profile.
- Delete the active profile and its tasks.

Each profile has its own isolated task pool. Switching profiles filters every view to that profile only.

## Data storage

All state is stored in the browser under this single localStorage key:

```text
taskmanager_data
```

The stored schema is:

```json
{
  "profiles": [],
  "tasks": [],
  "activeProfileId": "uuid"
}
```

Theme preference is stored separately under `taskmanager_theme`.

## Notes

- This version is desktop-first with tablet support. On tablet widths, the weekly view shows a 3-day rolling view.
- The app uses native HTML5 drag and drop. A future enhancement could add drag-resize for precise duration editing in the weekly planner.
