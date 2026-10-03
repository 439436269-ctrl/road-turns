'use strict';
// Regression: real-world Mount Haruna data (県道33号, the Initial-D "Akina" prototype road).
// Known truth from 2026-09-27 survey: 21 turns >=60deg, max 164deg,
// and a five-turn cluster (97/118/79/92/90) within 500 m around cum 3800-4300 m.
const fs = require('fs');
const path = require('path');
const { fromOverpass, analyze } = require('../lib/turns');

const json = JSON.parse(fs.readFileSync(path.join(__dirname, 'haruna-kenodo33.json'), 'utf8'));
const ex = fromOverpass(json, { ref: '33' });
if (!ex) { console.error('FAIL: way not found'); process.exit(1); }

const downhill = analyze(ex.points, { reverse: true });
const up = analyze(ex.points, {});

let fail = 0;
const assert = (cond, msg) => { if (!cond) { fail++; console.error('FAIL:', msg); } else console.log('ok:', msg); };

assert(downhill.meta.points === 487, '487 points loaded');
assert(downhill.turns.length === 21, `21 turns >=60deg (got ${downhill.turns.length})`);
const max = Math.max(...downhill.turns.map(t => t.turn));
assert(Math.abs(max - 164.1) < 0.05, `max turn 164.1deg (got ${max})`);

// "five hairpins in a row": 5 turns within cum 3.7-4.4 km (cluster #9 + #10)
const inWindow = downhill.turns.filter(t => t.cumM >= 3700 && t.cumM <= 4400);
assert(inWindow.length === 5, `5 turns within 3.7-4.4 km (got ${inWindow.length})`);
const expect = [96.7, 118.4, 79.4, 91.7, 90];
inWindow.forEach((t, i) => assert(Math.abs(t.turn - expect[i]) <= 1.5, `window turn#${i + 1} ~${expect[i]}deg (got ${t.turn})`));
const span = inWindow[inWindow.length - 1].cumM - inWindow[0].cumM;
assert(span <= 500, `window span <=500 m (got ${span})`);

// direction sanity: reversing swaps the walk but turn count stays
assert(up.turns.length === downhill.turns.length, 'reverse keeps turn count');

// degenerate input should not throw
const tiny = analyze([[138, 36], [138.001, 36], [138.002, 36]]);
assert(tiny.turns.length === 0, 'tiny input handled');

console.log(fail ? `\n${fail} FAILURES` : '\nALL PASS');
process.exit(fail ? 1 : 0);
