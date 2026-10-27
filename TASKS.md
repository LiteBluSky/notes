# Tasks

Work top to bottom. Tick a box (`- [x]`) in the same change that completes
it. Add new tasks under the right phase instead of doing unplanned work.

## 0. Scaffold (from the bookmarks app)

- [x] Copy the bookmarks project (TanStack Start, Nitro, SQLite/Drizzle,
      shadcn `base-nova`, ESLint/Prettier, scripts, Docker, CI)
- [x] Rename: package `notes`, default name "Notes", `data/notes.db`,
      `notes:` storage keys, port 8009, Scheduled Task `Notes`
- [x] Fresh `0000` migration: `folders` + `notes`

## 1. Server layer

- [x] Schemas: `noteInput` (optional title, markdown body), `moveInput`
      (`folder | note`), `notesFile` import/export format
- [x] `notes.server.ts` / `notes.functions.ts`: tree, folder + note CRUD,
      `viewNote` (view count + last opened), `moveTreeItem`, import

## 2. Tree UI (1:1 with bookmarks)

- [x] Folder/note tree, collapsible folders, hover row menus, drag and drop,
      move up/down, cut/paste, all vim motions, search
- [x] Notes listed by title, or a snippet of the body when untitled

## 3. Notes

- [x] Preview dialog: big title, gap, rendered markdown (GFM + line breaks)
- [x] Tick checklist boxes straight in the preview
- [x] Edit form (bigger dialog): title, folder, toolbar, monospace textarea
- [x] Editor keys: list continuation, Tab indent, Ctrl+B/I/K, Ctrl+Enter
- [x] Esc / click outside saves and closes; Cancel discards; blank new
      notes aren't created
- [x] Recent (1–4) + Most viewed (5–8) above the search, replacing
      favourites
- [x] Shortcuts help lists tree, preview and writing keys
- [x] Export the previewed note as a PDF (print dialog, Ctrl+P)

## 4. Installable app

- [x] Web manifest (server route, follows `VITE_APP_NAME`) + PNG icons
- [x] Service worker: offline read of the last-loaded notes
- [x] "Install app…" in the ⋮ menu (prompt on Android/desktop, hint on iOS)
- [ ] HTTPS on the LAN (e.g. `tailscale serve`) so phones can install it

## 5. Run on startup

- [x] Windows Scheduled Task on port 8009 (`scripts/install-startup.ps1`)
- [x] README: deploy steps for Docker, Windows, Linux, macOS, NixOS

## 6. Later (optional)

- [ ] Export a note / folder as `.md` files
- [ ] Optional seed script with a few nested folders/notes
