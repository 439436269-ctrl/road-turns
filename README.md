# @vfvrpq/road-turns

Find **hairpin turns** and **turn clusters** in road geometry — built for touge analysis
(峠), cycling climb scouting, and driving-route storytelling.

Input is an [OpenStreetMap Overpass](https://overpass-turbo.eu/) JSON (`out geom;`) or a plain
`[[lon, lat], ...]` polyline. Output is the turn list (angle, coordinates, cumulative distance)
plus **clusters** of adjacent hairpins — e.g. the famous "five hairpins in a row".

## Why cross-window?

On dense polylines (8 m point spacing, typical for OSM), a 100°+ hairpin is spread over 5–8
segments, so per-segment heading deltas never exceed ~20°. Naive analysis reports nothing.
`road-turns` compares the **heading before** vs **heading after** a ±W-segment window
(default ±5 ≈ ±40 m), which recovers the true turn angle at the apex.

Also: don't thin your data before analysis — decimating to 30 m spacing turned a real
164° hairpin into a mere 103° (measured on Mount Haruna, Gunma).

## CLI

```bash
npx @vfvrpq/road-turns overpass.json --reverse          # report
npx @vfvrpq/road-turns overpass.json --ref 33 --json    # pick way by OSM ref, JSON output
npx @vfvrpq/road-turns --points "[[138.89,36.48],...]" --min 90
```

Options: `--ref` pick way by ref · `--way-idx` n-th way · `--min` min angle (60) ·
`--window` half-width in segments (5) · `--dedup` min gap between turns, m (45) ·
`--group` cluster adjacency, m (160) · `--reverse` walk the other direction · `--json`

Example report (real data, 県道33号 over Mount Haruna — the Initial-D "Akina" prototype):

```
road: 渋川松井田線  |  points: 487  |  length: 7416 m
turns (>=60°): 21
...
clusters (adjacent < 160 m):
  #9: 3 turns [96.7/118.4/79.4] span 159 m from 3795 m, center [36.4973N, 138.9044E]
  #10: 2 turns [91.7/90] span 99 m from 4192 m, center [36.4989N, 138.9061E]
```

→ the "five hairpins in a row" of Initial-D fame: 5 turns ≥79° within 496 m.

## API

```js
const { fromOverpass, analyze } = require('@vfvrpq/road-turns');

const { points } = fromOverpass(overpassJson, { ref: '33' });
const { meta, turns, groups } = analyze(points, { reverse: true, minTurn: 60 });

// turns: [{ i, turn, at:[lon,lat], gapM, cumM }]
// groups: [{ seq, count, turns:[deg], spanM, startCumM, center:[lon,lat] }]
```

`analyze(points, opts)` opts: `window` (5), `minTurn` (60), `dedupM` (45), `groupGapM` (160), `reverse`.

## Accuracy notes

- Angles are computed on WGS84 with equirectangular local metric projection — fine for ≤10 km extents.
- Point spacing matters: analysis wants ≤15 m spacing; thicken with interpolated Overpass
  geometry rather than decimated traces.
- Angles are the road's plan-view deflection, not steering angle — a 164° hairpin is
  "nearly a U-turn on the map".

## Real-world validation

Mount Haruna, Gunma, Japan (県道33号渋川松井田線, 487-pt OSM trace, 7.4 km):
21 turns ≥60°, 12 turns ≥90°, max **164.1°**, and a **5-hairpin cluster inside 496 m**
(96.7° / 118.4° / 79.4° / 91.7° / 90.0°) at cum 3.8–4.3 km. `npm test` asserts all of it.

Test fixture `tests/haruna-kenodo33.json` contains a small excerpt of OSM way data
(© OpenStreetMap contributors, ODbL).

## License

MIT
