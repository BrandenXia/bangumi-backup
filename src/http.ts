import { createHash } from 'node:crypto';

export type CachedRequestState = {
  etag?: string | null;
  lastModified?: string | null;
};

export type FetchResult = {
  status: number;
  headers: Headers;
  body: string | null;
  contentHash: string | null;
};

function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchText(
  url: string,
  options: {
    method?: string;
    headers?: HeadersInit;
    cache?: CachedRequestState | null;
    userAgent: string;
    politenessDelayMs?: number;
  },
): Promise<FetchResult> {
  const headers = new Headers(options.headers ?? {});
  headers.set('User-Agent', options.userAgent);
  if (options.cache?.etag) headers.set('If-None-Match', options.cache.etag);
  if (options.cache?.lastModified) headers.set('If-Modified-Since', options.cache.lastModified);

  await sleep(options.politenessDelayMs ?? 0);
  const response = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
  });

  if (response.status === 304) {
    return {
      status: response.status,
      headers: response.headers,
      body: null,
      contentHash: null,
    };
  }

  const body = await response.text();
  return {
    status: response.status,
    headers: response.headers,
    body,
    contentHash: createHash('sha256').update(body).digest('hex'),
  };
}
