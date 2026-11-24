'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.join(__dirname, '..');
const pages = ['index.html', 'guide/index.html', 'checkkol/index.html', 'ghepanh/index.html', 'grab/index.html', 'tetlasy/index.html'];
const read = file => fs.readFileSync(path.join(root, file), 'utf8');

test('all six pages synchronously load the shared cleaner first in the head', () => {
  for (const page of pages) {
    const head = read(page).match(/<head\b[^>]*>([\s\S]*?)<\/head>/)?.[1];
    assert.ok(head, `Head exists: ${page}`);
    const scripts = [...head.matchAll(/<script\b([^>]*)>[\s\S]*?<\/script>/g)];
    const cleaner = scripts.filter(([, attrs]) => /src="[^"]*clean-url\.js"/.test(attrs));
    assert.equal(cleaner.length, 1, `One early cleaner: ${page}`);
    assert.equal(scripts[0], cleaner[0], `Cleaner runs before all other scripts: ${page}`);
    assert.doesNotMatch(cleaner[0][1], /\b(?:async|defer|type)\s*(?:=|$)/, 'Execute during head parsing');
    const src = cleaner[0][1].match(/src="([^"]+)"/)[1];
    for (const base of ['https://wishplan.test/', 'https://pixelaquarius.github.io/wishplan/']) {
      assert.equal(new URL(src, new URL(page, base)).href, new URL('assets/clean-url.js', base).href);
    }
  }
});

// Exercise relative navigation under both a custom domain and a Pages project prefix.
test('all six pages use directory navigation backed by real static index files', () => {
  for (const base of ['https://wishplan.test/', 'https://pixelaquarius.github.io/wishplan/']) {
    let checked = 0;
    for (const page of pages) {
      const oldUrl = new URL(page, base);
      const directoryUrl = new URL(page.replace(/index\.html$/, ''), base);
      assert.ok(fs.existsSync(path.join(root, page)), `Legacy file remains: ${page}`);
      for (const [, href] of read(page).matchAll(/<a\b[^>]*\bhref="([^"]*)"/g)) {
        const target = new URL(href.replace(/&amp;/g, '&'), directoryUrl);
        if (target.origin !== directoryUrl.origin || !target.pathname.startsWith(new URL(base).pathname)) continue;
        checked++;
        assert.doesNotMatch(target.pathname, /index\.html/, `${page}: ${href}`);
        assert.ok(target.pathname.endsWith('/'), `Directory destination: ${page}: ${href}`);
        const legacyTarget = new URL(href, oldUrl);
        legacyTarget.pathname = legacyTarget.pathname.replace(/index\.html$/, '');
        assert.equal(legacyTarget.href, target.href, `Old and clean entry resolve alike: ${page}: ${href}`);
        const relative = target.pathname.slice(new URL(base).pathname.length);
        assert.ok(fs.existsSync(path.join(root, relative, 'index.html')), `Static destination exists: ${href}`);
      }
    }
    assert.ok(checked >= 30, 'Navigation inventory must not silently disappear');
  }
});

function boot(href) {
  let current = new URL(href);
  const state = { scroll: 42 };
  const calls = [];
  const history = {
    state,
    replaceState(value, title, target) {
      calls.push({ value, title, target });
      current = new URL(target, current);
    }
  };
  const context = vm.createContext({
    get location() { return current; }, history
  });
  context.window = context;
  const run = () => vm.runInContext(read('assets/clean-url.js'), context);
  return { run, calls, state, url: () => current.href };
}

test('legacy index entry uses replaceState once, retaining directory, search, hash and history state', () => {
  assert.ok(fs.existsSync(path.join(root, 'assets/clean-url.js')), 'Shared clean URL script must exist');
  for (const base of ['https://wishplan.test/', 'https://pixelaquarius.github.io/wishplan/']) {
    for (const page of [...pages, 'nested/index.html/guide/index.html']) {
      for (const suffix of ['', '?utm_source=a%2Fb&mode=1+2#section%20one', '#lab', '?next=index.html']) {
        const input = new URL(page + suffix, base).href;
        const expected = input.replace(/index\.html(?=[?#]|$)/, '');
        const browser = boot(input);
        browser.run();
        assert.equal(browser.url(), expected);
        assert.equal(browser.calls.length, 1);
        assert.equal(browser.calls[0].value, browser.state, 'Keep existing history state');
        assert.equal(browser.calls[0].title, '');
        browser.run();
        assert.equal(browser.calls.length, 1, 'Already-clean URLs must be no-ops');
      }
    }
  }
  for (const url of [
    'https://wishplan.test/', 'https://wishplan.test/guide/?q=index.html#lab',
    'https://wishplan.test/myindex.html', 'https://wishplan.test/index.html/guide/',
    'https://wishplan.test/guide/other.html', 'https://wishplan.test/INDEX.HTML',
    'https://pixelaquarius.github.io/wishplan/checkkol/#index.html'
  ]) {
    const browser = boot(url);
    browser.run();
    assert.equal(browser.url(), url);
    assert.equal(browser.calls.length, 0, `Non-terminal or clean URL unchanged: ${url}`);
  }
});
