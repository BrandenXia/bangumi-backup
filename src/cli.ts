#!/usr/bin/env bun
import { Command } from '@commander-js/extra-typings';
import { backupUser } from './bangumi/api.js';
import { loadConfig } from './config.js';
import { ensureDb } from './db/index.js';
import { exportJson, exportNdjson } from './export.js';

const program = new Command()
  .name('bangumi-backup')
  .description('Backup Bangumi user collections, blog, index, and timeline')
  .version('0.1.0');

program
  .command('init')
  .description('Initialize local sqlite database')
  .option('--db <path>', 'sqlite database path')
  .action((options) => {
    const config = loadConfig();
    const dbPath = options.db ?? config.dbPath;
    ensureDb(dbPath);
    console.log(`Initialized database at ${dbPath}`);
  });

program
  .command('backup')
  .description('Backup one Bangumi user')
  .argument('<user>', 'username or numeric user id')
  .option('--db <path>', 'sqlite database path')
  .action(async (user, options) => {
    const config = loadConfig();
    const dbPath = options.db ?? config.dbPath;
    ensureDb(dbPath);
    await backupUser(user, { config: { ...config, dbPath } });
    console.log(`Backup completed for ${user}`);
  });

program
  .command('update')
  .description('Alias of backup')
  .argument('<user>', 'username or numeric user id')
  .option('--db <path>', 'sqlite database path')
  .action(async (user, options) => {
    const config = loadConfig();
    const dbPath = options.db ?? config.dbPath;
    ensureDb(dbPath);
    await backupUser(user, { config: { ...config, dbPath } });
    console.log(`Update completed for ${user}`);
  });

program
  .command('export')
  .description('Export current backup as NDJSON or JSON aggregate')
  .option('--db <path>', 'sqlite database path')
  .option('--out <path>', 'output file path', './bangumi-backup.ndjson')
  .option('--format <format>', 'ndjson or json', 'ndjson')
  .action(async (options) => {
    const config = loadConfig();
    const dbPath = options.db ?? config.dbPath;
    ensureDb(dbPath);
    if (options.format === 'json') {
      await exportJson(options.out);
    } else {
      await exportNdjson(options.out);
    }
    console.log(`Exported backup to ${options.out}`);
  });

program.parse();
