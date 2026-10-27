import { relations } from 'drizzle-orm'
import {
  foreignKey,
  index,
  integer,
  sqliteTable,
  text,
} from 'drizzle-orm/sqlite-core'

const timestamps = {
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date())
    .$onUpdate(() => new Date()),
}

// A folder can nest inside another folder. parentId = null means root level.
// The foreign keys document the shape; SQLite doesn't enforce them here (see
// removeFolder for the cascade).
export const folders = sqliteTable(
  'folders',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    name: text().notNull(),
    parentId: integer('parent_id'),
    position: integer().notNull().default(0),
    ...timestamps,
  },
  (t) => [
    foreignKey({ columns: [t.parentId], foreignColumns: [t.id] }).onDelete(
      'cascade',
    ),
    index('folders_parent_idx').on(t.parentId),
  ],
)

// A note lives in a folder, or at root level when folderId = null. The title
// is optional (empty = show a snippet of the body); the body is markdown.
export const notes = sqliteTable(
  'notes',
  {
    id: integer().primaryKey({ autoIncrement: true }),
    title: text().notNull().default(''),
    body: text().notNull().default(''),
    folderId: integer('folder_id').references(() => folders.id, {
      onDelete: 'cascade',
    }),
    position: integer().notNull().default(0),
    // Bumped each time the note is opened: drive "Recent" and "Most viewed".
    viewCount: integer('view_count').notNull().default(0),
    openedAt: integer('opened_at', { mode: 'timestamp' }),
    ...timestamps,
  },
  (t) => [index('notes_folder_idx').on(t.folderId)],
)

export const foldersRelations = relations(folders, ({ one, many }) => ({
  parent: one(folders, {
    fields: [folders.parentId],
    references: [folders.id],
    relationName: 'folder_parent',
  }),
  children: many(folders, { relationName: 'folder_parent' }),
  notes: many(notes),
}))

export const notesRelations = relations(notes, ({ one }) => ({
  folder: one(folders, { fields: [notes.folderId], references: [folders.id] }),
}))

export type Folder = typeof folders.$inferSelect
export type NewFolder = typeof folders.$inferInsert
export type Note = typeof notes.$inferSelect
export type NewNote = typeof notes.$inferInsert
