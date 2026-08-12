import { and, eq, inArray } from 'drizzle-orm';
import type { Config } from '../config.js';
import { loadConfig } from '../config.js';
import { getDb } from '../db/index.js';
import {
  blogPosts,
  cacheEntries,
  collections,
  timelineEntries,
  userIndexes,
  users,
} from '../db/schema.js';
import { fetchText } from '../http.js';
import {
  extractBlogDetailContent,
  extractIndexDetailContent,
  parseBlogList,
  parseIndexList,
  parseTimelineRss,
} from './scraper.js';
import {
  buildApiCollectionsUrl,
  buildApiUserUrl,
  buildBlogDetailUrl,
  buildIndexDetailUrl,
  buildTimelineFeedUrl,
  buildUserBlogUrl,
  buildUserIndexUrl,
} from './urls.js';

type BackupOptions = {
  config?: Config;
};

type CacheRow = {
  url: string;
  etag: string | null;
  last_modified: string | null;
  content_hash: string | null;
  last_fetched: number | null;
};

type UserProfileResponse = {
  id: number;
  username: string;
  nickname?: string;
};

type CollectionResponse = {
  data: Array<{
    updated_at?: string;
    type?: number;
    rate?: number;
    comment?: string | null;
    tags?: string[];
    subject?: {
      id: number;
    };
  }>;
};

async function getCache(url: string): Promise<CacheRow | null> {
  const db = getDb();
  const rows = await db
    .select()
    .from(cacheEntries)
    .where(eq(cacheEntries.url, url))
    .limit(1);
  return rows[0] ?? null;
}

async function updateCache(
  url: string,
  responseHeaders: Headers,
  contentHash: string | null,
  previous: CacheRow | null,
): Promise<void> {
  const db = getDb();
  await db
    .insert(cacheEntries)
    .values({
      url,
      etag: responseHeaders.get('etag') ?? previous?.etag ?? null,
      last_modified:
        responseHeaders.get('last-modified') ?? previous?.last_modified ?? null,
      content_hash: contentHash ?? previous?.content_hash ?? null,
      last_fetched: Date.now(),
    })
    .onConflictDoUpdate({
      target: cacheEntries.url,
      set: {
        etag: responseHeaders.get('etag') ?? previous?.etag ?? null,
        last_modified:
          responseHeaders.get('last-modified') ??
          previous?.last_modified ??
          null,
        content_hash: contentHash ?? previous?.content_hash ?? null,
        last_fetched: Date.now(),
      },
    });
}

async function fetchCachedText(
  url: string,
  config: Config,
  forceFresh = false,
): Promise<{ status: number; body: string | null }> {
  const cache = forceFresh ? null : await getCache(url);
  const result = await fetchText(url, {
    cache: cache
      ? { etag: cache.etag, lastModified: cache.last_modified }
      : null,
    userAgent: config.userAgent,
    politenessDelayMs: config.politenessDelayMs,
  });
  await updateCache(url, result.headers, result.contentHash, cache);
  return { status: result.status, body: result.body };
}

function extractUsername(
  userInput: string,
  profile: UserProfileResponse,
): string {
  return profile.username || userInput;
}

function parseCollectionUpdatedAt(value?: string): number | null {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

export async function loadOpenApiDist(url?: string): Promise<unknown> {
  const cfg = loadConfig();
  const distUrl = url ?? cfg.openApiDistUrl;
  const response = await fetch(distUrl, {
    headers: {
      'User-Agent': cfg.userAgent,
    },
  });
  if (!response.ok)
    throw new Error(`Failed to fetch OpenAPI dist: ${response.status}`);
  return response.json();
}

async function backupUserProfile(
  userInput: string,
  config: Config,
): Promise<UserProfileResponse | null> {
  const db = getDb();
  const userUrl = buildApiUserUrl(config.apiBaseUrl, userInput);
  const result = await fetchCachedText(userUrl, config);
  if (result.status === 304) {
    const existing = await db
      .select()
      .from(users)
      .where(eq(users.username, userInput))
      .limit(1);
    if (existing[0]) {
      return {
        id: existing[0].id,
        username: existing[0].username,
        nickname: existing[0].display_name ?? undefined,
      };
    }
    return null;
  }
  if (result.status < 200 || result.status >= 300 || !result.body) return null;

  const payload = JSON.parse(result.body) as UserProfileResponse;
  await db
    .insert(users)
    .values({
      id: payload.id,
      username: payload.username,
      display_name: payload.nickname ?? null,
      raw: JSON.stringify(payload),
      last_fetched: Date.now(),
    })
    .onConflictDoUpdate({
      target: users.id,
      set: {
        username: payload.username,
        display_name: payload.nickname ?? null,
        raw: JSON.stringify(payload),
        last_fetched: Date.now(),
      },
    });

  return payload;
}

async function backupCollections(
  username: string,
  userId: number,
  config: Config,
): Promise<void> {
  const db = getDb();
  const pageSize = config.collectionPageSize;
  const maxPages = config.maxListPages;

  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const url = buildApiCollectionsUrl(
      config.apiBaseUrl,
      username,
      pageSize,
      offset,
    );
    const result = await fetchCachedText(url, config);

    if (result.status === 304) continue;
    if (result.status < 200 || result.status >= 300 || !result.body) break;

    const payload = JSON.parse(result.body) as CollectionResponse;
    const rows = payload.data ?? [];
    if (rows.length === 0) break;

    for (const row of rows) {
      if (!row.subject?.id) continue;
      const collectionKey = `${userId}:${row.subject.id}`;
      await db
        .insert(collections)
        .values({
          collection_key: collectionKey,
          user_id: userId,
          subject_id: row.subject.id,
          status: row.type ? String(row.type) : null,
          rating: row.rate ?? null,
          comment: row.comment ?? null,
          updated_at: parseCollectionUpdatedAt(row.updated_at),
          raw: JSON.stringify(row),
        })
        .onConflictDoUpdate({
          target: collections.collection_key,
          set: {
            status: row.type ? String(row.type) : null,
            rating: row.rate ?? null,
            comment: row.comment ?? null,
            updated_at: parseCollectionUpdatedAt(row.updated_at),
            raw: JSON.stringify(row),
          },
        });
    }

    if (rows.length < pageSize) break;
  }
}

async function backupBlogs(
  username: string,
  userId: number,
  config: Config,
): Promise<void> {
  const db = getDb();
  for (let page = 1; page <= config.maxListPages; page += 1) {
    const pageUrl = buildUserBlogUrl(config.webBaseUrl, username, page);
    const pageResult = await fetchCachedText(pageUrl, config);
    if (
      pageResult.status !== 304 &&
      (!pageResult.body || pageResult.status >= 400)
    )
      break;
    if (!pageResult.body) break;

    const list = parseBlogList(pageResult.body);
    if (list.length === 0) break;
    const existingRows = await db
      .select({
        id: blogPosts.id,
        content_html: blogPosts.content_html,
        raw: blogPosts.raw,
      })
      .from(blogPosts)
      .where(
        inArray(
          blogPosts.id,
          list.map((item) => item.id),
        ),
      );
    const existingById = new Map(existingRows.map((row) => [row.id, row]));

    for (const item of list) {
      let contentHtml = item.summaryHtml;
      let rawPayload: string = JSON.stringify({
        source: 'blog-list',
        summaryHtml: item.summaryHtml,
      });

      const existing = existingById.get(item.id);
      const looksTruncated =
        existing?.content_html?.trim().endsWith('...') ?? false;
      const listSourceOnly = existing?.raw?.includes('"source":"blog-list"');
      const needsDetail = !existing || looksTruncated || listSourceOnly;

      if (needsDetail) {
        const detailUrl = buildBlogDetailUrl(config.webBaseUrl, item.id);
        const detailResult = await fetchCachedText(detailUrl, config, true);
        if (
          detailResult.body &&
          detailResult.status >= 200 &&
          detailResult.status < 300
        ) {
          contentHtml =
            extractBlogDetailContent(detailResult.body) ?? detailResult.body;
          rawPayload = detailResult.body;
        }
      }

      await db
        .insert(blogPosts)
        .values({
          id: item.id,
          user_id: userId,
          title: item.title,
          content_html: contentHtml,
          published_at: item.publishedAtMs,
          raw: rawPayload,
        })
        .onConflictDoUpdate({
          target: blogPosts.id,
          set: {
            title: item.title,
            content_html: contentHtml,
            published_at: item.publishedAtMs,
            raw: rawPayload,
          },
        });
    }

    const hasNext = pageResult.body.includes(`?page=${page + 1}`);
    const allKnown = list.every((item) => existingById.has(item.id));
    if (!hasNext || allKnown) break;
  }
}

async function backupIndexes(
  username: string,
  userId: number,
  config: Config,
): Promise<void> {
  const db = getDb();
  for (let page = 1; page <= config.maxListPages; page += 1) {
    const pageUrl = buildUserIndexUrl(config.webBaseUrl, username, page);
    const pageResult = await fetchCachedText(pageUrl, config);
    if (
      pageResult.status !== 304 &&
      (!pageResult.body || pageResult.status >= 400)
    )
      break;
    if (!pageResult.body) break;

    const list = parseIndexList(pageResult.body);
    if (list.length === 0) break;
    const existingRows = await db
      .select({ id: userIndexes.id })
      .from(userIndexes)
      .where(
        inArray(
          userIndexes.id,
          list.map((item) => item.id),
        ),
      );
    const existingIds = new Set(existingRows.map((row) => row.id));

    for (const item of list) {
      let contentHtml = item.summaryHtml;
      let rawPayload: string = JSON.stringify({
        source: 'index-list',
        summaryHtml: item.summaryHtml,
      });

      if (!existingIds.has(item.id)) {
        const detailUrl = buildIndexDetailUrl(config.webBaseUrl, item.id);
        const detailResult = await fetchCachedText(detailUrl, config);
        if (
          detailResult.body &&
          detailResult.status >= 200 &&
          detailResult.status < 300
        ) {
          contentHtml = extractIndexDetailContent(detailResult.body);
          rawPayload = detailResult.body;
        }
      }

      await db
        .insert(userIndexes)
        .values({
          id: item.id,
          user_id: userId,
          title: item.title,
          content_html: contentHtml,
          updated_at: item.updatedAtMs,
          raw: rawPayload,
        })
        .onConflictDoUpdate({
          target: userIndexes.id,
          set: {
            title: item.title,
            content_html: contentHtml,
            updated_at: item.updatedAtMs,
            raw: rawPayload,
          },
        });
    }

    const hasNext = pageResult.body.includes(`?page=${page + 1}`);
    const allKnown = list.every((item) => existingIds.has(item.id));
    if (!hasNext || allKnown) break;
  }
}

async function backupTimeline(
  username: string,
  userId: number,
  config: Config,
): Promise<void> {
  const db = getDb();
  const feedUrl = buildTimelineFeedUrl(config.webBaseUrl, username);
  const feedResult = await fetchCachedText(feedUrl, config);
  if (!feedResult.body || feedResult.status < 200 || feedResult.status >= 300)
    return;

  const items = parseTimelineRss(feedResult.body);
  if (items.length === 0) return;

  const keys = items.map((item) => item.key);
  const existingRows = await db
    .select({ entry_key: timelineEntries.entry_key })
    .from(timelineEntries)
    .where(
      and(
        eq(timelineEntries.user_id, userId),
        inArray(timelineEntries.entry_key, keys),
      ),
    );
  const existing = new Set(existingRows.map((row) => row.entry_key));

  for (const item of items) {
    if (existing.has(item.key)) continue;
    await db.insert(timelineEntries).values({
      entry_key: item.key,
      user_id: userId,
      source_type: 'timeline-rss',
      source_id: item.sourceId,
      content_html: item.descriptionHtml || item.title,
      created_at: item.publishedAtMs,
      raw: item.raw,
    });
  }
}

export async function backupUser(
  user: string | number,
  options: BackupOptions = {},
): Promise<void> {
  const config = options.config ?? loadConfig();
  const userInput = String(user);
  const profile = await backupUserProfile(userInput, config);
  if (!profile) {
    throw new Error(`Cannot fetch user profile for "${userInput}"`);
  }

  const username = extractUsername(userInput, profile);
  await backupCollections(username, profile.id, config);
  await backupBlogs(username, profile.id, config);
  await backupIndexes(username, profile.id, config);
  await backupTimeline(username, profile.id, config);
}
