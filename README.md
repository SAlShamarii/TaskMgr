# Task Manager

Super basic task manager. Created because my notebook ran out of pages and i didn't want to forget my tasks.

This is a browser-only kanban board I put together so I can toss tasks into it before they leave my brain. Open the page, drag stuff around, close the tab—your to-dos stay put thanks to localStorage.

## What It Helps With
- Personal and work boards that you can flip between without losing context.
- Ideas backlog for half-baked thoughts that might become actual tasks later.
- Cards with priorities, subtasks, comments, tags, dependencies, and timers (because sometimes we go overboard).
- Bulk actions when you need to clean house in a hurry.
- Dashboard stats, search, and filters so you can pretend you’re organized.
- Light and dark mode, plus import/export if you want backups.

## Quick Start
1. Clone or download this repo.
2. Open index.html in any modern browser (Chrome, Edge, Firefox, Safari). No builds, no servers.
3. Prefer a single-file version? taskmgr.html bundles everything for quick tinkering.

## Everyday Use
- **Add ideas:** Dump them in the Ideas Backlog and drag them onto the board when they’re real.
- **Move stuff around:** Drag cards between columns or inside a column to reorder.
- **Fill in details:** Subtasks, comments, tags—you know the drill.
- **Bulk actions:** Select a few tasks to delete, archive, mark done, or crank their priority.
- **Stay focused:** Use search, priority, and tag filters; the dashboard updates live.
- **Tweak the flow:** Add new columns or remove ones you don’t need (it’ll prompt you to rehome tasks first).

## Data & Privacy
- Everything lives in your browser under keys like taskmgr-tasks, taskmgr-ideas, and taskmgr-columns.
- Hit "Clear All" from the app to reset things, or nuke the keys manually with:

  ['taskmgr-tasks','taskmgr-task-counter','taskmgr-ideas','taskmgr-idea-counter','taskmgr-columns']
    .forEach(key => localStorage.removeItem(key));

- Export/import gives you a JSON backup when you need one.

## File Map
- index.html – main board with external CSS/JS.
- styles.css – layout, themes, and component styles.
- script.js – drag-and-drop logic, storage, and rendering.
- taskmgr.html – same app, but all-in-one file.

Fork it, remix it, or just use it as-is when you run out of notebook pages too.
