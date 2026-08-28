import { createWriteStream } from 'node:fs';
import { getDb } from './db/index.js';
import {
  blogPosts,
  cacheEntries,
  collections,
  timelineEntries,
  userIndexEntries,
  userIndexes,
  users,
} from './db/schema.js';

type RecordType =
  | 'user'
  | 'collection'
  | 'blog_post'
  | 'user_index'
  | 'user_index_entry'
  | 'timeline_entry'
  | 'cache_entry';

function writeRecord(
  stream: ReturnType<typeof createWriteStream>,
  type: RecordType,
  data: unknown,
): void {
  stream.write(`${JSON.stringify({ _type: type, data })}\n`);
}

export async function exportNdjson(
  outputPath = './bangumi-backup.ndjson',
): Promise<void> {
  const db = getDb();
  const stream = createWriteStream(outputPath, { flags: 'w' });

  const usersRows = await db.select().from(users);
  for (const row of usersRows) writeRecord(stream, 'user', row);

  const collectionRows = await db.select().from(collections);
  for (const row of collectionRows) writeRecord(stream, 'collection', row);

  const blogRows = await db.select().from(blogPosts);
  for (const row of blogRows) writeRecord(stream, 'blog_post', row);

  const indexRows = await db.select().from(userIndexes);
  for (const row of indexRows) writeRecord(stream, 'user_index', row);

  const indexEntryRows = await db.select().from(userIndexEntries);
  for (const row of indexEntryRows)
    writeRecord(stream, 'user_index_entry', row);

  const timelineRows = await db.select().from(timelineEntries);
  for (const row of timelineRows) writeRecord(stream, 'timeline_entry', row);

  const cacheRows = await db.select().from(cacheEntries);
  for (const row of cacheRows) writeRecord(stream, 'cache_entry', row);

  await new Promise<void>((resolve, reject) => {
    stream.end(() => resolve());
    stream.on('error', reject);
  });
}

export async function exportJson(
  outputPath = './bangumi-backup.json',
): Promise<void> {
  const db = getDb();
  const data = {
    users: await db.select().from(users),
    collections: await db.select().from(collections),
    blog_posts: await db.select().from(blogPosts),
    user_indexes: await db.select().from(userIndexes),
    user_index_entries: await db.select().from(userIndexEntries),
    timeline_entries: await db.select().from(timelineEntries),
    cache_entries: await db.select().from(cacheEntries),
  };

  await Bun.write(outputPath, `${JSON.stringify(data, null, 2)}\n`);
}
