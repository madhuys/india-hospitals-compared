(function () {
  const D = window.HDATA, M = window.HModel, COS = M.COS;
  const NAME = {Apollo: "Apollo Hospitals", Fortis: "Fortis Healthcare", Max: "Max Healthcare", Medanta: "Medanta (Global Health)"};
  const col = co => getComputedStyle(document.documentElement).getPropertyValue("--c-" + co).trim();
  const ADJ0 = {dOcc: 0, dArpob: 0, dMargin: 0, curbMult: 1};
  const S = {sc: 1, pick: "all", adj: {}, tgt: {}, W: Object.assign({}, M.DEFAULT_W)};
  COS.forEach(co => S.adj[co] = Object.assign({}, ADJ0));
  COS.forEach(co => S.tgt[co] = D.inputs.companies[co].target_ev_ebitda);

  const f0 = x => Math.round(x).toLocaleString("en-IN");
  const pct = (x, d = 1) => (x * 100).toFixed(d) + "%";
  const spct = (x, d = 1) => (x >= 0 ? "+" : "−") + Math.abs(x * 100).toFixed(d) + "%";
  const xx = x => x.toFixed(1) + "x";
  const rs = x => "₹" + f0(x);
  const $ = id => document.getElementById(id);
  const NS = "http://www.w3.org/2000/svg";
  const el = (tag, attrs, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };

  // tooltip
  const tip = $("tip");
  function showTip(evt, html) { tip.innerHTML = html; tip.hidden = false; moveTip(evt); }
  function moveTip(evt) { const x = evt.clientX + 14, y = evt.clientY + 14; tip.style.left = Math.min(x, innerWidth - 300) + "px"; tip.style.top = Math.min(y, innerHeight - 140) + "px"; }
  function hideTip() { tip.hidden = true; }

  // ---------- charts ----------
  function niceMax(v) { const p = Math.pow(10, Math.floor(Math.log10(v))); for (const m of [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]) if (m * p >= v) return m * p; return v; }

  function lineChart(host, series, xl, fmt, opts = {}) {
    host.innerHTML = "";
    const W = host.clientWidth && host.clientWidth < 480 ? 420 : 560, H = W < 560 ? 280 : 300, L = 48, R = 92, T = 12, B = 30;
    const svg = el("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.label || ""}, host);
    const all = series.flatMap(s => s.values.filter(v => v != null));
    let lo = opts.min != null ? opts.min : Math.min(0, ...all), hi = niceMax(Math.max(...all) * 1.02);
    if (opts.min != null && opts.min > 0) lo = opts.min;
    const x = i => L + i * (W - L - R) / (xl.length - 1), y = v => T + (H - T - B) * (1 - (v - lo) / (hi - lo));
    for (let k = 0; k <= 4; k++) { const v = lo + (hi - lo) * k / 4; el("line", {x1: L, x2: W - R, y1: y(v), y2: y(v), class: "gridl"}, svg); el("text", {x: L - 6, y: y(v) + 4, "text-anchor": "end"}, svg).textContent = fmt(v, true); }
    xl.forEach((t, i) => el("text", {x: x(i), y: H - 8, "text-anchor": "middle"}, svg).textContent = t);
    if (opts.split != null) { el("line", {x1: x(opts.split), x2: x(opts.split), y1: T, y2: H - B, stroke: "#C9BDB7", "stroke-dasharray": "2 3"}, svg); el("text", {x: x(opts.split) + 4, y: T + 10}, svg).textContent = "forecast →"; }
    const ends = [];
    series.forEach(s => {
      const pts = s.values.map((v, i) => v == null ? null : [x(i), y(v)]);
      const solid = pts.filter((p, i) => p && (opts.split == null || i <= opts.split));
      const dash = pts.filter((p, i) => p && opts.split != null && i >= opts.split);
      const d = a => a.map((p, i) => (i ? "L" : "M") + p[0].toFixed(1) + " " + p[1].toFixed(1)).join("");
      const op = opts.focus && opts.focus !== s.co ? 0.25 : 1, sw = opts.focus === s.co ? 3 : 2;
      if (solid.length) el("path", {d: d(solid), fill: "none", stroke: col(s.co), "stroke-width": sw, "stroke-opacity": op, "stroke-linejoin": "round"}, svg);
      if (dash.length > 1) el("path", {d: d(dash), fill: "none", stroke: col(s.co), "stroke-width": sw, "stroke-opacity": op, "stroke-dasharray": "5 4"}, svg);
      const last = pts.filter(Boolean).pop(); ends.push({co: s.co, y: last[1], x: last[0], v: s.values[s.values.length - 1]});
    });
    // direct labels with collision avoidance
    ends.sort((a, b) => a.y - b.y); for (let i = 1; i < ends.length; i++) if (ends[i].y - ends[i - 1].y < 17) ends[i].y = ends[i - 1].y + 17;
    ends.forEach(e => { el("circle", {cx: e.x, cy: series.find(s => s.co === e.co).values.slice(-1)[0] != null ? y(e.v) : e.y, r: 4, fill: col(e.co), stroke: "#fff", "stroke-width": 2}, svg); const t = el("text", {x: e.x + 8, y: e.y + 4, class: "lab"}, svg); t.textContent = e.co; });
    // hover crosshair
    const cross = el("line", {y1: T, y2: H - B, stroke: "#8a7f7f", "stroke-width": 1, visibility: "hidden"}, svg);
    const hit = el("rect", {x: L, y: T, width: W - L - R, height: H - T - B, fill: "transparent"}, svg);
    hit.addEventListener("mousemove", ev => {
      const r = svg.getBoundingClientRect(), px = (ev.clientX - r.left) * W / r.width;
      const i = Math.max(0, Math.min(xl.length - 1, Math.round((px - L) / ((W - L - R) / (xl.length - 1)))));
      cross.setAttribute("x1", x(i)); cross.setAttribute("x2", x(i)); cross.setAttribute("visibility", "visible");
      const rows = series.slice().sort((a, b) => (b.values[i] ?? -1e9) - (a.values[i] ?? -1e9)).map(s => `<div><span class="dot" style="background:${col(s.co)}"></span> ${s.co}: <b>${s.values[i] == null ? "n/a" : fmt(s.values[i])}</b></div>`).join("");
      showTip(ev, `<div style="margin-bottom:4px"><b>${xl[i]}</b></div>${rows}`);
    });
    hit.addEventListener("mouseleave", () => { cross.setAttribute("visibility", "hidden"); hideTip(); });
  }

  function hbar(host, items, fmt, opts = {}) {
    host.innerHTML = "";
    const W = host.clientWidth && host.clientWidth < 480 ? 440 : 560, rowH = opts.rowH || 44, T = 8, L = 128, R = 70, H = T + items.length * rowH + 6;
    const svg = el("svg", {viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": opts.label || ""}, host);
    const vals = items.flatMap(it => it.bars.map(b => b.v));
    const lo = Math.min(0, ...vals), hi = opts.max != null ? opts.max : Math.max(0, ...vals) * 1.05 || 1;
    const x = v => L + (W - L - R) * (v - lo) / (hi - lo);
    el("line", {x1: x(0), x2: x(0), y1: T - 4, y2: H - 2, class: "axis"}, svg);
    items.forEach((it, i) => {
      const y0 = T + i * rowH, nb = it.bars.length, bh = Math.min(18, (rowH - 12 - (nb - 1) * 2) / nb);
      el("text", {x: 0, y: y0 + rowH / 2 + 4, class: "lab"}, svg).textContent = it.label || it.co;
      it.bars.forEach((b, j) => {
        const yy = y0 + (rowH - nb * bh - (nb - 1) * 2) / 2 + j * (bh + 2);
        const x1 = Math.min(x(0), x(b.v)), w = Math.max(1, Math.abs(x(b.v) - x(0)));
        const r = el("rect", {x: x1, y: yy, width: w, height: bh, rx: 3, fill: col(it.co), "fill-opacity": b.alpha || 1}, svg);
        if (b.pattern) r.setAttribute("fill", `url(#hatch-${it.co})`);
        const t = el("text", {x: b.v >= 0 ? x(b.v) + 6 : x(b.v) - 6, y: yy + bh / 2 + 4, "text-anchor": b.v >= 0 ? "start" : "end"}, svg); t.textContent = fmt(b.v);
        const target = el("rect", {x: L, y: yy - 1, width: W - L - R + 60, height: bh + 2, fill: "transparent"}, svg);
        target.addEventListener("mousemove", ev => showTip(ev, `<b>${NAME[it.co]}</b><br>${b.name ? b.name + ": " : ""}${fmt(b.v)}${b.extra ? "<br>" + b.extra : ""}`));
        target.addEventListener("mouseleave", hideTip);
      });
    });
    if (opts.hatch) { const defs = el("defs", {}, svg); COS.forEach(co => { const p = el("pattern", {id: "hatch-" + co, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)"}, defs); el("rect", {width: 6, height: 6, fill: col(co), "fill-opacity": .25}, p); el("line", {x1: 0, y1: 0, x2: 0, y2: 6, stroke: col(co), "stroke-width": 2.2}, p); }); svg.insertBefore(defs, svg.firstChild); }
  }

  // ---------- controls ----------
  function slider(host, key, label, min, max, step, val, fmt, help, onch) {
    const d = document.createElement("div"); d.className = "sl";
    d.innerHTML = `<label for="s-${key}"><span>${label}</span><output id="o-${key}">${fmt(val)}</output></label><input type="range" id="s-${key}" min="${min}" max="${max}" step="${step}" value="${val}">${help ? `<small>${help}</small>` : ""}`;
    host.appendChild(d);
    const inp = d.querySelector("input"), out = d.querySelector("output");
    inp.addEventListener("input", () => { const v = +inp.value; out.textContent = fmt(v); onch(v); render(); });
    return inp;
  }
  const pp = v => (v >= 0 ? "+" : "−") + Math.abs(v).toFixed(1) + " pp";
  const sl = $("sliders");
  // chain picker: the sliders move one chain, or all four together
  const pk = document.createElement("div"); pk.className = "sl pickwrap";
  pk.innerHTML = `<label><span>Apply to</span></label><div class="seg pick" role="radiogroup" aria-label="Hospital chain">${["all", ...COS].map(c => `<button role="radio" data-co="${c}" aria-checked="${c === "all"}">${c === "all" ? "All chains" : c}</button>`).join("")}</div><small id="pick-note"></small>`;
  sl.appendChild(pk);
  const targets = () => S.pick === "all" ? COS : [S.pick];
  const setAdj = (k, v) => targets().forEach(co => S.adj[co][k] = v);
  const sOcc = slider(sl, "occ", "Occupancy", -5, 5, 0.5, 0, pp, "Added to every year's occupancy", v => setAdj("dOcc", v / 100));
  const sArp = slider(sl, "arpob", "Revenue-per-bed growth", -4, 4, 0.5, 0, pp, "Added to annual ARPOB growth", v => setAdj("dArpob", v / 100));
  const sMar = slider(sl, "mar", "Hospital EBITDA margin", -3, 3, 0.25, 0, pp, "Added to the hospital margin", v => setAdj("dMargin", v / 100));
  const sCurb = slider(sl, "curb", "Curb severity", 0, 2.5, 0.25, 1, v => v.toFixed(2) + "×", "Scales the curb-case hit; works in the Drug-price curb scenario", v => setAdj("curbMult", v));
  const SL = [[sOcc, "dOcc", 100], [sArp, "dArpob", 100], [sMar, "dMargin", 100], [sCurb, "curbMult", 1]];
  // show the picked chain's values on the sliders (All: the shared value, or Apollo's when they differ)
  function syncSliders() {
    const src = S.adj[S.pick === "all" ? COS[0] : S.pick];
    SL.forEach(([inp, k, m]) => { inp.value = +(src[k] * m).toFixed(2); inp.parentNode.querySelector("output").textContent = (k === "curbMult" ? (+inp.value).toFixed(2) + "×" : pp(+inp.value)); });
    const changed = COS.filter(co => Object.keys(ADJ0).some(k => Math.abs(S.adj[co][k] - ADJ0[k]) > 1e-9));
    const differ = COS.some(co => Object.keys(ADJ0).some(k => Math.abs(S.adj[co][k] - S.adj[COS[0]][k]) > 1e-9));
    $("pick-note").textContent = S.pick === "all"
      ? (differ ? "Chains have their own settings; moving a slider now sets all four to the same value." : "Moving a slider changes all four chains.")
      : `Only ${NAME[S.pick]} changes.` + (changed.length ? ` Adjusted so far: ${changed.join(", ")}.` : "");
  }
  pk.querySelectorAll("button").forEach(b => b.addEventListener("click", () => {
    S.pick = b.dataset.co; pk.querySelectorAll("button").forEach(x => x.setAttribute("aria-checked", x === b)); syncSliders(); render();
  }));
  SL.forEach(([inp]) => inp.addEventListener("input", syncSliders));
  const reset = document.createElement("button"); reset.className = "btn"; reset.textContent = "Reset assumptions"; sl.appendChild(reset);
  reset.addEventListener("click", () => { targets().forEach(co => S.adj[co] = Object.assign({}, ADJ0)); syncSliders(); render(); });
  syncSliders();
  COS.forEach(co => slider($("tgt"), "t" + co, co, 15, 40, 0.5, S.tgt[co], v => v.toFixed(1) + "x", null, v => S.tgt[co] = v));
  const wl = {growth: "Earnings growth (EBITDA CAGR)", upside: "Upside to target price", expansion: "Expansion plan", drug: "Drug-pricing resilience", gov: "Governance"};
  Object.keys(wl).forEach(k => slider($("weights"), "w" + k, wl[k], 0, 50, 5, S.W[k] * 100, v => v + "%", null, v => S.W[k] = v / 100));

  document.querySelectorAll(".seg button[data-sc]").forEach(b => b.addEventListener("click", () => {
    S.sc = +b.dataset.sc; document.querySelectorAll(".seg button[data-sc]").forEach(x => x.setAttribute("aria-checked", x === b)); render();
  }));

  // ---------- static tables ----------
  function table(id, head, rows) {
    const t = $(id); t.innerHTML = `<thead><tr>${head.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => r.sec ? `<tr class="sec"><td colspan="${head.length}">${r.sec}</td></tr>` : `<tr>${r.map(c => `<td${c && c.cls ? ` class="${c.cls}"` : ""}>${c && c.v != null ? c.v : c}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }
  const H = ["", ...COS.map(co => `<span class="dot" style="background:${col(co)}"></span> ${co}`)];
  // mark the best in a row
  const best = (vals, fmt, hiGood = true) => { const ok = vals.filter(v => typeof v === "number"); const b = hiGood ? Math.max(...ok) : Math.min(...ok); return vals.map(v => typeof v === "number" ? {v: fmt(v), cls: v === b ? "best" : ""} : {v: v ?? "n/d"}); };

  function govTable() {
    const g = D.governance, sc = M.govScore(D);
    const rows = g.criteria.map((c, i) => [`${c.name} <small style="color:var(--muted)">(${Math.round(c.weight * 100)}%)</small>`, ...COS.map(co => ({v: c.scores[co].toFixed(1), cls: "sc", i, co}))]);
    const order = COS.slice().sort((a, b) => sc[b] - sc[a]);
    rows.push([`<b>Weighted score (out of 5)</b>`, ...COS.map(co => ({v: `<b>${sc[co].toFixed(2)}</b>`}))]);
    rows.push([`Rank`, ...COS.map(co => order.indexOf(co) + 1)]);
    const t = $("t-gov");
    t.innerHTML = `<thead><tr>${H.map(h => `<th>${h}</th>`).join("")}</tr></thead><tbody>${rows.map(r => `<tr>${r.map(c => typeof c === "object" ? `<td${c.i != null ? ` tabindex="0" data-i="${c.i}" data-co="${c.co}"` : ""} ${c.i != null ? `style="background:rgba(122,31,43,${(+c.v - 1) / 4 * 0.22})"` : ""}>${c.v}</td>` : `<td>${c}</td>`).join("")}</tr>`).join("")}</tbody>`;
    const why = $("gov-why");
    const showWhy = td => { const c = g.criteria[+td.dataset.i]; why.innerHTML = `<b>${td.dataset.co}, ${c.name.toLowerCase()} (${c.scores[td.dataset.co].toFixed(1)}/5):</b> ${c.why[td.dataset.co]}.`; };
    t.querySelectorAll("td[data-i]").forEach(td => { td.addEventListener("click", () => showWhy(td)); td.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); showWhy(td); } }); });
    why.textContent = (g.common || "") + " Click a score to see the reason.";
  }

  function expTable(F) {
    const x = co => D.inputs.companies[co].expansion;
    table("t-exp", H, [
      ["Beds today", ...COS.map(co => f0(x(co).beds_now))],
      ["Beds planned", ...best(COS.map(co => x(co).beds_added), f0)],
      ["Growth on today's beds", ...best(COS.map(co => x(co).beds_added / x(co).beds_now), v => pct(v, 0))],
      ["Capex, ₹ crore", ...COS.map(co => f0(x(co).capex_cr))],
      ["Capex per bed, ₹ crore", ...best(COS.map(co => x(co).capex_cr / x(co).beds_added), v => v.toFixed(2), false)],
      ["Done by", ...COS.map(co => x(co).by_year)],
      ["ROCE FY26", ...best(COS.map(co => D.inputs.companies[co].hist.roce[2]), v => pct(v, 0))],
      ["Net debt / EBITDA FY29E", ...best(COS.map(co => F[co].lev29), xx, false)],
    ]);
  }

  // ---------- render ----------
  function render() {
    const F = M.runAll(D, S);
    const R = M.ranking(D, F, S.W);
    const scName = {1: "base case", 2: "bull case", 3: "drug-price curb case"}[S.sc];

    // the call
    const top = R.order[0], last = R.order[R.order.length - 1];
    const tf = F[top];
    $("call").innerHTML = `<div><b>The call (${scName}):</b> ${NAME[top]} is the top pick, with a target of ${rs(tf.tp)} (${spct(tf.upside)}). ${NAME[last]} ranks last${F[last].upside < 0 ? `, with ${spct(F[last].upside)} to target` : ""}.</div><div class="order">${R.order.map((co, i) => `<span class="pill"><span class="dot" style="background:${col(co)}"></span>${i + 1}. ${co} · ${R.total[co].toFixed(2)}</span>`).join("")}</div>`;

    // tiles
    $("tiles").innerHTML = COS.map(co => { const f = F[co]; return `<div class="tile" style="--c:${col(co)}"><h3>${NAME[co]}</h3><p class="sub">Price ${rs(f.price)} · target ${f.tgt.toFixed(1)}x FY28E EBITDA</p><div class="big ${f.upside >= 0 ? "up" : "down"}">${spct(f.upside)}</div><div class="row"><span>Target ${rs(f.tp)}</span><span>EV/EBITDA FY27E ${xx(f.evx[0])}</span></div><div class="row"><span>P/E FY28E ${xx(f.pe[1])}</span><span>Rank ${R.order.indexOf(co) + 1}</span></div></div>`; }).join("");

    // record
    const yrs = F.Apollo.years;
    lineChart($("ch-rev"), COS.map(co => ({co, values: F[co].rev.map(v => v / F[co].rev[0] * 100)})), yrs, v => v.toFixed(0), {split: 3, label: "Revenue indexed to FY23"});
    lineChart($("ch-margin"), COS.map(co => ({co, values: F[co].margin})), yrs, (v, ax) => pct(v, ax ? 0 : 1), {split: 3, min: 0.10, label: "EBITDA margin"});
    table("t-record", H, [
      {sec: "FY23 to FY26"},
      ["Revenue FY26, ₹ crore", ...COS.map(co => f0(F[co].rev[3]))],
      ["Revenue CAGR", ...best(COS.map(co => F[co].revCagrHist), v => pct(v))],
      ["EBITDA CAGR", ...best(COS.map(co => F[co].ebitdaCagrHist), v => pct(v))],
      ["Net profit CAGR", ...best(COS.map(co => F[co].patCagrHist), v => pct(v))],
      ["EBITDA margin FY26", ...best(COS.map(co => F[co].margin[3]), v => pct(v))],
      ["Margin change FY23 to FY26", ...best(COS.map(co => F[co].margin[3] - F[co].margin[0]), v => (v >= 0 ? "+" : "−") + Math.abs(v * 100).toFixed(1) + " pp")],
      ["ROCE FY26", ...best(COS.map(co => D.inputs.companies[co].hist.roce[2]), v => pct(v, 0))],
      ["H1 FY27 revenue growth", ...best(COS.map(co => F[co].h1g), v => pct(v))],
    ]);

    // forecast
    lineChart($("ch-ebitda"), COS.map(co => ({co, values: F[co].ebitda.slice(3)})), yrs.slice(3), v => f0(v), {split: 0, label: "EBITDA forecast", focus: S.pick === "all" ? null : S.pick});
    table("t-fc", ["", ...H.slice(1)], [
      {sec: "Forecast, " + scName},
      ["Revenue FY29E, ₹ crore", ...COS.map(co => f0(F[co].rev[6]))],
      ["Revenue CAGR FY26 to FY29E", ...best(COS.map(co => F[co].revCagr), v => pct(v))],
      ["EBITDA FY29E, ₹ crore", ...COS.map(co => f0(F[co].ebitda[6]))],
      ["EBITDA CAGR FY26 to FY29E", ...best(COS.map(co => F[co].ebitdaCagr), v => pct(v))],
      ["EPS CAGR (FY26 one-offs removed)", ...best(COS.map(co => F[co].epsCagr), v => pct(v))],
      ["EBITDA margin FY29E", ...best(COS.map(co => F[co].margin[6]), v => pct(v))],
      ["Net debt / EBITDA FY29E", ...COS.map(co => xx(F[co].lev29))],
      {sec: "Valuation"},
      ["EV / EBITDA FY27E", ...best(COS.map(co => F[co].evx[0]), xx, false)],
      ["EV / EBITDA FY28E", ...best(COS.map(co => F[co].evx[1]), xx, false)],
      ["P / E FY28E", ...best(COS.map(co => F[co].pe[1]), xx, false)],
      ["EV per operating bed, ₹ crore", ...best(COS.map(co => F[co].evPerBed), v => v.toFixed(2), false)],
      ["Target price", ...COS.map(co => rs(F[co].tp))],
      ["Upside / (downside)", ...best(COS.map(co => F[co].upside), v => spct(v))],
    ]);

    // drugs
    const ds = M.drugScore(D, F);
    hbar($("ch-drug"), COS.slice().sort((a, b) => ds[b] - ds[a]).map(co => ({co, bars: [{v: ds[co], name: "Exposure score"}]})), v => v.toFixed(2), {max: 1, label: "Drug-pricing exposure"});
    const base = M.runAll(D, Object.assign({}, S, {sc: 1})), curb = M.runAll(D, Object.assign({}, S, {sc: 3}));
    hbar($("ch-curb"), COS.map(co => ({co, bars: [{v: base[co].upside, name: "Base case"}, {v: curb[co].upside, name: "Curb case", pattern: true, extra: `EBITDA FY28E cut by ${f0(base[co].ebitda[5] - curb[co].ebitda[5])} crore`}]})), v => spct(v, 0), {hatch: true, rowH: 50, label: "Upside base vs curb"});
    const hc = $("ch-curb"); if (!hc.nextElementSibling) { const lg = document.createElement("div"); lg.className = "legend"; lg.innerHTML = `<span><span class="sw" style="background:#8a7f7f"></span>Base case (solid)</span><span><span class="sw" style="background:repeating-linear-gradient(45deg,#8a7f7f 0 2px,#e8e2df 2px 5px)"></span>Curb case (hatched)</span>`; hc.after(lg); }
    const e = co => D.inputs.companies[co].exposure, k = co => D.inputs.companies[co];
    table("t-drug", H, [
      ["Oncology share of revenue", ...best(COS.map(co => e(co).oncology_share), v => pct(v, 0))],
      ["Government and institutional payer share", ...best(COS.map(co => e(co).institutional_share), v => pct(v, 0))],
      ["Pharmacy distribution share of revenue", ...best(COS.map(co => e(co).pharmacy_rev_share), v => pct(v, 0))],
      ["Modelled EBITDA hit if curbs widen", ...best(COS.map(co => k(co).curb_ebitda_hit * S.adj[co].curbMult), v => pct(v, 1))],
      ["Trailing P/E (premium at risk)", ...best(COS.map(co => e(co).pe_ttm), xx)],
      ["Jefferies order (1 = least affected)", ...COS.map(co => e(co).jefferies_rank)],
      ["Exposure score", ...best(COS.map(co => ds[co]), v => v.toFixed(2))],
    ]);

    // expansion
    const es = M.expansionScore(D, F);
    hbar($("ch-exp"), COS.slice().sort((a, b) => es[b] - es[a]).map(co => ({co, bars: [{v: es[co], name: "Expansion score"}]})), v => v.toFixed(2), {max: 1, label: "Expansion score"});
    expTable(F);

    // ranking
    const pn = {growth: "Growth", upside: "Upside", expansion: "Expansion", drug: "Drug resilience", gov: "Governance"};
    hbar($("ch-rank"), R.order.map(co => ({co, bars: [{v: R.total[co], name: "Overall score", extra: Object.keys(pn).map(p => `${pn[p]}: ${R.scaled[p][co].toFixed(2)}`).join("<br>")}]})), v => v.toFixed(2), {max: 1, label: "Overall ranking"});
    $("rank-legend").innerHTML = `<span>Hover a bar for its five pillar scores. Weights are renormalised to 100%.</span>`;
  }

  govTable();
  $("method").innerHTML = `Model: hospital revenue = prior year × bed growth × occupancy change × (1 + revenue-per-bed growth); other segments grow at set rates. EV = market cap + Sep-26 net debt. Target = multiple × FY28E EBITDA less FY28E net debt. Bull case: +2 pp occupancy, +2 pp revenue-per-bed growth, +1 pp margin. Curb case: margin caps widen beyond the 137 cancer drugs, with a company-specific revenue-per-bed drag and EBITDA hit. ${D.prices_note}. Built ${D.built}.`;
  render();
  let rzT, rzW = innerWidth; addEventListener("resize", () => { clearTimeout(rzT); rzT = setTimeout(() => { if (Math.abs(innerWidth - rzW) > 40) { rzW = innerWidth; render(); } }, 200); });
})();
