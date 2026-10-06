import { afterEach, expect, test } from 'bun:test';
import { Database } from 'bun:sqlite';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { eq } from 'drizzle-orm';
import { backupUser } from './api.js';
import type { Config } from '../config.js';
import { ensureDb, getDb } from '../db/index.js';
import { collections, subjects } from '../db/schema.js';
import { exportJson, exportNdjson } from '../export.js';

const originalFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = originalFetch;
});

test('backfills saved subject summaries and stores new ones during backup and export', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'bangumi-subjects-'));
  const dbPath = join(directory, 'backup.sqlite');
  try {
    const legacy = new Database(dbPath, { create: true });
    legacy.exec(`
      CREATE TABLE collections (
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
    `);
    legacy
      .query(
        'INSERT INTO collections (collection_key, user_id, subject_id, raw) VALUES (?, ?, ?, ?)',
      )
      .run(
        '1:10',
        1,
        10,
        JSON.stringify({
          subject_id: 10,
          subject: {
            id: 10,
            type: 2,
            name: 'Saved title',
            name_cn: 'Saved translation',
            short_summary: 'Saved summary',
          },
        }),
      );
    legacy.close();

    const db = ensureDb(dbPath, 'https://bgm.tv');
    const saved = await db.select().from(subjects).where(eq(subjects.id, 10));
    expect(saved[0]).toMatchObject({
      id: 10,
      type: 2,
      title: 'Saved title',
      title_cn: 'Saved translation',
      summary: 'Saved summary',
      url: 'https://bgm.tv/subject/10',
      updated_at: null,
    });

    let latestTitle = 'New title';
    const fakeFetch = async (input: RequestInfo | URL): Promise<Response> => {
      const url = String(input);
      if (url.endsWith('/v0/users/tester')) {
        return Response.json({ id: 1, username: 'tester' });
      }
      if (url.includes('/collections?')) {
        return Response.json({
          data: [
            {
              subject_id: 20,
              subject: {
                id: 20,
                type: 1,
                name: latestTitle,
                name_cn: 'New translation',
                short_summary: 'New summary',
                images: { large: 'https://example.test/cover.jpg' },
              },
              type: 2,
              rate: 8,
            },
          ],
        });
      }
      return new Response('');
    };
    globalThis.fetch = Object.assign(fakeFetch, {
      preconnect: originalFetch.preconnect,
    });
    const config: Config = {
      apiBaseUrl: 'https://api.example.test',
      webBaseUrl: 'https://bgm.tv',
      openApiDistUrl: 'https://api.example.test/dist.json',
      dbPath,
      userAgent: 'bangumi-backup-test',
      politenessDelayMs: 0,
      collectionPageSize: 30,
      maxListPages: 2,
    };
    await backupUser('tester', { config });

    const newSubject = await getDb()
      .select()
      .from(subjects)
      .where(eq(subjects.id, 20));
    expect(newSubject[0]).toMatchObject({
      type: 1,
      title: 'New title',
      title_cn: 'New translation',
      summary: 'New summary',
      url: 'https://bgm.tv/subject/20',
    });
    expect(JSON.parse(newSubject[0]!.raw!)).toMatchObject({
      images: { large: 'https://example.test/cover.jpg' },
    });
    expect(
      await getDb()
        .select()
        .from(collections)
        .where(eq(collections.subject_id, 20)),
    ).toHaveLength(1);

    latestTitle = 'Updated title';
    await backupUser('tester', { config });
    expect(
      (await getDb().select().from(subjects).where(eq(subjects.id, 20)))[0]
        ?.title,
    ).toBe('Updated title');
    expect(await getDb().select().from(subjects)).toHaveLength(2);

    const jsonPath = join(directory, 'backup.json');
    const ndjsonPath = join(directory, 'backup.ndjson');
    await exportJson(jsonPath);
    await exportNdjson(ndjsonPath);
    expect(JSON.parse(readFileSync(jsonPath, 'utf8')).subjects).toHaveLength(2);
    expect(readFileSync(ndjsonPath, 'utf8')).toContain('"_type":"subject"');
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
