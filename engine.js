// Mirrors model/india-hospitals-model.xlsx (company sheets, Summary, DrugPricing, Expansion, Governance, Ranking).
(function (root) {
  const COS = ["Apollo", "Fortis", "Max", "Medanta"];
  const sum = a => a.reduce((x, y) => x + y, 0);

  // opts: {sc:1|2|3, dOcc, dArpob, dMargin (absolute, added every forecast year), curbMult, tgt:{co:x}}
  function forecast(D, co, opts) {
    const k = D.inputs.companies[co], bull = D.inputs.scenario_deltas.bull, sc = opts.sc || 1;
    const cm = opts.curbMult == null ? 1 : opts.curbMult;
    const h = k.hist, out = {years: ["FY23", "FY24", "FY25", "FY26", "FY27E", "FY28E", "FY29E"]};
    let hrev = [k.hosp_rev_fy26], s1 = [k.seg1.rev_fy26], s2 = [k.seg2.rev_fy26];
    let beds = [k.beds_fy26].concat(k.beds), occ = [k.occ_fy26];
    const rev = [], ebitda = [], pat = [], eps = [], fcf = [], nd = [k.net_debt_sep26], hit = [];
    for (let i = 0; i < 3; i++) {
      const o = k.occ[i] + (sc === 2 ? bull.occ_pp : 0) + (opts.dOcc || 0);
      const a = k.arpob_g[i] + (sc === 2 ? bull.arpob_pp : sc === 3 ? k.curb_arpob_pp * cm : 0) + (opts.dArpob || 0);
      const m = k.hosp_margin[i] + (sc === 2 ? bull.margin_pp : 0) + (opts.dMargin || 0);
      const g1 = k.seg1.g[i] + (sc === 3 ? k.curb_seg1_g_pp * cm : 0);
      occ.push(o);
      hrev.push(hrev[i] * (beds[i + 1] / beds[i]) * (o / occ[i]) * (1 + a));
      s1.push(s1[i] * (1 + g1)); s2.push(s2[i] * (1 + k.seg2.g[i]));
      const r = hrev[i + 1] + s1[i + 1] + s2[i + 1];
      const pre = hrev[i + 1] * m + s1[i + 1] * k.seg1.margin[i] + s2[i + 1] * k.seg2.margin[i];
      const ht = pre * (sc === 3 ? k.curb_ebitda_hit * cm : 0);
      const e = pre - ht;
      const pbt = e - r * k.da_pct[i] - k.interest[i] + k.other_inc[i];
      const tax = pbt * k.tax[i], p = pbt - tax;
      const cfo = e * k.cfo_conv - tax, f = cfo - k.capex[i] - k.interest[i] + k.other_inc[i];
      rev.push(r); ebitda.push(e); pat.push(p); eps.push(p * k.attrib / k.shares_cr); fcf.push(f); hit.push(ht);
      nd.push(nd[i] - (i === 0 ? 0.5 : 1) * f);
    }
    const fy23 = h.fy23;
    out.rev = [fy23.rev].concat(h.rev, rev);
    out.ebitda = [fy23.ebitda].concat(h.ebitda, ebitda);
    out.pat = [fy23.pat].concat(h.pat, pat);
    out.margin = out.rev.map((r, i) => out.ebitda[i] / r);
    const epsNorm = (h.pat[2] - (k.oneoff_fy26_pat || 0)) * k.attrib / k.shares_cr;
    out.eps = [null].concat(h.eps, eps);
    out.nd = nd; out.fcf = fcf; out.hit = hit; out.hosp = hrev; out.occ = occ; out.beds = beds;
    const mcap = k.price * k.shares_cr, ev = mcap + k.net_debt_sep26;
    const tgt = (opts.tgt && opts.tgt[co]) || k.target_ev_ebitda;
    const tp = (tgt * ebitda[1] - nd[2]) / k.shares_cr;
    Object.assign(out, {
      price: k.price, mcap, ev, tgt, tp, upside: tp / k.price - 1,
      evx: ebitda.map(e => ev / e), pe: eps.map(x => k.price / x),
      revCagrHist: Math.pow(h.rev[2] / fy23.rev, 1 / 3) - 1,
      ebitdaCagrHist: Math.pow(h.ebitda[2] / fy23.ebitda, 1 / 3) - 1,
      patCagrHist: Math.pow(h.pat[2] / fy23.pat, 1 / 3) - 1,
      revCagr: Math.pow(rev[2] / h.rev[2], 1 / 3) - 1,
      ebitdaCagr: Math.pow(ebitda[2] / h.ebitda[2], 1 / 3) - 1,
      epsCagr: Math.pow(eps[2] / epsNorm, 1 / 3) - 1,
      lev29: nd[3] / ebitda[2], evPerBed: ev / k.op_beds_now,
      h1g: h.h1fy27_rev / h.h1fy26_rev - 1
    });
    return out;
  }

  const num = v => typeof v === "number" && isFinite(v);
  function drugScore(D, F) {
    const f = [["oncology_share", 0.30], ["institutional_share", 0.15], ["pharmacy_rev_share", 0.15], ["hit", 0.25], ["pe_ttm", 0.15]];
    const raw = co => f.map(([key]) => key === "hit" ? D.inputs.companies[co].curb_ebitda_hit : D.inputs.companies[co].exposure[key]);
    const vals = Object.fromEntries(COS.map(co => [co, raw(co)]));
    const mx = f.map((_, j) => Math.max(...COS.map(co => vals[co][j]).filter(num)));
    return Object.fromEntries(COS.map(co => {
      let n = 0, d = 0;
      f.forEach(([, w], j) => { const v = vals[co][j]; if (num(v)) { n += v / mx[j] * w; d += w; } });
      return [co, n / d];
    }));
  }
  function expansionScore(D, F) {
    const x = co => D.inputs.companies[co].expansion;
    const m = {
      growth: COS.map(co => x(co).beds_added / x(co).beds_now),
      cpb: COS.map(co => x(co).capex_cr / x(co).beds_added),
      near: COS.map(co => x(co).beds_in_fy28_29 / x(co).beds_added),
      lev: COS.map(co => F[co].lev29),
      roce: COS.map(co => D.inputs.companies[co].hist.roce[2])
    };
    const mx = a => Math.max(...a), mn = a => Math.min(...a);
    return Object.fromEntries(COS.map((co, i) => [co,
      0.30 * m.growth[i] / mx(m.growth) + 0.25 * mn(m.cpb) / m.cpb[i] + 0.20 * m.near[i] / mx(m.near) +
      0.10 * (1 - (m.lev[i] - mn(m.lev)) / (mx(m.lev) - mn(m.lev) + 0.0001)) + 0.15 * m.roce[i] / mx(m.roce)]));
  }
  function govScore(D) {
    const c = D.governance.criteria, w = sum(c.map(x => x.weight));
    return Object.fromEntries(COS.map(co => [co, sum(c.map(x => x.scores[co] * x.weight)) / w]));
  }
  // weights: {growth, upside, expansion, drug, gov}
  function ranking(D, F, W) {
    const pillars = {
      growth: Object.fromEntries(COS.map(co => [co, F[co].ebitdaCagr])),
      upside: Object.fromEntries(COS.map(co => [co, F[co].upside])),
      expansion: expansionScore(D, F),
      drug: drugScore(D, F),
      gov: govScore(D)
    };
    const scaled = {};
    for (const [p, v] of Object.entries(pillars)) {
      const a = COS.map(co => v[co]), lo = Math.min(...a), hi = Math.max(...a);
      scaled[p] = Object.fromEntries(COS.map(co => [co, hi === lo ? 0.5 : (p === "drug" ? (hi - v[co]) : (v[co] - lo)) / (hi - lo)]));
    }
    const tw = sum(Object.values(W));
    const total = Object.fromEntries(COS.map(co => [co, tw ? sum(Object.keys(W).map(p => W[p] * scaled[p][co])) / tw : 0]));
    const order = COS.slice().sort((a, b) => total[b] - total[a]);
    return {pillars, scaled, total, order};
  }
  function runAll(D, opts) {
    const F = Object.fromEntries(COS.map(co => [co, forecast(D, co, opts)]));
    return F;
  }
  root.HModel = {COS, forecast, runAll, drugScore, expansionScore, govScore, ranking,
    DEFAULT_W: {growth: 0.25, upside: 0.25, expansion: 0.15, drug: 0.15, gov: 0.20}};
  if (typeof module !== "undefined") module.exports = root.HModel;
})(typeof window !== "undefined" ? window : globalThis);
