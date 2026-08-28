import { describe, expect, test } from 'bun:test';
import {
  extractIndexDetailContent,
  parseIndexEntries,
  parseIndexList,
} from './scraper.js';

describe('Bangumi user-created indexes', () => {
  test('parses indexes from a user index page', () => {
    const html = `
      <li id="item_93697" class="clearit tml_item index-item">
        <a href="/index/93697" class="l"><h3> Example index </h3></a>
        <span class="time tip_i">
          创建 <span class="tip_j">2026-2-9 10:26</span> ·
          更新 <span class="tip_j">2026-2-9 11:35</span>
        </span>
        <span class="desc">A curated list of subjects.</span>
      </li>`;

    const result = parseIndexList(html);
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: 93697,
      title: 'Example index',
      summaryHtml: 'A curated list of subjects.',
    });
    expect(result[0]?.updatedAtMs).toBe(Date.parse('2026-02-09 11:35'));
  });

  test('extracts the description rather than storing the entire detail page as content', () => {
    const html = `
      <div class="grp_box clearit">
        <div class="clearit">
          <a class="avatar"></a>
          <div class="line_detail" style="padding-left:60px;">
            <span class="tip">First line<br />Second line</span>
          </div>
        </div>
      </div>
      <ul id="browserItemList"><li id="item_1">subject</li></ul>`;

    expect(extractIndexDetailContent(html)).toBe('First line<br />Second line');
  });

  test('parses the ordered entries contained in an index', () => {
    const html = `
      <ul id="browserItemList" class="browserFull browser-list browser-index">
        <li id="item_328609" class="item odd clearit" attr-index-related="1919813">
          <div class="inner"><h3><a href="/subject/328609" class="l">ぼっち・ざ・ろっく！</a></h3>
          <div class="text_main_even"><div class="text">【1】 first</div></div></div>
        </li>
        <li id="item_10380" class="item even clearit" attr-index-related="1919814">
          <div class="inner"><h3><a href="/subject/10380" class="l">STEINS;GATE</a></h3></div>
        </li>
      </ul>`;

    expect(parseIndexEntries(html)).toEqual([
      expect.objectContaining({
        relationId: 1919813,
        targetType: 'subject',
        targetId: 328609,
        title: 'ぼっち・ざ・ろっく！',
        commentHtml: '【1】 first',
        position: 0,
      }),
      expect.objectContaining({
        relationId: 1919814,
        targetType: 'subject',
        targetId: 10380,
        title: 'STEINS;GATE',
        commentHtml: null,
        position: 1,
      }),
    ]);
  });
});
