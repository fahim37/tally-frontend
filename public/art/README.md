# Generated artwork

Everything in this folder is produced by `scripts/generate-art.mjs` (`npm run art`)
using Gemini's image model, and then baked down with sharp. The files are
committed — the app must build without an API key, and without a network.

```
tiles/<iconKey>.webp   256×256, transparent   one 3D object per icon key
hero-light.webp        900×506, opaque        the wash behind "Spent today"
hero-dark.webp         900×506, opaque
```

Roughly 140 KB for the whole set.

## Why the tiles are one set and the hero is two

The tile objects are a single flat mid-blue (`#4A78FF`), chosen because it clears
both surfaces the app has — 3.9:1 on white, 4.4:1 on `#141C2C`. That is what lets
one file serve both themes. They sit directly on the tile with no badge or plate
behind them, so they have to carry their own contrast.

The hero wash is the opposite case: it *is* a background, it has body text on top
of it, and it has to disappear into a surface whose colour changes. So it ships
per theme, and `.art-wash` in `globals.css` blends it (multiply in light, screen
in dark) rather than painting it over the card.

The wash is also strictly cool. Amber is a semantic colour here — it is how the
ring says "over budget" — so a warm bloom behind the ring reads as a warning that
isn't there.

## The green screen

The model returns opaque JPEG. It has no alpha channel, and if you ask for a
transparent background it paints a *picture* of the grey-and-white checkerboard a
photo editor would show. So the objects are generated against flat chroma green
and the alpha is cut locally in `chromaKey()`, including a de-spill pass that
removes the green fringe JPEG leaves around every silhouette.

## Changing them

```bash
npm run art                       # fill in anything missing
npm run art -- --force cig lunch  # redraw just these two
npm run art -- --force --rebake   # re-cut and repack, from cache, for free
```

Raw model output is cached in `scripts/.art-cache/` (gitignored). Generation is
the expensive half and the bake is deterministic, so **any** change to
thresholds, padding, sizing or compression should go through `--rebake` rather
than paying to draw the set again.

Adding an icon key to `lib/icons.ts` means adding a subject line to `SUBJECTS` in
the script. Without one, `TileArt` falls back to the `bag` object, the same way
the stroked icon set falls back to its glyph.
