import { createHash } from 'node:crypto';

export type ParsedBlogItem = {
  id: number;
  title: string;
  summaryHtml: string;
  publishedAtMs: number | null;
};

export type ParsedIndexItem = {
  id: number;
  title: string;
  summaryHtml: string;
  updatedAtMs: number | null;
};

export type ParsedIndexEntry = {
  relationId: number;
  targetType: string;
  targetId: number;
  title: string;
  commentHtml: string | null;
  position: number;
  raw: string;
};

export type ParsedTimelineItem = {
  key: string;
  sourceId: string;
  title: string;
  descriptionHtml: string;
  publishedAtMs: number | null;
  raw: string;
};

function normalizeText(input: string): string {
  return input.replace(/\s+/g, ' ').trim();
}

function parseLocalDateTimeToMs(text: string): number | null {
  const cleaned = normalizeText(text)
    .replace(/[年月]/g, '-')
    .replace(/[日]/g, '');
  const value = Date.parse(cleaned.replace(/\//g, '-'));
  return Number.isFinite(value) ? value : null;
}

function parseRssDateToMs(text: string): number | null {
  const value = Date.parse(text);
  return Number.isFinite(value) ? value : null;
}

export function parseBlogList(html: string): ParsedBlogItem[] {
  const items: ParsedBlogItem[] = [];
  const itemRegex =
    /<h2 class="title"><a href="\/blog\/(\d+)" class="l">([\s\S]*?)<\/a><\/h2>[\s\S]*?<div class="content"><a href="\/blog\/\1">([\s\S]*?)<\/a><\/div>[\s\S]*?<div class="time">([\s\S]*?)<\/div>/g;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html))) {
    const id = Number(match[1]);
    const title = normalizeText(match[2]);
    const summaryHtml = match[3].trim();
    const publishedAtText =
      match[4].match(/(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/)?.[1] ?? '';
    const publishedAtMs = parseLocalDateTimeToMs(publishedAtText);

    items.push({ id, title, summaryHtml, publishedAtMs });
  }
  return items;
}

export function extractBlogDetailContent(html: string): string | null {
  const startMarker = '<div id="entry_content" class="content">';
  const startIndex = html.indexOf(startMarker);
  if (startIndex < 0) return null;

  const contentStart = startIndex + startMarker.length;
  let depth = 1;
  let cursor = contentStart;

  while (cursor < html.length) {
    const nextOpen = html.indexOf('<div', cursor);
    const nextClose = html.indexOf('</div>', cursor);

    if (nextClose < 0) break;
    if (nextOpen >= 0 && nextOpen < nextClose) {
      depth += 1;
      cursor = nextOpen + 4;
      continue;
    }

    depth -= 1;
    if (depth === 0) {
      return html.slice(contentStart, nextClose).trim();
    }
    cursor = nextClose + 6;
  }

  return null;
}

export function parseIndexList(html: string): ParsedIndexItem[] {
  const items: ParsedIndexItem[] = [];
  const itemRegex =
    /<li id="item_(\d+)"[\s\S]*?<a href="\/index\/\1" class="l">[\s\S]*?<h3>\s*([\s\S]*?)\s*<\/h3>[\s\S]*?<span class="time tip_i">([\s\S]*?)<span class="desc">([\s\S]*?)<\/span>/g;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(html))) {
    const id = Number(match[1]);
    const title = normalizeText(match[2]);
    const timeBlock = normalizeText(match[3].replace(/<[^>]+>/g, ' '));
    const summaryHtml = match[4].trim();
    const updatedAtText =
      timeBlock.match(/更新\s+(\d{4}-\d{1,2}-\d{1,2}\s+\d{1,2}:\d{2})/)?.[1] ??
      '';
    const updatedAtMs = parseLocalDateTimeToMs(updatedAtText);
    items.push({ id, title, summaryHtml, updatedAtMs });
  }
  return items;
}

export function extractIndexDetailContent(html: string): string {
  const lineDetail = html.match(
    /<div class="line_detail"[^>]*>\s*<span class="tip">([\s\S]*?)<\/span>\s*<\/div>/,
  )?.[1];
  return lineDetail?.trim() ?? '';
}

export function parseIndexEntries(html: string): ParsedIndexEntry[] {
  const listHtml =
    html.match(/<ul id="browserItemList"[^>]*>([\s\S]*?)<\/ul>/)?.[1] ?? '';
  const entries: ParsedIndexEntry[] = [];
  const itemRegex =
    /<li id="item_\d+"[^>]*attr-index-related="(\d+)"[^>]*>([\s\S]*?)(?=<li id="item_\d+"|$)/g;

  let match: RegExpExecArray | null;
  while ((match = itemRegex.exec(listHtml))) {
    const raw = match[2];
    const target = raw.match(
      /<a href="\/(subject|character|person|ep|blog)\/(\d+)"[^>]*class="[^"]*\bl\b[^"]*"[^>]*>([\s\S]*?)<\/a>/,
    );
    if (!target) continue;

    const comment = raw.match(
      /<div class="text_main_(?:even|odd)"><div class="text">([\s\S]*?)<\/div>/,
    )?.[1];
    entries.push({
      relationId: Number(match[1]),
      targetType: target[1],
      targetId: Number(target[2]),
      title: normalizeText(target[3].replace(/<[^>]+>/g, ' ')),
      commentHtml: comment?.trim() || null,
      position: entries.length,
      raw: match[0],
    });
  }
  return entries;
}

export function parseTimelineRss(xml: string): ParsedTimelineItem[] {
  const items: ParsedTimelineItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let itemMatch: RegExpExecArray | null;

  while ((itemMatch = itemRegex.exec(xml))) {
    const raw = itemMatch[1];
    const title = normalizeText(
      raw.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '',
    );
    const descriptionHtml = (
      raw.match(
        /<description>\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*<\/description>/,
      )?.[1] ?? ''
    ).trim();
    const pubDateText = normalizeText(
      raw.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '',
    );
    const sourceId = normalizeText(
      raw.match(/<guid[^>]*>([\s\S]*?)<\/guid>/)?.[1] ?? '',
    );
    const keySource = `${sourceId}|${pubDateText}|${title}`;
    const key = createHash('sha256').update(keySource).digest('hex');

    items.push({
      key,
      sourceId,
      title,
      descriptionHtml,
      publishedAtMs: parseRssDateToMs(pubDateText),
      raw,
    });
  }

  return items;
}
