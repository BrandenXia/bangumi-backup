import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { subjectValues, type SubjectResponse } from '../bangumi/subjects.js';
import { loadConfig } from '../config.js';
import * as schema from './schema.js';

const SQLITE_COLUMN_NAME_KEY = 'name';

type ColumnInfo = Record<string, unknown>;
type AppDb = ReturnType<typeof drizzle<typeof schema>>;

let dbInstance: AppDb | null = null;
let sqliteInstance: Database | null = null;
let dbPathInstance: string | null = null;

function hasColumn(
  conn: Database,
  tableName: string,
  columnName: string,
): boolean {
  const rows = conn
    .query(`PRAGMA table_info(${tableName})`)
    .all() as ColumnInfo[];
  return rows.some((row) => row[SQLITE_COLUMN_NAME_KEY] === columnName);
}

function ensureColumn(
  conn: Database,
  tableName: string,
  columnDef: string,
  columnName: string,
): void {
  if (!hasColumn(conn, tableName, columnName)) {
    conn.exec(`ALTER TABLE ${tableName} ADD COLUMN ${columnDef};`);
  }
}

function migrate(conn: Database, webBaseUrl: string): void {
  conn.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY,
      username TEXT NOT NULL,
      display_name TEXT,
      raw TEXT,
      last_fetched INTEGER
    );
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_uq ON users(username);

    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      collection_key TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      subject_id INTEGER NOT NULL,
      status TEXT,
      rating INTEGER,
      comment TEXT,
      updated_at INTEGER,
      raw TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS collections_collection_key_uq ON collections(collection_key);
    CREATE INDEX IF NOT EXISTS collections_user_id_idx ON collections(user_id);

    CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY,
      type INTEGER,
      title TEXT,
      title_cn TEXT,
      summary TEXT,
      url TEXT,
      updated_at INTEGER,
      last_fetched INTEGER,
      raw TEXT
    );

    CREATE TABLE IF NOT EXISTS blog_posts (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      content_html TEXT,
      published_at INTEGER,
      raw TEXT
    );
    CREATE INDEX IF NOT EXISTS blog_posts_user_id_idx ON blog_posts(user_id);

    CREATE TABLE IF NOT EXISTS user_indexes (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL,
      title TEXT,
      content_html TEXT,
      updated_at INTEGER,
      raw TEXT
    );
    CREATE INDEX IF NOT EXISTS user_indexes_user_id_idx ON user_indexes(user_id);

    CREATE TABLE IF NOT EXISTS user_index_entries (
      relation_id INTEGER PRIMARY KEY,
      index_id INTEGER NOT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      title TEXT,
      comment_html TEXT,
      position INTEGER NOT NULL,
      raw TEXT
    );
    CREATE INDEX IF NOT EXISTS user_index_entries_index_id_idx ON user_index_entries(index_id);

    CREATE TABLE IF NOT EXISTS timeline_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_key TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      source_type TEXT,
      source_id TEXT,
      content_html TEXT,
      created_at INTEGER,
      raw TEXT
    );
    CREATE UNIQUE INDEX IF NOT EXISTS timeline_entries_entry_key_uq ON timeline_entries(entry_key);
    CREATE INDEX IF NOT EXISTS timeline_entries_user_id_idx ON timeline_entries(user_id);

    CREATE TABLE IF NOT EXISTS cache_entries (
      url TEXT PRIMARY KEY,
      etag TEXT,
      last_modified TEXT,
      content_hash TEXT,
      last_fetched INTEGER
    );
  `);

  ensureColumn(conn, 'collections', 'collection_key TEXT', 'collection_key');
  ensureColumn(conn, 'collections', 'raw TEXT', 'raw');
  ensureColumn(conn, 'timeline_entries', 'entry_key TEXT', 'entry_key');
  ensureColumn(conn, 'blog_posts', 'raw TEXT', 'raw');

  const missingSubjects = conn
    .query(
      `
      SELECT c.subject_id, c.raw
      FROM collections AS c
      LEFT JOIN subjects AS s ON s.id = c.subject_id
      WHERE s.id IS NULL AND c.raw IS NOT NULL
    `,
    )
    .all() as Array<{ subject_id: number; raw: string }>;
  if (missingSubjects.length > 0) {
    const insertSubject = conn.prepare(`
      INSERT OR IGNORE INTO subjects
        (id, type, title, title_cn, summary, url, updated_at, last_fetched, raw)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    conn.transaction(() => {
      for (const collection of missingSubjects) {
        try {
          const subject = (
            JSON.parse(collection.raw) as {
              subject?: SubjectResponse;
            }
          ).subject;
          if (!subject || subject.id !== collection.subject_id) continue;
          const values = subjectValues(subject, webBaseUrl);
          if (!values) continue;
          insertSubject.run(
            values.id,
            values.type,
            values.title,
            values.title_cn,
            values.summary,
            values.url,
            values.updated_at,
            values.last_fetched,
            values.raw,
          );
        } catch (error) {
          if (!(error instanceof SyntaxError)) throw error;
        }
      }
    })();
  }
}

export function ensureDb(
  path = './bangumi-backup.sqlite',
  webBaseUrl = loadConfig().webBaseUrl,
): AppDb {
  if (dbInstance && sqliteInstance && dbPathInstance === path)
    return dbInstance;

  if (sqliteInstance) {
    sqliteInstance.close();
  }

  const conn = new Database(path, { create: true });
  migrate(conn, webBaseUrl);

  sqliteInstance = conn;
  dbPathInstance = path;
  dbInstance = drizzle(conn, { schema });
  return dbInstance;
}

export function getDb(): AppDb {
  if (!dbInstance) {
    throw new Error('Database is not initialized. Call ensureDb() first.');
  }
  return dbInstance;
}
