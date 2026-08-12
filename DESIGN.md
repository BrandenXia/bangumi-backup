# Bangumi Backup - DESIGN

Goal

- Provide a safe, minimal-pressure backup tool for Bangumi user data: collections, blog posts, user index (profile), and timeline.
- Use Bangumi API where possible (OpenAPI dist.json) and scrape minimally for timeline entries when API lacks coverage.
- Store data in SQLite via an ORM to keep data structured, versionable and queryable.

Principles

- Minimize requests and server load: cache responses, use conditional HTTP (ETag/If-None-Match, Last-Modified), and avoid per-episode scraping.
- Incremental updates: store lastFetched timestamps and use them to only update changed resources.
- Machine-friendly export: export backups as JSONL/NDJSON and optionally as JSON aggregates.
- Configurable and idempotent: running multiple times updates existing data rather than creating separate snapshots.

High-level components

- CLI (src/cli.ts)
  - Commands: init, backup user <username|id>, update, export, serve (optional)
  - Global config and per-run flags (--concurrency, --delay, --db-path)

- HTTP layer (src/http.ts)
  - Wrapper around fetch with retry, rate-limit backoff, and conditional request support (ETag, If-Modified-Since)
  - Central place to set default headers and user-agent

- Bangumi API client (src/bangumi/api.ts)
  - Loads/OpenAPI dist.json (configurable URL) and exposes typed helper functions for endpoints we need (collections, blog, user index)
  - Fall back to scraping when API endpoint absent (timeline)

- Scraper (src/bangumi/scraper.ts)
  - Minimal HTML scraping for timeline feed pages
  - Respect caching (store page ETag/last-html-hash) to avoid re-parsing unchanged pages

- Database / ORM layer (src/db/*)
  - Models: User, Collection, SubjectSummary, BlogPost, TimelineEntry, CacheEntry (url, etag, lastFetched, hash)
  - Use an ORM to avoid handwritten SQL; migrations planned through schema file

- Storage & Export (src/export.ts)
  - Export full backup to NDJSON (one record per line) and optionally as compressed archive

- Utilities
  - identity hashing, backoff/rate-limit helpers, small concurrency queue, and logging

Data model (excerpt)

- users: id, username, displayName, rawProfileJson, lastFetched
- collections: id, userId, subjectId, status, rating, comment, lastUpdated
- subjects: id, type, title, summary, url, updatedAt
- blog_posts: id, userId, title, contentHtml, publishedAt, rawJson
- timeline_entries: id, userId, sourceType, sourceId, contentHtml, createdAt
- cache_entries: url (primary), etag, lastModified, contentHash, lastFetched

Update strategy

- For API endpoints support conditional GET with ETag/Last-Modified. If 304, update timestamps only.
- For timeline scraping, compute a stable entry ID (e.g., hash of link + timestamp). Store latest page processed and stop at known items.
- Avoid per-episode collection detail updates by default. Allow an optional flag to fetch details on-demand.

Config

- ~/.config/bangumi-backup/config.json or ./bangumi-backup.config.json
- Fields: apiBaseUrl, openApiDistUrl, dbPath, userAgent, concurrency, politenessDelayMs

Rate-limiting and politeness

- Default delay between external requests (configurable, e.g., 250-1000ms)
- Exponential backoff on 429/5xx, jittered delays

Notes on extensibility

- Keep API client generation (from dist.json) separate so codegen can be added later
- Design DB schema to accommodate new entity types (comments, follows, etc.)

Open questions

- Which ORM to use: Prisma/Drizzle/TypeORM. Choose one during implementation with attention to bun compatibility.
  - Currently using Drizzle.
- Export formats to support beyond NDJSON (CSV, SQLite dump)

"Small-print" on scraping ethics

- Only collect data visible to an authenticated user (no private scraping)
- Honor rate limits and use conditional requests when possible

Roadmap (short)

1. Project scaffold, CLI and config
2. DB models and ORM setup
3. Bangumi API client (dist.json loader + small helpers)
4. Basic user backup: collections, blogs, profile
5. Timeline scraper with caching
6. Incremental update and export
7. Documentation and tests
