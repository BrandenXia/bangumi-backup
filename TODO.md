# TODO

Priority: High

- [x] Initialize bun project (package.json, bun.lock as-needed)
- [x] Add TypeScript config (tsconfig.json)
- [x] Add Prettier config (.prettierrc)
- [x] Add .gitignore
- [x] Install dependencies: commander, @commander-js/extra-typings, chosen ORM (decide), sqlite3/better-sqlite3 or driver compatible with ORM
- [x] Implement CLI skeleton (src/cli.ts) with commands: init, backup, update, export
- [x] Implement HTTP wrapper with conditional GET support (src/http.ts)
- [x] Implement Bangumi API client (src/bangumi/api.ts) that can load dist.json (configurable URL)
- [x] Implement timeline scraper (src/bangumi/scraper.ts) that can fetch and parse /feed/user/<id>/timeline
- [x] Design and implement DB schema with ORM (src/db/schema or src/db/models)
- [x] Implement backup flow for user: profile, collections, blog posts, timeline
- [x] Implement caching (cache_entries table) for conditional requests and page hashes
- [x] Implement incremental update (merge new/changed entries into DB)
- [x] Implement export to NDJSON and JSON aggregate formats
- [ ] The term "index" is currently misinterpreted in places like `DESIGN.md` and therefore not currently implemented. It's not user profile, but a list of collections that the user created.

Priority: Medium

- [ ] Add tests for HTTP conditional requests and caching
- [ ] Add logging and adjustable verbosity
- [ ] Add retry/backoff and politeness delay configuration
- [ ] Add option to fetch subject details (disabled by default)
- [ ] Implement a lightweight server (serve) to browse backups locally (optional)

Priority: Low / Future

- [ ] Add authentication support (cookie/session) if needed for private content
- [ ] Add cloud upload capability (S3, GDrive)
- [ ] Add full subject episode-level backup (opt-in)
- [ ] Add configurable schedule (cron-like)

Notes

- Keep scraping minimal and use conditional requests to avoid duplicate downloads.
- Prefer an ORM for DB interactions to simplify migrations and type-safety.
- Avoid hardcoding API endpoints; use config values and the OpenAPI dist.json url as canonical source.

Next immediate action

- Add test coverage for parsers/caching and retry/backoff behavior.
- Add optional authentication support for backing up non-public content.
