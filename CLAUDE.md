# Notes

A personal, local-only notes app. The display name is configurable
(`VITE_APP_NAME`, default "Notes", read via `APP_NAME` in
`src/lib/config.ts`) — never hardcode a product name in UI, titles or
storage keys. It runs on the owner's machine or home server (Windows
natively, or Docker on any OS / NixOS), serves on `http://localhost:8009`,
and does one thing: store notes (markdown), organised into folders and
subfolders, shown as a file tree. It's a sibling of the bookmarks app
(`../bookmarks`, port 8008): same stack, same design, same keyboard model —
keep them looking and behaving alike.

Keep it **clean, minimal and to the point**: open → write → close, with as
little friction as possible. No accounts, no sync, no tags, no analytics,
no rich-text editor. If a feature isn't about writing, organising or reading
notes, it doesn't belong here.

Work is tracked in [`TASKS.md`](./TASKS.md) — read it first, pick the next
unchecked task, and tick it off (`- [x]`) in the same change that completes
it. Add new tasks there rather than doing unplanned work.

## Stack

| Concern       | Choice                                                            |
| ------------- | ----------------------------------------------------------------- |
| Framework     | TanStack Start (React 19, file-based routing, server functions)   |
| Server output | Nitro (node) → `.output/server/index.mjs`                         |
| DB            | SQLite (one file) via `@libsql/client`                            |
| ORM           | Drizzle (`drizzle-orm/libsql`, `drizzle-kit`)                     |
| Data fetching | TanStack Query (SSR-integrated via `router-ssr-query`)            |
| Forms         | TanStack Form + Zod                                               |
| UI            | shadcn/ui (`base-nova`, **Base UI** engine) + Tailwind v4, lucide |
| Markdown      | `react-markdown` + `remark-gfm` + `remark-breaks`, typography     |
| Installable   | Web manifest (server route) + `public/sw.js` service worker       |
| Tooling       | pnpm, ESLint (`@tanstack/eslint-config`), Prettier, TypeScript    |

### UI: always use shadcn components

**Use a shadcn component whenever one fits** — never hand-roll a styled
`div`/`span`/`button` for something shadcn provides. Follow the shadcn skill
(`.claude/skills/shadcn/`) and its rules; the ones that bite most here:

- It's the **Base UI** flavour: custom triggers use `render={<Button />}`
  (not `asChild`); a `Button` rendering an `<a>` needs `nativeButton={false}`;
  `Select` takes an `items` prop and a `{ value: null }` item for "none".
- Check `src/components/ui/` before adding; add with
  `pnpm dlx shadcn@latest add <name>`; read `pnpm dlx shadcn@latest docs <name>`
  when unsure of an API.
- Forms: `FieldGroup` + `Field` + `FieldLabel` + `FieldError`, with
  `data-invalid` on `Field` and `aria-invalid` on the control.
- Icons inside `Button` get `data-icon="inline-start|inline-end"`, no size
  classes. Semantic colour tokens only (`text-muted-foreground`, …), `gap-*`
  not `space-*`, `className` for layout only.
- Toasts: `toast.add({ title, type })` from `@/components/ui/toast` (Base UI
  toast manager; `<Toaster>` wraps the app in `__root.tsx`).
- `src/components/ui/**` is vendored shadcn source — excluded from ESLint and
  Prettier. Don't edit it for app-specific styling; compose around it.

## Data model (`src/db/schema.ts`)

- `folders` — `id`, `name`, `parentId` (self-reference, `null` = root),
  `position`, timestamps. Deleting a folder cascades to its subfolders and
  links.
- `notes` — `id`, `title` (`''` = untitled: lists show a snippet of the
  body via `noteLabel`), `body` (markdown), `folderId` (`null` = root),
  `position`, `viewCount` + `openedAt` (bumped by `viewNote` when a note's
  preview opens; drive "Recent" / "Most viewed"), timestamps. Recording a
  view or reordering keeps `updatedAt` (it means "edited").
- `position` orders siblings within the same parent (folders and notes are
  ordered separately; folders render before notes, like a file explorer).

The dataset is small (one person's notes), so the app loads **all folders
and notes, bodies included, in one server function** and builds the tree
client-side.
Don't add pagination or per-folder lazy loading unless it's actually slow.

## Architecture conventions

- **Server functions**: `src/server/notes.functions.ts` holds the
  `createServerFn` RPCs + `treeQueryOptions` (safe to import anywhere);
  `src/server/notes.server.ts` holds the Drizzle queries (server-only —
  import it only from `*.functions.ts`). Never import `@/db` from a component.
- Moving a folder is guarded server-side against cycles (into itself or a
  descendant); the folder picker also hides those options.
- Use `.validator(zodSchema)` on server functions — **not** the deprecated
  `.inputValidator()` (verified deprecated in the installed version).
- **Zod schemas are shared**: define them once in `src/lib/schemas.ts` and
  use the same schema for the TanStack Form validator and the server-function
  validator.
- **Query keys / options** live next to the server functions as
  `queryOptions(...)` factories (e.g. `treeQueryOptions`). Routes prefetch
  with `context.queryClient.ensureQueryData(...)` in `loader`; components
  read with `useSuspenseQuery`. Mutations invalidate the tree query.
- A route's `loader` must come **before** `component`/`head` in the options
  object or `Route.useLoaderData()` types collapse.
- Tree helpers (`buildTree`, `filterTree`, `flattenFolders`) are pure
  functions in `src/lib/tree.ts` (also `quickNotes`, `noteSnippet`,
  `noteLabel`). Textarea editing helpers (list continuation, wrap, indent,
  task toggling) are pure functions in `src/lib/markdown-edit.ts`, applied
  with `execCommand` so native undo keeps working. UI lives in
  `src/components/notes/`.
- In `beforeLoad`/loaders, always `throw redirect(...)`, never call it bare.
- Imports: `@/…` alias for `src/` (tsconfig `paths`, resolved by Vite via
  `tsconfigPaths`). Files run outside Vite (e.g.
  `drizzle.config.ts`) must use relative imports.
- SQLite: `src/db/index.ts` opens `DATABASE_PATH` (default
  `data/notes.db`, created if missing) and runs the `drizzle/`
  migrations on startup — no manual DB step on deploy. Schema change: edit
  `schema.ts`, `pnpm db:generate`, commit the migration.
- The running server locks `.output`'s native libsql binary, so
  `pnpm build` fails with `EPERM` while it's up: run `scripts/stop.ps1`
  first, then `install-startup.ps1` after.
- Don't rely on foreign-key cascades: SQLite needs a per-connection pragma
  that libsql doesn't keep, so `removeFolder` deletes descendants itself.
  Keep deletes of anything with children explicit like that.
- Name/title tie-breaks sort `collate nocase` (case-insensitive).
- No auth. The server listens on all interfaces, so it's reachable from the
  LAN. This is deliberate (the owner accepted it); don't change it
  unasked.

## UI

Single page (`src/routes/index.tsx`), laid out 1:1 like the bookmarks app:
header (New folder, New note, then a `ButtonGroup` of the ⋮ menu, shortcuts
help and theme menu; below 500px the buttons wrap under the title), the
Recent / Most viewed lists, search box, then the tree. Folders are
`Collapsible` rows (expanded state persisted in localStorage), each row has
a hover `DropdownMenu` (new note/subfolder here, open, edit/move, copy text,
move up/down, delete). Delete confirms in an `AlertDialog`. Theme:
Light/Dark/System dropdown (`src/lib/theme.ts`; an inline head script
applies it before first paint).

**Notes open in a dialog** (`editor-dialogs.tsx`; `EditorState` in
`editor.ts`), never a separate page:

- `mode: 'view'` — the preview: folder path + edited date, the title large,
  a gap, then the rendered markdown (`markdown.tsx`, `.markdown` styles in
  `styles.css`). Task boxes are clickable: `toggleTaskAt` flips `[ ]`/`[x]`
  at the list item's source offset and saves optimistically. Reads the note
  live from the tree query by id. `e` edits, `d` deletes. Export PDF /
  Ctrl+P prints just the note via the browser's "Save as PDF"
  (`note-print.tsx`: a print-only portal, always light, page titled after
  the note so it's the default file name).
- `mode: 'edit'` — `note-form.tsx`, the bookmarks link form scaled up
  (`sm:max-w-3xl`): Title (optional) + Folder, a formatting toolbar and a
  monospace textarea. Enter continues lists/checklists (Enter on an empty
  item ends the list), Tab/Shift+Tab indent, Ctrl+B/I/K bold/italic/link,
  Ctrl+Enter or Ctrl+S saves and shows the preview. **Esc / clicking
  outside saves and closes** (the form registers a save-on-close handler;
  Cancel discards). A blank new note is simply not created.

**Recent / Most viewed** (`quick-notes.tsx`, `quickNotes` in `tree.ts`):
4 most recently opened notes (keys `1`–`4`), then the 4 most opened ones not
already in Recent (`5`–`8`). Each row shows the title or a snippet, with the
same hover menu as the tree (`NoteMenu`). Opening a preview anywhere goes
through `openEditor` in `index.tsx`, which records the view; a new note
starts with one view.

**Import/export** (`import-export-menu.tsx`, the ⋮ menu): JSON file
`{ format: 1, folders: [{ name, folders, notes }], notes: [{ title?, body }] }`
— nested, no ids, no view counts. Export is built client-side
(`toNotesFile` in `src/lib/tree.ts`); import is validated by `notesFile`
(client and server) and **appended** after the existing top-level items in
one transaction — it never replaces or dedupes.

**Installable app (PWA)**: the manifest is a server route
(`src/routes/manifest[.]webmanifest.ts`, so the name follows
`VITE_APP_NAME`); icons are in `public/` (`icon-192/512.png`,
`icon-maskable-512.png`, `apple-touch-icon.png`, generated from the lucide
`notebook-pen` glyph like `favicon.svg`). `public/sw.js` is cache-first for
hashed `/assets/*` and network-first (falling back to cache) for everything
else, so the last-loaded page — notes included, since it's SSR'd — opens
offline, read-only. It's registered in production builds only
(`registerServiceWorker` in `use-install-app.ts`). The ⋮ menu's "Install
app…" uses `beforeinstallprompt` where offered, else shows how (iOS: Share →
Add to Home Screen). Install and the SW need a secure origin (https or
localhost) — plain http on the LAN works as a website only. Bump the cache
name in `sw.js` if its strategy changes.

**Drag and drop** (`src/components/notes/tree-dnd.tsx`) is native HTML5
DnD, no library. Folders and notes are ordered separately (folders always
first), so a folder drops before/after a folder or inside a folder; a note
drops before/after a note or inside a folder; a dashed zone at the bottom
moves to the top level. `resolveMove` turns a drop into
`{ kind, id, parentId, index }` (or null for invalid/no-op); the
`moveTreeItem` server fn rewrites sibling positions in a transaction and
`useMoveItem` applies it optimistically. Disabled while searching.

**Keyboard**

- Global (`src/lib/shortcuts.ts`): `Ctrl+K` search, `Ctrl+B` new note,
  `Ctrl+G` new folder (⌘ on macOS). Avoid browser-reserved combos
  (Ctrl+L/N/T/W/F) when adding more. Ignored when the event was already
  handled (`defaultPrevented`), so the editor can use Ctrl+B for bold.
- Tree, vim-style (`src/hooks/use-tree-keyboard.ts`): `j/k` down/up, `h`
  collapse / go to parent, `l` expand / into first child, `H` collapse all,
  `gg`/`G` first/last, `n`/`N` next/previous visible note (wraps),
  `o`/`Enter` open or toggle, `e`/`r` edit, `1`–`8` open a recent / most
  viewed note, `d` delete (hovered row, else focused; confirms first), `/`
  search, `q` clear the search. Arrow keys mirror hjkl. `x` cuts a note,
  `p` pastes it into the focused folder / after the focused note (top level
  if nothing focused), `Esc` cancels (`src/hooks/use-cut-note.ts`; sticky
  toast while cut). Rows opt in with `data-tree-item`, `data-kind`,
  `data-id`, `data-parent-id` on their focusable element, and
  `data-tree-row` on the hover area (row + its menu).
- `?` (or the header keyboard button) opens the shortcuts help
  (`src/components/notes/shortcuts-dialog.tsx`) — keep its list in sync
  when adding or changing a shortcut.
- In search: `Enter`/`↓` jumps to the first row, `Esc` clears.
- Tree keys are off while a dialog is open or while typing in a field.

## Commands

```bash
pnpm dev            # dev server on http://localhost:3000
pnpm build          # production build -> .output/
pnpm start          # run the built server (reads .env.local; PORT env, default 3000)
pnpm db:generate    # write a migration after editing schema.ts
pnpm db:migrate     # apply migrations (the server also does this on start)
pnpm db:studio      # browse data
pnpm typecheck      # tsc --noEmit
pnpm lint           # eslint
pnpm format         # prettier --write + eslint --fix
pnpm generate-routes
pnpm version:patch  # / version:minor / version:major — bump, commit, tag vX.Y.Z
```

After any nontrivial change run `pnpm typecheck && pnpm lint && pnpm build`.
Treat `eslint --fix` output as untrusted — re-run `typecheck` afterwards.

## Environment

See `.env.example`. Nothing is required; overrides (`DATABASE_PATH`,
`VITE_APP_NAME`) go in `.env.local` (gitignored). Don't put `PORT` in
`.env.local` — Vite picks it up and moves the dev server off 3000.
Production uses port 8009: on Windows it's set by `scripts/start.ps1`, run
at logon by a Scheduled Task (`scripts/install-startup.ps1` /
`uninstall-startup.ps1` / `stop.ps1`); in Docker by the `Dockerfile` (data
in the `/data` volume, runs as uid 1000). `.github/workflows/docker.yml`
publishes the image to `ghcr.io/liteblusky/notes` on every `v*` tag
(amd64 + arm64). Keep `.dockerignore` excluding `data/` and `.env*` so
personal data never lands in an image. Deploy steps for Docker, Windows,
Linux, macOS and NixOS are in the README — keep them in sync when changing
any of this.

## Skill loading (TanStack Intent)

Before substantial work on a TanStack library, check for version-matched
guidance shipped with the installed package:

```bash
pnpm dlx @tanstack/intent@latest list
pnpm dlx @tanstack/intent@latest load <package>#<skill>
```
