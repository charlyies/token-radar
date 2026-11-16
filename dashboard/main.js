// Token Radar dashboard: renders window.RADAR (written by main.ts as ../data.js).
// No network, no fetch. Hash routes: #/protocol/<slug> opens the detail view,
// #/board?verdict=FARM (or ?watch=1, ?q=…) applies a filter to the board.
(function () {
  'use strict';
  const D = window.RADAR;
  if (!D) { document.body.innerHTML = '<p style="padding:20px">No data: data.js did not load.</p>'; return; }

  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (n) => n == null ? '—' : '$' + Math.round(n).toLocaleString('en-US');
  const moneyM = (n) => n == null ? '—' : n >= 1e6 ? '$' + (n / 1e6).toFixed(1) + 'M' : '$' + Math.round(n / 1e3) + 'k';
  const pct = (n) => n == null ? '—' : (n > 0 ? '+' : '') + n.toFixed(1) + '%';
  const chains = (c) => (c && c.length ? c[0] + (c.length > 1 ? ' +' + (c.length - 1) : '') : '—');
  const verdictBadge = (v) => '<span class="badge v-' + v.toLowerCase() + '">' + v + '</span>';
  const sup = (n) => String(n).replace(/[0-9-]/g, (d) => ({ '-': '⁻', '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴', '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹' }[d]));

  // ---- tabs ---------------------------------------------------------------
  const tabs = document.querySelectorAll('.tabs button');
  function showTab(name) {
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === name)));
    ['board', 'live', 'how'].forEach((t) => { $('panel-' + t).hidden = t !== name; });
  }
  tabs.forEach((b) => b.addEventListener('click', () => showTab(b.dataset.tab)));

  // ---- chips ----------------------------------------------------------------
  const f = D.fit;
  $('chips').innerHTML =
    '<span class="chip">Curve <b>log<sub>10</sub>(mcap) = ' + f.intercept + ' + ' + f.slope + ' &times; log<sub>10</sub>(TVL)</b></span>' +
    '<span class="chip">R&sup2; <b>' + f.r2 + '</b> &middot; n=<b>' + f.n + '</b></span>' +
    '<span class="chip">OOS time-split <b class="good">&times;' + f.timeSplitMedian + '</b> median</span>' +
    '<span class="chip">5-fold CV <b class="good">&times;' + f.cvMedian + '</b> median</span>' +
    '<span class="chip">Verdicts <b>FARM ' + D.farmCounts.farm + ' &middot; THIN ' + D.farmCounts.thin + ' &middot; SKIP ' + D.farmCounts.skip + '</b></span>' +
    '<span class="chip"><b>' + D.board_size + '</b> rows &middot; <b>' + D.early_size + '</b> early</span>';

  // ---- scatter ---------------------------------------------------------------
  (function scatter() {
    const W = 520, H = 300, P = 42;
    const pts = D.anchors;
    const xs = pts.map((p) => Math.log10(p.tvl));
    const ys = pts.map((p) => Math.log10(p.mcap));
    const x0 = Math.min(...xs) - 0.2, x1 = Math.max(...xs) + 0.2;
    const y0 = Math.min(...ys) - 0.2, y1 = Math.max(...ys) + 0.2;
    const X = (v) => P + ((v - x0) / (x1 - x0)) * (W - 2 * P);
    const Y = (v) => H - P - ((v - y0) / (y1 - y0)) * (H - 2 * P);
    let s = '<svg viewBox="0 0 ' + W + ' ' + H + '" xmlns="http://www.w3.org/2000/svg">';
    s += '<rect width="' + W + '" height="' + H + '" fill="#0e121b"/>';
    for (let e = Math.ceil(x0); e <= x1; e++) {
      s += '<line x1="' + X(e) + '" y1="' + (H - P) + '" x2="' + X(e) + '" y2="' + P + '" stroke="#1e2532"/>' +
        '<text x="' + X(e) + '" y="' + (H - P + 16) + '" fill="#5f6778" font-size="10" text-anchor="middle">10' + sup(e) + '</text>';
    }
    for (let e = Math.ceil(y0); e <= y1; e++) {
      s += '<line x1="' + P + '" y1="' + Y(e) + '" x2="' + (W - P) + '" y2="' + Y(e) + '" stroke="#1e2532"/>' +
        '<text x="' + (P - 6) + '" y="' + (Y(e) + 3) + '" fill="#5f6778" font-size="10" text-anchor="end">10' + sup(e) + '</text>';
    }
    s += '<text x="' + (W / 2) + '" y="' + (H - 8) + '" fill="#8b93a3" font-size="11" text-anchor="middle">TVL (log scale)</text>';
    s += '<text x="12" y="' + (H / 2) + '" fill="#8b93a3" font-size="11" text-anchor="middle" transform="rotate(-90 12 ' + (H / 2) + ')">Market cap (log scale)</text>';
    s += '<line x1="' + X(x0) + '" y1="' + Y(f.intercept + f.slope * x0) + '" x2="' + X(x1) + '" y2="' + Y(f.intercept + f.slope * x1) + '" stroke="#34d399" stroke-width="2"/>';
    for (const p of pts) {
      s += '<circle cx="' + X(Math.log10(p.tvl)).toFixed(1) + '" cy="' + Y(Math.log10(p.mcap)).toFixed(1) + '" r="2.6" fill="#60a5fa" fill-opacity="0.75"><title>' + esc(p.name) + ': TVL ' + money(p.tvl) + ', mcap ' + money(p.mcap) + '</title></circle>';
    }
    s += '</svg>';
    $('scatter').innerHTML = s;
  })();

  // ---- spotlight ---------------------------------------------------------------
  $('spotlight').innerHTML = D.rows.slice(0, 10).map((r) =>
    '<li data-slug="' + esc(r.slug) + '"><span class="s-rank">' + r.rank + '</span><span class="s-name">' + esc(r.name) +
    (r.is_watchlist ? ' <span class="s-watch">WATCH</span>' : '') + '</span><span class="s-val">' + moneyM(r.implied_value_usd) + '</span>' + verdictBadge(r.economics.verdict) + '</li>'
  ).join('');
  $('spotlight').addEventListener('click', (e) => {
    const li = e.target.closest('li[data-slug]');
    if (li) openDetail(li.dataset.slug);
  });

  // ---- board ------------------------------------------------------------------
  const cats = [...new Set(D.rows.map((r) => r.category).filter(Boolean))].sort();
  $('f-cat').innerHTML = '<option value="">All categories</option>' + cats.map((c) => '<option>' + esc(c) + '</option>').join('');
  let sortKey = 'rank', sortDir = 1;
  const bySlug = new Map(D.rows.map((r) => [r.slug, r]));

  function filtered() {
    const q = $('f-search').value.trim().toLowerCase();
    const cat = $('f-cat').value, ver = $('f-verdict').value;
    const watch = $('f-watch').checked;
    const min = parseFloat($('f-min').value) || 0;
    return D.rows.filter((r) =>
      (!q || r.name.toLowerCase().includes(q) || r.slug.includes(q)) &&
      (!cat || r.category === cat) && (!ver || r.economics.verdict === ver) &&
      (!watch || r.is_watchlist) && r.implied_value_usd >= min);
  }
  function sortRows(rows) {
    const key = {
      rank: (r) => r.rank, name: (r) => r.name.toLowerCase(), category: (r) => r.category || '',
      tvl: (r) => r.tvl_usd, change: (r) => r.change_7d ?? -1e9,
      implied: (r) => r.implied_value_usd, verdict: (r) => r.economics.verdict,
    }[sortKey];
    return [...rows].sort((a, b) => {
      const ka = key(a), kb = key(b);
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sortDir;
    });
  }
  function renderBoard() {
    const rows = sortRows(filtered());
    $('row-count').textContent = rows.length + ' of ' + D.rows.length + ' rows';
    $('board-body').innerHTML = rows.map((r) =>
      '<tr data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
      '<td><span class="name">' + esc(r.name) + '</span>' + (r.is_watchlist ? '<span class="wl">WATCH</span>' : '') + '</td>' +
      '<td>' + esc(r.category || '—') + '</td><td>' + esc(chains(r.chains)) + '</td>' +
      '<td class="num">' + moneyM(r.tvl_usd) + '</td>' +
      '<td class="num ' + (r.change_7d == null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</td>' +
      '<td class="num"><b>' + moneyM(r.implied_value_usd) + '</b></td><td>' + verdictBadge(r.economics.verdict) + '</td></tr>'
    ).join('');
    document.querySelectorAll('#board th[data-sort]').forEach((th) => th.classList.toggle('sorted', th.dataset.sort === sortKey));
  }
  document.querySelectorAll('#board th[data-sort]').forEach((th) => th.addEventListener('click', () => {
    if (sortKey === th.dataset.sort) sortDir *= -1; else { sortKey = th.dataset.sort; sortDir = 1; }
    renderBoard();
  }));
  ['f-search', 'f-cat', 'f-verdict', 'f-watch', 'f-min'].forEach((id) => $(id).addEventListener('input', renderBoard));
  $('board-body').addEventListener('click', (e) => {
    const tr = e.target.closest('tr[data-slug]');
    if (tr) openDetail(tr.dataset.slug);
  });

  // ---- detail ------------------------------------------------------------------
  function openDetail(slug) {
    const r = bySlug.get(slug);
    if (!r) return;
    showTab('board');
    $('detail-card').hidden = false;
    $('detail-title').textContent = '#' + r.rank + ' · ' + r.name + (r.is_watchlist ? ' · watchlist' : '');
    const e = r.economics;
    $('detail').innerHTML =
      '<dl>' +
      '<div><dt>Implied launch value</dt><dd>' + money(r.implied_value_usd) + '</dd></div>' +
      '<div><dt>Curve base (TVL ' + money(r.tvl_usd) + ')</dt><dd>' + money(r.curve_base) + '</dd></div>' +
      '<div><dt>Growth (7d ' + pct(r.change_7d) + ')</dt><dd>&times;' + r.growth_multiplier + '</dd></div>' +
      '<div><dt>Maturity (' + (r.age_days == null ? 'age unknown' : r.age_days + ' days') + ')</dt><dd>&times;' + r.maturity_multiplier + '</dd></div>' +
      '<div><dt>Category</dt><dd>' + esc(r.category || '—') + '</dd></div>' +
      '<div><dt>Chains</dt><dd>' + esc(r.chains.slice(0, 4).join(', ') + (r.chains.length > 4 ? ' +' + (r.chains.length - 4) + ' more' : '') || '—') + '</dd></div>' +
      '</dl>' +
      '<h3>Farm economics — 5% of the launch, split among 2,000 farmers</h3>' +
      '<table><tbody>' +
      '<tr><td>Farmer pool (5% of implied)</td><td class="num">' + money(e.farmerPool) + '</td><td>Expected value per farmer</td><td class="num">' + money(e.perFarmer) + '</td></tr>' +
      '<tr><td>Capital</td><td class="num">' + money(e.capital) + '</td><td>Setup gas (3 tx)</td><td class="num">' + money(e.setupGas) + '</td></tr>' +
      '<tr><td>Hold</td><td class="num">' + e.holdDays + ' days</td><td>Weekly gas (' + e.weeks + ' weeks)</td><td class="num">' + money(e.weeklyGas) + '</td></tr>' +
      '<tr><td>Opportunity cost (5% APR)</td><td class="num">' + money(e.opportunity) + '</td><td>Plan cost</td><td class="num">' + money(e.planCost) + '</td></tr>' +
      '<tr><td><b>Net per farmer</b></td><td class="num"><b>' + money(e.net) + '</b></td><td><b>Verdict</b></td><td class="num">' + verdictBadge(e.verdict) + '</td></tr>' +
      '</tbody></table>' +
      '<h3>Farm plan — 8 steps</h3><ol class="steps">' +
      r.farm_steps.map((s) => '<li>' + esc(s) + '</li>').join('') + '</ol>' +
      '<p class="note">Pre-token means this protocol\'s snapshot record carries no token. That is not proof a token comes, and the verdict is a budgeting aid, never a promise.</p>';
    $('detail-card').scrollIntoView({ behavior: 'smooth', block: 'start' });
    if (location.hash !== '#/protocol/' + slug) history.replaceState(null, '', '#/protocol/' + slug);
  }

  // ---- live ----------------------------------------------------------------------
  $('live-body').innerHTML = D.live.map((r) =>
    '<tr><td><span class="name">' + esc(r.name) + '</span> <span class="slug">' + esc(r.slug) + '</span></td>' +
    '<td>' + esc(r.category || '—') + '</td><td>' + esc(chains(r.chains)) + '</td>' +
    '<td class="num">' + moneyM(r.tvl_usd) + '</td><td class="num">' + money(r.mcap_usd) + '</td>' +
    '<td class="num ' + (r.change_7d == null ? '' : r.change_7d >= 0 ? 'pos' : 'neg') + '">' + pct(r.change_7d) + '</td></tr>'
  ).join('');

  // ---- hash routing ----------------------------------------------------------------
  function route() {
    const h = location.hash;
    const m = h.match(/^#\/protocol\/([\w-]+)$/);
    if (m) { openDetail(m[1]); return; }
    const b = h.match(/^#\/board\?(.*)$/);
    if (b) {
      const p = new URLSearchParams(b[1]);
      if (p.get('verdict')) $('f-verdict').value = p.get('verdict');
      if (p.get('watch')) $('f-watch').checked = p.get('watch') === '1';
      if (p.get('q')) $('f-search').value = p.get('q');
      if (p.get('min')) $('f-min').value = p.get('min');
      if (p.get('cat')) $('f-cat').value = p.get('cat');
    }
    renderBoard();
  }
  window.addEventListener('hashchange', route);
  renderBoard();
  route();
})();
