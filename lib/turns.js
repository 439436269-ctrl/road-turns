'use strict';
/**
 * road-turns — find hairpin turns & turn clusters in road geometry
 * Input: OpenStreetMap Overpass JSON (out geom) or a plain array of [lon, lat]
 * Method: cross-window bearing analysis (heading change over ±W segments),
 *         which stays accurate on dense polylines where per-segment deltas wash out.
 */

function toRad(d) { return (d * Math.PI) / 180; }
function toDeg(r) { return (r * 180) / Math.PI; }

function distM(a, b) {
  const mLat = 111320;
  const mLon = Math.cos(toRad((a[1] + b[1]) / 2)) * mLat;
  return Math.hypot((a[0] - b[0]) * mLon, (a[1] - b[1]) * mLat);
}

function bearingDeg(a, b) {
  const y = Math.sin(toRad(b[0] - a[0])) * Math.cos(toRad(b[1]));
  const x = Math.cos(toRad(a[1])) * Math.sin(toRad(b[1])) -
    Math.sin(toRad(a[1])) * Math.cos(toRad(b[1])) * Math.cos(toRad(b[0] - a[0]));
  return toDeg(Math.atan2(y, x));
}

/** Extract the longest (or ref-matching) way geometry from an Overpass JSON. */
function fromOverpass(json, opts) {
  opts = opts || {};
  const ways = (json.elements || []).filter(e => e.type === 'way' && Array.isArray(e.geometry));
  let seg = null;
  if (opts.wayIdx !== undefined) seg = ways[opts.wayIdx];
  else if (opts.ref) seg = ways.find(w => w.tags && w.tags.ref === String(opts.ref));
  if (!seg) {
    for (const w of ways) {
      if (opts.minPts && w.geometry.length < opts.minPts) continue;
      if (!seg || w.geometry.length > seg.geometry.length) seg = w;
    }
  }
  if (!seg) return null;
  const points = seg.geometry.map(p => [+p.lon.toFixed(6), +p.lat.toFixed(6)]);
  return { points, tags: seg.tags || {}, name: (seg.tags && (seg.tags.name || seg.tags.ref)) || 'way' };
}

/**
 * Analyze a polyline for hairpin turns and turn clusters.
 * points: [[lon, lat], ...]  opts: {window=5, minTurn=60, dedupM=45, groupGapM=160, reverse=false}
 * Returns { meta, turns, groups }
 *  - turns: [{ i, turn, at:[lon,lat], gapM, cumM }]
 *  - groups: [{ seq, count, turns:[deg], spanM, startCumM, center:[lon,lat] }]  (adjacent < groupGapM)
 */
function analyze(points, opts) {
  opts = opts || {};
  const W = opts.window || 5;
  const minTurn = opts.minTurn || 60;
  const dedupM = opts.dedupM || 45;
  const groupGapM = opts.groupGapM || 160;
  let pts = points.map(p => [+p[0].toFixed ? +p[0] : +p[0], +p[1]]);
  if (opts.reverse) pts = [...pts].reverse();
  if (pts.length < W * 2 + 2) return { meta: { points: pts.length, lenM: 0 }, turns: [], groups: [] };

  // total length
  let lenM = 0;
  for (let i = 1; i < pts.length; i++) lenM += distM(pts[i - 1], pts[i]);

  // heading between consecutive points
  const brgs = [];
  for (let i = 0; i < pts.length - 1; i++) brgs.push(bearingDeg(pts[i], pts[i + 1]));

  // cross-window turn at each point
  const turns = [];
  for (let i = W; i < pts.length - W; i++) {
    const bIn = brgs[i - 1] !== undefined ? bearingDeg(pts[i - W], pts[i]) : 0;
    const bOut = bearingDeg(pts[i], pts[i + W]);
    let dA = bOut - bIn;
    while (dA > 180) dA -= 360;
    while (dA < -180) dA += 360;
    turns.push({ i, turn: Math.abs(dA), at: pts[i] });
  }

  // local maxima + dedup by distance
  const picked = [];
  for (const c of [...turns].sort((a, b) => b.turn - a.turn)) {
    if (c.turn < minTurn) continue;
    const isLocalMax = turns.every(t => Math.abs(t.i - c.i) > W || t.turn <= c.turn);
    if (isLocalMax && picked.every(p => distM(p.at, c.at) > dedupM)) picked.push(c);
  }
  picked.sort((a, b) => a.i - b.i);

  let cum = 0;
  const result = picked.map((p, k) => {
    const gapM = k ? Math.round(distM(picked[k - 1].at, p.at)) : null;
    if (k) cum += gapM;
    return { i: p.i, turn: Math.round(p.turn * 10) / 10, at: p.at, gapM, cumM: k ? Math.round(cum) : 0 };
  });

  // clusters
  const rawGroups = [];
  for (const p of result) {
    const g = rawGroups[rawGroups.length - 1];
    if (g && p.gapM !== null && p.gapM < groupGapM) g.push(p);
    else rawGroups.push([p]);
  }
  const groups = rawGroups.map((g, i) => {
    const spanM = g[g.length - 1].cumM - g[0].cumM;
    const mid = g[Math.floor(g.length / 2)].at;
    return {
      seq: i + 1,
      count: g.length,
      turns: g.map(x => x.turn),
      spanM,
      startCumM: g[0].cumM,
      center: mid,
    };
  });

  return { meta: { points: pts.length, lenM: Math.round(lenM) }, turns: result, groups };
}

module.exports = { fromOverpass, analyze, distM, bearingDeg };
