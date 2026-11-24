const test = require('node:test');
const assert = require('node:assert/strict');
const {boot, html} = require('./helpers/kol-fixture.cjs');

test('mobile layout contains tables and keyboard navigation has focus and 44px targets', () => {
  assert.match(html, /\.kol-tool :is\(button, summary, input, select\)[\s\S]*?min-height: 44px/);
  assert.match(html, /:focus-visible\s*\{[^}]*outline:/);
  assert.match(html, /\.kol-tool \.overflow-x-auto\s*\{[^}]*max-width: 100%[^}]*overflow-x: auto/);
  assert.match(html, /@media \(max-width: 1280px\)[\s\S]*?flex-wrap: wrap/);
  assert.match(html, /<nav[^>]*aria-label="Điều hướng đánh giá KOL"/);
  const b=boot(); b.run('switchNavTab("history")');
  assert.equal(b.elements.get('navTabHistory').ariaCurrent, 'page');
  assert.equal(b.elements.get('navTabHomepage').ariaCurrent, 'false');
});

test('header keeps tablet navigation on its own row and mobile return link visible', () => {
  const responsive = html.match(/@media \(max-width: 1280px\) \{([\s\S]*?)\n    \}/)?.[1];
  assert.ok(responsive, '1280px must use the compact header');
  assert.match(responsive, /\.wp-tool-header nav\s*\{[^}]*order: 3[^}]*flex-basis: 100%[^}]*overflow-x: auto/);
  assert.match(responsive, /\.kol-header-status\s*\{[^}]*display: none/);
  assert.match(html, /\.kol-header-brand\s*\{[^}]*flex-shrink: 0[^}]*white-space: nowrap/);
  assert.match(html, /\.kol-header-actions\s*\{[^}]*flex-wrap: wrap/);
  assert.match(html, /\.kol-header-actions button\s*\{[^}]*flex-shrink: 0[^}]*white-space: nowrap/);
  const back = [...html.matchAll(/<a\b[^>]*href="([^"]*)"[^>]*>/g)].find(([, href]) =>
    new URL(href, 'https://wishplan.test/checkkol/').pathname.replace(/index\.html$/, '') === '/'
  )?.[0];
  assert.ok(back);
  assert.doesNotMatch(back, /\bhidden\b/);
  assert.match(back, /\binline-flex\b/);
});

test('localized Vietnamese numbers preserve grouping while JSON numbers retain their numeric value', () => {
  const b = boot();
  for (const [raw, expected] of [
    ['1.234.567', 1234567], ['253.000', 253000], ['1.234.567,89', 1234567.89],
    ['734,41tr', 734410000], ['13,51tỉ', 13510000000], ['₫253.000', 253000],
    ['-1.234', -1234], ['0', 0], [253.000, 253], [1.234, 1.234], [1e21, 1e21]
  ]) {
    b.ctx.rawNumber = raw;
    assert.equal(b.run('parseVnNumber(rawNumber)'), expected, String(raw));
  }
  const d = b.run('parseKalodataApiBundle({creatorDetail:{handle:"safe"},coreMetrics:{revenue:"1.234.567",unit_price:"253.000",followers:1.25},shops:[{name:"CeraVe",revenue:"1.234.567",sale:"1.234"}]})');
  assert.equal(d.totalGmv, 1234567);
  assert.equal(d.aov, 253000);
  assert.equal(d.followerChange, 1.25);
  assert.equal(d.stores[0].rev, 1234567);
  assert.equal(d.stores[0].orders, 1234);
});

test('ambiguous numeric text remains unknown and import instructions state the locale', () => {
  const b = boot();
  for (const raw of ['1.23', '1.234.56', '1,234,567', '1,234.56', '12.34,56', '253.000oops', '1e3', '--3', true, {}, Infinity, NaN]) {
    b.ctx.rawNumber = raw;
    assert.equal(b.run('parseVnNumber(rawNumber)'), null, String(raw));
  }
  b.run('renderDashboard(parseKalodataApiBundle({creatorDetail:{handle:"safe"},coreMetrics:{revenue:"1.234.56",unit_price:"1.23"}}))');
  assert.equal(b.run('currentAuditData.totalGmv'), null);
  assert.equal(b.run('currentAuditData.aov'), null);
  assert.equal(b.elements.get('overallScoreValue').textContent, 'N/A');
  assert.match(html, /id="numberFormatHelp"[^>]*>[\s\S]*?1\.234\.567[\s\S]*?253\.000[\s\S]*?JSON/);
});

test('scenario diagnosis reports checked evidence instead of inventing demographic fit or booking outcomes', () => {
  const b = boot();
  b.run(`scenarioData = parseKalodataApiBundle({
    creatorDetail:{handle:"safe",followerSex:"male",followerAgeMax:"18-24",follower_count:100000,has_mcn:0},
    coreMetrics:{revenue:300000000,video_revenue:250000000,live_revenue:50000000,unit_price:50000,followers:100,video_views:1000000,live_views:600000},
    videoCount:20,shops:[{name:"CeraVe",revenue:40000000,sale:100},{name:"La Roche Posay",revenue:40000000,sale:100}]
  })`);
  assert.ok(b.run('buildDynamicChecklist(scenarioData).every(i=>i.available)'), 'exercise complete-evidence branch, not missing-data guard');
  const base = b.run('evaluateScenario(scenarioData, 100, 13)');
  assert.match(base.desc, /Male Majority/);
  assert.match(base.desc, /18-24/);
  assert.match(base.desc, /₫50\.0K/);
  assert.match(base.desc, /not met|chưa đạt/i);
  for (const patch of [
    {}, {dominantTrack:'LIVE_TRACK',totalGmv:600000000},
    {totalGmv:200000000}, {isCategoryAlignedWithSkincare:false,personalCareStores:3},
    {isCategoryAlignedWithSkincare:false,apparelStores:5}, {totalGmv:1000,maxSkincareOrdersOnSingleStore:0}
  ]) {
    b.ctx.scenarioPatch = patch;
    const diagnosis = b.run('evaluateScenario({...scenarioData,...scenarioPatch}, 100, 13)');
    const text = JSON.stringify(diagnosis);
    assert.doesNotMatch(text, /Tier-A|Tier-B|evergreen|high.trust|high probability|< 10 orders|immediately|18%|22%|approve for|reject for|book a dedicated/i);
    assert.match(diagnosis.actions.join(' '), /if |nếu /i);
    assert.match(diagnosis.desc, /not (?:a forecast|predict)|không dự báo/i);
  }
  b.run('renderDashboard(scenarioData)');
  assert.match(b.elements.get('scenarioDesc').textContent, /Male Majority/);
  assert.doesNotMatch(b.elements.get('scenarioTitle').textContent, /gem|ROI|Tier-A/i);
  const diagnosisCard = html.match(/<details id="diagnosisDetails"[\s\S]*?<\/details>/)[0];
  assert.match(diagnosisCard, /Tóm tắt bằng chứng/);
  assert.doesNotMatch(diagnosisCard, /Auto-Detected|Recommended Action Plan|Preliminary Scenario Diagnosis/);
});

test('imported avatar URLs never become automatic network requests', () => {
  const b = boot(), backgroundWrites = [];
  b.run('document.getElementById("kolAvatar")');
  Object.defineProperty(b.elements.get('kolAvatar').style, 'backgroundImage', {
    set(value) { backgroundWrites.push(value); }, get() { return backgroundWrites.at(-1); }
  });
  for (const avatar of ['https://tracking.example/pixel?private=creator', 'https://img.kalocdn.com/avatar.png', 'data:image/svg+xml,<svg/>', '']) {
    b.ctx.importedAvatar = avatar;
    b.run('renderDashboard(parseKalodataApiBundle({creatorDetail:{handle:"safe",avatar:importedAvatar}}))');
    assert.equal(b.elements.get('kolAvatar').style.backgroundImage, 'none');
    assert.equal(b.elements.get('kolAvatar').textContent, 'SA');
  }
  assert.ok(backgroundWrites.every(value => value === 'none'));
});

test('comparison exposes both source periods and warns about incomparable or unknown context', () => {
  const b = boot();
  for (const [handleB, periodB, warnings] of [
    ['@other', '2026-10-01 ~ 2026-10-30', [/Different creators/i, /Different source periods/i]],
    ['@safe', '2026-09-01 ~ 2026-09-30', []],
    ['@safe', undefined, [/Unknown source period/i]],
    ['@safe', 'Unknown date range', [/Unknown source period/i]]
  ]) {
    b.ctx.snapshots = [
      {handle:'@safe',snapshotId:'a',savedAtIso:'2026-10-01T00:00:00Z',dateRangeWindow:'2026-09-01 ~ 2026-09-30',totalGmv:100},
      {handle:handleB,snapshotId:'b',savedAtIso:'2026-11-01T00:00:00Z',dateRangeWindow:periodB,totalGmv:200}
    ];
    b.run('getSavedHistory=()=>snapshots;document.getElementById("compareSelectA").value="a";document.getElementById("compareSelectB").value="b";renderComparisonView()');
    const output = b.elements.get('comparisonContent').innerHTML;
    assert.match(output, /Source period A: 2026-09-01 ~ 2026-09-30/);
    assert.ok(output.includes('Source period B: ' + (periodB || 'Unknown date range')));
    assert.match(output, /Differences are descriptive only/i);
    assert.match(output, /not evidence of campaign impact/i);
    assert.match(output, /Metric difference \(B − A\)/);
    for (const warning of warnings) assert.match(output, warning);
    if (!warnings.length) assert.doesNotMatch(output, /Different creators|Different source periods|Unknown source period/i);
  }
  b.ctx.snapshots[1].dateRangeWindow = '<img src=x onerror=alert(1)>';
  b.run('renderComparisonView()');
  assert.doesNotMatch(b.elements.get('comparisonContent').innerHTML, /<img/);
  assert.match(b.elements.get('comparisonContent').innerHTML, /&lt;img/);
});

for(const boundary of ['bob','switch-back','guest']) test('JSON file read remains owner-bound: '+boundary, () => {
  const b=boot(), reads=[];
  b.ctx.FileReader=class {readAsText(){reads.push(this);}};
  b.run('fbApp={auth:()=>({currentUser:{uid:"alice"}})}; readAndAuditFile({name:"private.json",size:100})');
  b.run('fbApp='+ (boundary==='guest' ? 'null' : '{auth:()=>({currentUser:{uid:"bob"}})}') + '; importAuthGeneration++');
  if(boundary==='switch-back') b.run('fbApp={auth:()=>({currentUser:{uid:"alice"}})}; importAuthGeneration++');
  reads[0].onload({target:{result:'{"creatorDetail":{"handle":"private"}}'}});
  assert.equal(b.run('currentAuditData'),null);
  assert.equal(b.run('getSavedHistory().length'),0);
});

test('primary result exposes actual source and missing evidence before collapsed analysis', () => {
  // A permissive VM stub cannot prove these nodes exist in the shipped page.
  for (const id of ['primaryVerdict', 'sourceCoverage', 'sourceFileName', 'sourceDateRange', 'sourceMissing', 'resultNextAction', 'missingEvidenceSummary']) {
    assert.equal([...html.matchAll(new RegExp('\\bid="' + id + '"', 'g'))].length, 1, id + ' must exist exactly once in the actual HTML');
  }
  const b = boot();
  b.run('renderDashboard(parseKalodataApiBundle({creatorDetail:{handle:"safe"},coreMetrics:{revenue:12345}}))');
  assert.match(b.elements.get('primaryVerdict').textContent, /Chưa đủ dữ liệu/);
  const total=b.run('currentChecklistState.length');
  assert.ok(b.elements.get('sourceCoverage').textContent.includes(`1/${total}`));
  assert.match(b.elements.get('sourceFileName').textContent, /Kalodata_API_safe\.json/);
  assert.match(b.elements.get('sourceMissing').textContent, /Core Buying Age/);
  assert.match(b.elements.get('resultNextAction').textContent, /Bổ sung/);
  assert.equal(b.elements.get('missingEvidenceSummary').textContent, `Xem ${total - 1} tiêu chí thiếu bằng chứng`);
  assert.match(html, /<details id="missingEvidenceDetails">\s*<summary id="missingEvidenceSummary">[\s\S]*?id="sourceMissing"[\s\S]*?<\/details>/);
  assert.match(b.elements.get('aiAuditOutput').textContent, /AI chưa bật/);
  assert.doesNotMatch(b.elements.get('aiAuditOutput').textContent, /Ready to generate/);
  for (const id of ['checklistDetails','sourceTablesDetails','diagnosisDetails','summaryDetails','aiDetails']) {
    assert.match(html, new RegExp('<details[^>]*id="'+id+'"[^>]*>\\s*<summary'));
    assert.doesNotMatch(html.match(new RegExp('<details[^>]*id="'+id+'"[^>]*>'))[0], /\bopen\b/);
  }
  assert.ok(html.indexOf('id="primaryResult"') < html.indexOf('id="checklistDetails"'));
});

test('JSON file import uses validated bundle path without HTML fallback', () => {
  const b=boot(), reads=[], alerts=[];
  b.ctx.FileReader=class {readAsText(){reads.push(this);}};
  b.ctx.alert=message=>alerts.push(message);
  b.run('runStageTransitionAndAudit=()=>{throw Error("must not parse JSON as HTML")}; readAndAuditFile({name:"source.json",size:100})');
  reads[0].onload({target:{result:JSON.stringify({creatorDetail:{handle:'safe'},coreMetrics:{revenue:12345}})}});
  assert.equal(b.run('currentAuditData.totalGmv'),12345);
  assert.equal(b.run('currentAuditData.fileName'),'source.json');
  assert.equal(b.run('getSavedHistory().length'),1);
  b.run('readAndAuditFile({name:"bad.json",size:100})');
  reads[1].onload({target:{result:'{"creatorDetail":{"handle":123}}'}});
  assert.equal(b.run('getSavedHistory().length'),1);
  assert.match(alerts.at(-1), /JSON/);
});

test('Vietnamese entry offers one keyboard-operable manual file action without login', () => {
  const landing = html.match(/<main id="stageLanding"[\s\S]*?<\/main>/)[0];
  assert.match(html, /<html lang="vi">/);
  assert.match(html, /href="\.\.\/assets\/wishplan\.css"/);
  assert.match(html, /wp-tool-header/);
  assert.match(landing, /<h1[^>]*>Đánh giá KOL<\/h1>/);
  assert.match(landing, /<ol[\s\S]*?Chọn tệp[\s\S]*?Kiểm tra nguồn[\s\S]*?Lưu.*?so sánh[\s\S]*?<\/ol>/);
  assert.match(landing, /<button[^>]*id="dropZone"[^>]*type="button"/);
  assert.match(landing, /id="fileInput"[^>]*accept="\.html,\.htm,\.json"/);
  assert.match(landing, /Không cần đăng nhập/);
  assert.match(landing, /<details[^>]*id="pasteSourceDetails"[^>]*>\s*<summary/);
  assert.match(landing, /<label for="rawHtmlInput"/);
});
