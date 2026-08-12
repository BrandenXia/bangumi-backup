import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
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

function migrate(conn: Database): void {
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
}

export function ensureDb(path = './bangumi-backup.sqlite'): AppDb {
  if (dbInstance && sqliteInstance && dbPathInstance === path)
    return dbInstance;

  if (sqliteInstance) {
    sqliteInstance.close();
  }

  const conn = new Database(path, { create: true });
  migrate(conn);

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
