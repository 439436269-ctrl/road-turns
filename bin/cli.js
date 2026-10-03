#!/usr/bin/env node
'use strict';
/**
 * road-turns — find hairpin turns & turn clusters in road geometry from Overpass data
 *
 * Usage:
 *   road-turns <overpass.json> [options]
 *   road-turns --points "[[138.89,36.48],[138.90,36.49],...]" [options]
 *
 * Options:
 *   --ref <ref>       pick way by OSM ref (e.g. 33 for 県道33号)
 *   --way-idx <n>     pick the n-th way (0-based)
 *   --min <deg>       minimum turn angle to report (default 60)
 *   --window <n>      cross-window half-width in segments (default 5 ≈ ±40m @8m spacing)
 *   --dedup <m>       min distance between reported turns (default 45)
 *   --group <m>       adjacency threshold for clusters (default 160)
 *   --reverse         walk the polyline in reverse (downhill direction)
 *   --json            output JSON instead of a report
 */
const fs = require('fs');
const { fromOverpass, analyze } = require('../lib/turns');

const args = process.argv.slice(2);
const opt = {};
let file = null, points = null;
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a === '--ref') opt.ref = args[++i];
  else if (a === '--way-idx') opt.wayIdx = parseInt(args[++i]);
  else if (a === '--min') opt.minTurn = parseFloat(args[++i]);
  else if (a === '--window') opt.window = parseInt(args[++i]);
  else if (a === '--dedup') opt.dedupM = parseFloat(args[++i]);
  else if (a === '--group') opt.groupGapM = parseFloat(args[++i]);
  else if (a === '--reverse') opt.reverse = true;
  else if (a === '--json') opt.json = true;
  else if (a === '--points') points = JSON.parse(args[++i]);
  else if (a === '--help' || a === '-h') { console.log(fs.readFileSync(__dirname + '/../README.md', 'utf8').split('## CLI')[1] || 'see README'); process.exit(0); }
  else file = a;
}

let result, name = 'way';
if (points) {
  result = analyze(points, opt);
} else {
  if (!file) { console.error('usage: road-turns <overpass.json> [options]  (see --help)'); process.exit(1); }
  const json = JSON.parse(fs.readFileSync(file, 'utf8'));
  const ex = fromOverpass(json, opt);
  if (!ex) { console.error('no matching way in input'); process.exit(1); }
  name = ex.name;
  result = analyze(ex.points, opt);
}

if (opt.json) {
  console.log(JSON.stringify({ name, ...result }, null, 1));
  process.exit(0);
}

console.log(`road: ${name}  |  points: ${result.meta.points}  |  length: ${result.meta.lenM} m`);
console.log(`turns (>=${
  opt.minTurn || 60}°): ${result.turns.length}`);
console.log('');
console.log('seq  turn   coord                  gap     cum');
result.turns.forEach((t, idx) => {
  console.log(
    String(idx + 1).padStart(3) + '  ' +
    String(t.turn.toFixed(0) + '°').padStart(5) + '  [' +
    t.at[1].toFixed(4) + 'N,' + t.at[0].toFixed(4) + 'E]  ' +
    String(t.gapM === null ? '—' : t.gapM + 'm').padStart(7) + '  ' +
    String(t.cumM + 'm').padStart(7)
  );
});
console.log('\nclusters (adjacent < ' + (opt.groupGapM || 160) + ' m):');
for (const g of result.groups) {
  console.log(`  #${g.seq}: ${g.count} turns [${g.turns.join('/')}] span ${g.spanM} m from ${g.startCumM} m, center [${g.center[1].toFixed(4)}N, ${g.center[0].toFixed(4)}E]`);
}
