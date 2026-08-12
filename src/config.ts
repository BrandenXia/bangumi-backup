import { existsSync, readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';

export type Config = {
  apiBaseUrl: string;
  webBaseUrl: string;
  openApiDistUrl: string;
  dbPath: string;
  userAgent: string;
  politenessDelayMs: number;
  collectionPageSize: number;
  maxListPages: number;
};

const DEFAULT_CONFIG: Config = {
  apiBaseUrl: 'https://api.bgm.tv',
  webBaseUrl: 'https://bgm.tv',
  openApiDistUrl: 'https://bangumi.github.io/api/dist.json',
  dbPath: './bangumi-backup.sqlite',
  userAgent: 'bangumi-backup/0.1',
  politenessDelayMs: 300,
  collectionPageSize: 30,
  maxListPages: 20,
};

const CONFIG_FILES = [
  join(process.cwd(), 'bangumi-backup.config.json'),
  join(homedir(), '.config', 'bangumi-backup', 'config.json'),
];

function readJsonFile<T>(path: string): T | null {
  if (!existsSync(path)) return null;
  const content = readFileSync(path, 'utf8');
  return JSON.parse(content) as T;
}

export function loadConfig(): Config {
  let userConfig: Partial<Config> = {};

  for (const configPath of CONFIG_FILES) {
    const parsed = readJsonFile<Partial<Config>>(configPath);
    if (parsed) {
      userConfig = { ...userConfig, ...parsed };
    }
  }

  return { ...DEFAULT_CONFIG, ...userConfig };
}
