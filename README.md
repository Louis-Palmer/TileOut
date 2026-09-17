# TileOut

A tile calculator: enter a room's dimensions and a tile size, and it works
out how many tiles/packs you need, how many need cutting, and how many
spares you'll have left over.

## Running locally

```bash
npm install
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000).

## How it's organised

- `src/lib/shapes/` — room shapes. Only `rectangle.ts` exists so far; every
  shape implements the `RoomShape` interface in `types.ts`, so new shapes
  (L-shaped rooms, etc.) can be added without touching anything else.
- `src/lib/patterns/` — tiling patterns. Only `grid.ts` (straight,
  edge-to-edge) exists so far; new patterns (diagonal, herringbone,
  brick-bond) implement the `TilePattern` interface in `types.ts`.
- `src/lib/tiling.ts` — the calculation engine. Takes a room, a tile size,
  and a pattern, and works out full vs. cut tiles, reusing offcuts for
  later cuts where they're big enough, then how many packs to buy.
- `src/data/tile-presets.json` — common tile sizes shown in the dropdown.
  This is a static file for now; it's a natural place to swap in a real
  database later without changing the calculation code.
- `src/app/page.tsx` — the (single-page, for now) UI.

## Deploying

This is a standard Next.js app, so it deploys to
[Vercel](https://vercel.com/new) by connecting your GitHub repo — pushes to
the main branch deploy automatically, no server to manage.

## Commit message format

```
<type>-<state>: <message>
```

Example: `feat-wip: Setup landing page`

**Type**
- `feat` — new feature
- `fix` — bug fix
- `com` — comment or documentation change
- `style` — style change, doesn't affect function
- `ref` — code change that isn't a bug fix or new feature
- `perf` — performance change
- `test` — test-related code
- `imp` — importing/adding new files, such as packages and images

**State**
- `wip` — work in progress, incomplete code
- `fin` — the currently scoped, finished version of the code (doesn't mean it can't change later)
