import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from 'drizzle-orm/sqlite-core';

export const users = sqliteTable(
  'users',
  {
    id: integer('id').primaryKey(),
    username: text('username').notNull(),
    display_name: text('display_name'),
    raw: text('raw'),
    last_fetched: integer('last_fetched'),
  },
  (table) => [uniqueIndex('users_username_uq').on(table.username)],
);

export const collections = sqliteTable(
  'collections',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    collection_key: text('collection_key').notNull(),
    user_id: integer('user_id').notNull(),
    subject_id: integer('subject_id').notNull(),
    status: text('status'),
    rating: integer('rating'),
    comment: text('comment'),
    updated_at: integer('updated_at'),
    raw: text('raw'),
  },
  (table) => [
    uniqueIndex('collections_collection_key_uq').on(table.collection_key),
    index('collections_user_id_idx').on(table.user_id),
  ],
);

export const blogPosts = sqliteTable(
  'blog_posts',
  {
    id: integer('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    title: text('title'),
    content_html: text('content_html'),
    published_at: integer('published_at'),
    raw: text('raw'),
  },
  (table) => [index('blog_posts_user_id_idx').on(table.user_id)],
);

export const userIndexes = sqliteTable(
  'user_indexes',
  {
    id: integer('id').primaryKey(),
    user_id: integer('user_id').notNull(),
    title: text('title'),
    content_html: text('content_html'),
    updated_at: integer('updated_at'),
    raw: text('raw'),
  },
  (table) => [index('user_indexes_user_id_idx').on(table.user_id)],
);

export const timelineEntries = sqliteTable(
  'timeline_entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    entry_key: text('entry_key').notNull(),
    user_id: integer('user_id').notNull(),
    source_type: text('source_type'),
    source_id: text('source_id'),
    content_html: text('content_html'),
    created_at: integer('created_at'),
    raw: text('raw'),
  },
  (table) => [
    uniqueIndex('timeline_entries_entry_key_uq').on(table.entry_key),
    index('timeline_entries_user_id_idx').on(table.user_id),
  ],
);

export const cacheEntries = sqliteTable('cache_entries', {
  url: text('url').primaryKey(),
  etag: text('etag'),
  last_modified: text('last_modified'),
  content_hash: text('content_hash'),
  last_fetched: integer('last_fetched'),
});
