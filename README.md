# bangumi-backup

A backup script for [Bangumi](https://bgm.tv).

## Goals

- Establish a local backup of user's Bangumi data that updates on periodic runs
  - Current content includes: subject collections, blogs, user-created indexes
    (curated lists), profiles, and timeline entries
- Minimize pressure on Bangumi server during regular backup
  - Use incremental updates and conditional requests to avoid unnecessary data
    fetching as much as possible
- The local data should be structured and extendable, so that it can become a
  foundation of local data storage if necessary in the future.

Collection backups also store the subject summaries supplied by the collections API
in a separate `subjects` table and include them in JSON and NDJSON exports. Existing
databases populate this table from saved collection data on the next command run.
These summaries are not full subject detail records.

## Usage

```bash
bun install
bun run start
```

and follow the instructions given by the CLI.
