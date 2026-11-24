'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const destinations = (html, base = 'https://wishplan.test/') => [...html.matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)].map(([, href]) => {
  const url = new URL(href, base);
  return url.pathname.replace(/index\.html$/, '') + url.hash;
});
test('homepage prioritizes two daily tools and keeps experiments secondary', () => {
  const html = read('index.html');
  const daily = html.match(/<section[^>]*id="daily-tools"[\s\S]*?<\/section>/)?.[0] || '';
  assert.ok(destinations(daily).includes('/ghepanh/'));
  assert.ok(destinations(daily).includes('/checkkol/'));
  assert.doesNotMatch(daily, /grab\/|tetlasy\//);
  const lab = html.match(/<details[^>]*id="lab"[^>]*>[\s\S]*?<\/details>/)?.[0] || '';
  assert.ok(destinations(lab).includes('/grab/'));
  assert.ok(destinations(lab).includes('/tetlasy/'));
  assert.doesNotMatch(lab.split('>')[0], /\bopen\b/);
  assert.doesNotMatch(html, /setInterval|hubCountdown|hubDays|100% Client-Side|Enterprise Edition/);
});
test('guide makes existing workflows and data boundaries visible without sign-in', () => {
  assert.ok(fs.existsSync(path.join(root, 'guide/index.html')), 'The guide must be a real page, not a placeholder link');
  const guide = read('guide/index.html');
  for (const id of ['workflows','images','kol','data','limits','roadmap']) assert.match(guide,new RegExp('id="'+id+'"'));
  assert.ok(destinations(guide, 'https://wishplan.test/guide/').includes('/ghepanh/'));
  assert.ok(destinations(guide, 'https://wishplan.test/guide/').includes('/checkkol/'));
  assert.match(guide, /chưa|Chưa|Dự kiến|Đề xuất/);
  assert.match(guide, /không.*ROI|không.*lợi nhuận/);
});
test('deployment includes shared assets and guide, not only legacy tool directories', () => {
  const workflow = read('.github/workflows/pages.yml');
  assert.match(workflow, /rsync[^\n]+\bassets\b[^\n]+\bguide\b/);
});
test('temple demo countdown is not advertised as an official holiday schedule', () => {
  const html = read('tetlasy/index.html');
  assert.match(html, /Mốc demo/);
  assert.match(html, /không phải lịch nghỉ chính thức/);
  assert.doesNotMatch(html, /class="hud-cd-title">Nghỉ Tết/);
});

test('both lab entries explain their limits and provide a return to WishPlan', () => {
  for (const dir of ['grab','tetlasy']) {
    const html = read(dir+'/index.html');
    assert.match(html, /id="lab-context"/);
    assert.ok(destinations(html, `https://wishplan.test/${dir}/`).includes('/#lab'));
    assert.doesNotMatch(html, /user-scalable=no|maximum-scale=1(?:,|"|\.)/);
  }
  assert.match(read('grab/index.html'),/Không đặt đơn|không đặt đơn/);
});
