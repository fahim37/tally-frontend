/**
 * Generates the Tap Pad's artwork with Gemini, then bakes it down to something
 * a phone can actually afford to download.
 *
 * Two kinds of asset come out of this:
 *
 *   public/art/tiles/<iconKey>.webp   — one 256px 3D object per expense icon,
 *                                       cut out to a real alpha channel so it
 *                                       sits directly on the tile's surface.
 *   public/art/hero-<theme>.webp      — the soft wash behind the "Spent today"
 *                                       figure, one per theme.
 *
 * The tile artwork is deliberately theme-INDEPENDENT — one set of files, not a
 * light and a dark copy. That is only possible because the objects are a single
 * flat mid-blue picked to clear both surfaces, which is also why the prompt is
 * so insistent about the colour.
 *
 * The model returns opaque JPEG. It cannot produce an alpha channel, and asked
 * for a transparent background it paints a *picture* of the checkerboard a
 * photo editor would show. So the objects are shot against flat chroma green
 * and the alpha is cut here, in `chromaKey`, where the result is exact.
 *
 * Usage:
 *   node scripts/generate-art.mjs              # only what's missing
 *   node scripts/generate-art.mjs --force      # regenerate everything
 *   node scripts/generate-art.mjs cig lunch    # just these
 *   node scripts/generate-art.mjs --force --rebake
 *                                              # re-cut the alpha and repack,
 *                                              # from cached model output, for
 *                                              # free — use this for every
 *                                              # change to the bake rather than
 *                                              # paying to draw them again
 *
 * The key is read from GEMINI_API_KEY, or from ../tally-backend/.env so the
 * secret stays in the one file that already holds it.
 */

import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const ART = resolve(ROOT, "public/art");
/** Raw model output, kept out of `public` — an input to the build, not an asset. */
const CACHE = resolve(ROOT, "scripts/.art-cache");

const MODEL = process.env.GEMINI_IMAGE_MODEL ?? "gemini-3-pro-image";
const ENDPOINT = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

/** The artwork renders at ~46px in the app; 256 keeps it crisp on a 3× screen. */
const STICKER_PX = 256;
/** A little air inside the square so a long object doesn't touch the edge. */
const STICKER_PAD = 8;
/** The geometric mean every object is normalised to — see `toSticker`. Tuned
 *  so squat shapes (the bowl, the gift) still land inside the frame. */
const TARGET_MEAN_PX = 172;

const HERO_W = 900;
const HERO_H = 506;

// ── Prompts ────────────────────────────────────────────────────────────────

/**
 * One style block, one variable. Fourteen separate generations only read as a
 * set if every word except the subject is identical between them — the palette,
 * the lighting, the finish and the framing all have to be nailed down here
 * rather than left to the model to re-invent per icon.
 *
 * Two things about this prompt are load-bearing.
 *
 * The green screen. The model returns opaque JPEG and cannot produce an alpha
 * channel — asked for a transparent background it paints a *picture* of the
 * grey-and-white checkerboard a photo editor would show. So the object is shot
 * against flat chroma green and the alpha is cut here, in `chromaKey`, where
 * the result is exact. Nothing in the palette below has green dominance, which
 * is what makes the key clean.
 *
 * And the object is one flat blue rather than white or a two-tone blend. These
 * sit directly on the tile's own surface — white in light, #141C2C in dark —
 * so the artwork has to carry its own contrast against both, and #4A78FF is
 * the value that clears each of them (3.9:1 and 4.4:1). The off-white objects
 * this replaced only worked because they had a saturated badge behind them.
 */
const stickerPrompt = (subject) => `A single 3D object, centred, filling most of the frame, on a completely flat solid pure chroma-key green (#00FF00) background.

The object is ${subject} — rendered as a soft-clay 3D model with rounded bevelled edges and a soft matte finish.

The object is ONE single flat colour: mid-blue #4A78FF. It is shaded only by light — a gentle top-left key light, soft self-shading in the recesses, and a restrained pale highlight where the light catches a top edge. No colour gradient, no two-tone blend, no colour ramp across the surface, no rainbow, no other hues at all. One blue, lit.

Isometric three-quarter view. Large, centred, simple enough to read clearly at 44 pixels.

The green background is perfectly uniform and flat: no gradient, no vignette, no ground plane, no cast shadow, no reflection, no contact shadow — the object floats. Green appears nowhere on the object itself.

Nothing else in the frame — no text, no letters, no numbers, no watermark, no border, no checkerboard, no transparency pattern.`;

/** Keyed to lib/icons.ts — every IconKey needs artwork, or its tile falls back
 *  to the `bag` sticker the way the stroked icon set falls back to its glyph. */
const SUBJECTS = {
  tea: "a cup of hot tea on a saucer with a curl of steam rising from it",
  cig: "a single lit cigarette, filter end towards the viewer",
  rick: "a three-wheeled auto rickshaw seen from the side",
  lunch: "a round bowl of hot food with a spoon resting beside it",
  data: "three rising signal bars, like a mobile data indicator",
  coffee: "a takeaway coffee cup with a domed lid and a sleeve",
  bag: "a shopping bag with two rounded handles",
  bill: "a paper receipt with a torn zig-zag bottom edge, curling slightly",
  grocery: "a grocery basket with a few rounded vegetables in it",
  medicine: "a medicine capsule lying beside a round tablet",
  fuel: "a fuel pump nozzle with its hose curling behind it",
  phone: "a smartphone standing upright, screen towards the viewer",
  gift: "a wrapped gift box with a ribbon bow on top",
  home: "a small house with a pitched roof and one window",
};

/**
 * The wash behind the day's total.
 *
 * Two constraints shape both of these, and neither is negotiable.
 *
 * It is strictly cool. Amber is a *semantic* colour in this app — it is how
 * the ring and the remaining-balance figure say "over budget" — so a warm
 * bloom in the decoration sits directly behind the one element whose colour
 * carries meaning, and dilutes it. The first pass had one; it read as a
 * warning that wasn't there.
 *
 * And it lives in the top-right. The eyebrow, the figure and the pace line all
 * run down the left, so the wash is asked to clear out of that corner
 * entirely rather than tint the whole card and drag the contrast of everything
 * written on it.
 */
const HERO = {
  light: `An abstract, extremely soft gradient wash on a pure white background.

A single wide, heavily blurred bloom of pale periwinkle (#E6ECFF) and light cornflower blue (#AFC2FF) sits in the TOP-RIGHT corner. It dissolves completely into clean flat white across the lower-left two thirds of the frame — the bottom-left half of the image is pure untinted white.

Everything is far out of focus, like frosted glass lit from behind. Very low contrast, pale and airy.

Strictly cool colours only: white, pale blue, pale lavender. No amber, no orange, no yellow, no gold, no pink, no warm tones of any kind. No hard edges, no shapes, no objects, no lines, no grain, no text, no watermark, no vignette.`,

  dark: `An abstract, extremely soft gradient wash on a deep navy background (#0B1220).

A single wide, heavily blurred glow of indigo (#1B4DFF) and periwinkle (#6E8CFF) sits in the TOP-RIGHT corner. It dissolves completely into flat deep navy across the lower-left two thirds of the frame — the bottom-left half of the image is pure untinted #0B1220.

Everything is far out of focus, like a distant nebula seen through glass. Low contrast, deep and moody, never bright.

Strictly cool colours only: navy, indigo, periwinkle. No amber, no orange, no yellow, no gold, no pink, no warm tones of any kind. No hard edges, no shapes, no stars, no objects, no lines, no grain, no text, no watermark.`,
};

// ── Gemini ─────────────────────────────────────────────────────────────────

/** A generation that came back wrong rather than a request that failed. Worth
 *  rolling the dice on again; a transport error is not. */
class RetryableArt extends Error {}

async function resolveKey() {
  if (process.env.GEMINI_API_KEY) return process.env.GEMINI_API_KEY;

  for (const candidate of [
    resolve(ROOT, ".env.local"),
    resolve(ROOT, "../tally-backend/.env"),
  ]) {
    if (!existsSync(candidate)) continue;
    const match = (await readFile(candidate, "utf8")).match(/^GEMINI_API_KEY\s*=\s*(.+)$/m);
    if (match) return match[1].trim().replace(/^["']|["']$/g, "");
  }

  throw new Error(
    "No GEMINI_API_KEY — set it in the environment, in .env.local, or in ../tally-backend/.env"
  );
}

/**
 * The image models are rate-limited per minute rather than per request, so a
 * run of sixteen will hit 429 partway through no matter how it's paced. The
 * API tells us how long to wait; the only thing to do is believe it.
 */
async function generate(key, prompt, aspectRatio, attempt = 1) {
  const response = await fetch(ENDPOINT(MODEL, key), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseModalities: ["IMAGE"],
        imageConfig: { aspectRatio, imageSize: "1K" },
      },
    }),
  });

  if (response.status === 429 || response.status >= 500) {
    if (attempt > 4) throw new Error(`Gave up after ${attempt} attempts (HTTP ${response.status})`);
    const body = await response.text();
    const retryIn = Number(body.match(/retry in ([\d.]+)s/i)?.[1] ?? 30);
    const wait = Math.ceil(Math.min(90, retryIn + 2));
    process.stdout.write(` rate-limited, waiting ${wait}s…`);
    await new Promise((done) => setTimeout(done, wait * 1000));
    return generate(key, prompt, aspectRatio, attempt + 1);
  }

  if (!response.ok) throw new Error(`HTTP ${response.status}: ${(await response.text()).slice(0, 300)}`);

  const parts = (await response.json()).candidates?.[0]?.content?.parts ?? [];
  const image = parts.find((part) => part.inlineData)?.inlineData;
  if (!image) throw new Error("No image in response — the prompt was probably refused");

  return Buffer.from(image.data, "base64");
}

// ── Post-processing ────────────────────────────────────────────────────────

/**
 * Cuts the chroma green out to a real alpha channel.
 *
 * "Greenness" is the green channel's lead over the strongest of the other two,
 * which is what separates a chroma backdrop from anything in the palette:
 * #00FF00 scores 255, the ice-blue highlight (#E6ECFF) scores -19, the blue
 * body scores lower still. So a single ramp between two thresholds gives a
 * soft-edged matte for free, rather than the jagged one a hard cut produces at
 * this resolution.
 *
 * The de-spill matters as much as the key. JPEG puts a green fringe a pixel or
 * two into every silhouette, and left alone it survives as a lime halo that is
 * obvious against a white tile. Pulling green back to the larger of red and
 * blue wherever it leads removes it without touching the object's own colour,
 * where green never leads.
 */
const KEY_OPAQUE = 30;
const KEY_CLEAR = 95;

async function chromaKey(jpeg) {
  const { data, info } = await sharp(jpeg)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  let opaquePixels = 0;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lead = g - Math.max(r, b);

    let alpha;
    if (lead >= KEY_CLEAR) alpha = 0;
    else if (lead <= KEY_OPAQUE) alpha = 255;
    else alpha = Math.round((255 * (KEY_CLEAR - lead)) / (KEY_CLEAR - KEY_OPAQUE));

    if (lead > 0) data[i + 1] = Math.max(r, b);
    data[i + 3] = alpha;
    if (alpha > 200) opaquePixels += 1;
  }

  return {
    raw: { data, info },
    coverage: opaquePixels / (info.width * info.height),
  };
}

/**
 * How much of the frame the object is allowed to occupy once keyed.
 *
 * Under the floor the key ate the subject, or the model drew something tiny.
 * Over the ceiling it never drew a background at all — a green-tinted scene
 * keys to nothing and arrives as a full opaque square.
 */
const MIN_COVERAGE = 0.04;
const MAX_COVERAGE = 0.82;

/** Key it, crop to the object, and centre it in a square with a little air. */
async function toSticker(jpeg, outPath) {
  const { raw, coverage } = await chromaKey(jpeg);

  if (coverage < MIN_COVERAGE || coverage > MAX_COVERAGE) {
    throw new RetryableArt(
      `keyed to ${(coverage * 100).toFixed(0)}% coverage — the green screen wasn't clean`
    );
  }

  const TRANSPARENT = { r: 0, g: 0, b: 0, alpha: 0 };

  // Three separate pipelines, deliberately. sharp honours exactly one resize
  // per pipeline and applies it before extend regardless of call order, so
  // chaining crop → fit → pad silently drops the middle step: the first version
  // of this asked for 256px squares and quietly produced 272px ones.
  const keyed = await sharp(raw.data, {
    raw: { width: raw.info.width, height: raw.info.height, channels: 4 },
  })
    .png()
    // Default trim keys off the top-left pixel, which is now fully transparent,
    // so this crops to the object however it happens to be framed.
    .trim()
    .toBuffer();

  /**
   * Sized on the geometric mean of the crop, not its longest side.
   *
   * Fitting the bounding box makes every object the same *width*, which is not
   * the same as making them look the same weight: a cigarette is a long thin
   * diagonal, so matching its bounding box to a bowl's leaves it with a third
   * of the ink and it reads as a smaller icon on the pad. The geometric mean
   * tracks how much of the box the object actually fills, so slender shapes
   * come up and squat ones come down.
   *
   * The result is still clamped to the frame — this adjusts weight between
   * objects, it does not license one to overflow.
   */
  const crop = await sharp(keyed).metadata();
  const inner = STICKER_PX - STICKER_PAD * 2;
  const byWeight = TARGET_MEAN_PX / Math.sqrt(crop.width * crop.height);
  const scale = Math.min(byWeight, inner / Math.max(crop.width, crop.height));

  const fitted = await sharp(keyed)
    .resize(Math.round(crop.width * scale), Math.round(crop.height * scale), {
      fit: "fill",
      background: TRANSPARENT,
    })
    .png()
    .toBuffer();

  // A non-square object comes out of `inside` shorter on one axis, so it gets
  // padded back to a square here and every tile can lay them out on one grid at
  // one scale.
  await sharp(fitted)
    .resize(STICKER_PX, STICKER_PX, { fit: "contain", background: TRANSPARENT })
    .webp({ quality: 90, effort: 6, alphaQuality: 100 })
    .toFile(outPath);
}

/** The wash is pure low-frequency colour, so it survives brutal compression —
 *  and it is the largest asset on the screen, so it should get it. */
async function toHero(jpeg, outPath) {
  await sharp(jpeg)
    .resize(HERO_W, HERO_H, { fit: "cover" })
    .webp({ quality: 72, effort: 6, smartSubsample: true })
    .toFile(outPath);
}

// ── Run ────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const force = args.includes("--force");
/** Re-run the bake from cached model output, without paying for new images. */
const rebake = args.includes("--rebake");
const only = args.filter((arg) => !arg.startsWith("--"));
const wanted = (name) => only.length === 0 || only.includes(name);

const jobs = [
  ...Object.entries(SUBJECTS).map(([key, subject]) => ({
    name: key,
    out: resolve(ART, `tiles/${key}.webp`),
    prompt: stickerPrompt(subject),
    aspectRatio: "1:1",
    bake: toSticker,
  })),
  ...Object.entries(HERO).map(([theme, prompt]) => ({
    name: `hero-${theme}`,
    out: resolve(ART, `hero-${theme}.webp`),
    prompt,
    aspectRatio: "16:9",
    bake: toHero,
  })),
];

// `--rebake` works entirely from cache, so it must not require a key.
const key = rebake ? null : await resolveKey();
await mkdir(resolve(ART, "tiles"), { recursive: true });
await mkdir(CACHE, { recursive: true });

let made = 0;
let skipped = 0;
const failed = [];

for (const job of jobs) {
  if (!wanted(job.name)) continue;

  if (!force && existsSync(job.out)) {
    skipped += 1;
    continue;
  }

  process.stdout.write(`  ${job.name.padEnd(12)}`);

  const cached = resolve(CACHE, `${job.name}.jpg`);

  // Three rolls of the dice. A bad key or a checkerboard lands on maybe one
  // icon in seven, and re-asking is the only fix — the prompt already forbids
  // both.
  for (let attempt = 1; ; attempt += 1) {
    try {
      const jpeg =
        rebake && existsSync(cached)
          ? await readFile(cached)
          : await generate(key, job.prompt, job.aspectRatio);

      // The model's own output is kept so that changing the *bake* — the key
      // thresholds, the padding, the output size — never costs another paid
      // generation. It is the expensive half and it is fully deterministic.
      await writeFile(cached, jpeg);
      await job.bake(jpeg, job.out);

      console.log(` ✓ ${((await stat(job.out)).size / 1024).toFixed(1)} KB`);
      made += 1;
      break;
    } catch (error) {
      if (error instanceof RetryableArt && attempt < 3 && !rebake) {
        process.stdout.write(` ↻ ${error.message}, retrying…`);
        continue;
      }
      console.log(` ✗ ${error.message}`);
      failed.push(job.name);
      break;
    }
  }
}

console.log(
  `\n${made} generated, ${skipped} already present` +
    (failed.length ? `, ${failed.length} failed: ${failed.join(", ")}` : "")
);
if (failed.length) process.exitCode = 1;
