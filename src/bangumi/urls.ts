export function buildApiUserUrl(apiBaseUrl: string, username: string): string {
  return `${apiBaseUrl}/v0/users/${encodeURIComponent(username)}`;
}

export function buildApiCollectionsUrl(
  apiBaseUrl: string,
  username: string,
  limit: number,
  offset: number,
): string {
  const params = new URLSearchParams({
    limit: String(limit),
    offset: String(offset),
  });
  return `${apiBaseUrl}/v0/users/${encodeURIComponent(username)}/collections?${params.toString()}`;
}

export function buildUserBlogUrl(
  webBaseUrl: string,
  username: string,
  page: number,
): string {
  const url = new URL(`/user/${encodeURIComponent(username)}/blog`, webBaseUrl);
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}

export function buildBlogDetailUrl(webBaseUrl: string, blogId: number): string {
  return new URL(`/blog/${blogId}`, webBaseUrl).toString();
}

export function buildUserIndexUrl(
  webBaseUrl: string,
  username: string,
  page: number,
): string {
  const url = new URL(
    `/user/${encodeURIComponent(username)}/index`,
    webBaseUrl,
  );
  if (page > 1) url.searchParams.set('page', String(page));
  return url.toString();
}

export function buildIndexDetailUrl(
  webBaseUrl: string,
  indexId: number,
): string {
  return new URL(`/index/${indexId}`, webBaseUrl).toString();
}

export function buildTimelineFeedUrl(
  webBaseUrl: string,
  username: string,
): string {
  return new URL(
    `/feed/user/${encodeURIComponent(username)}/timeline`,
    webBaseUrl,
  ).toString();
}
