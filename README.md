# 新生兒大便顏色辨識 / BA Stool Screen

A progressive web application that matches a photographed infant stool against
the Taiwanese seven-colour stool card, to help caregivers notice acholic stool
early in biliary atresia.

**衛教輔助工具，非診斷器材。** The tool reports a card number and a referral
suggestion; it does not diagnose, and the UI says so on every result.

---

## Quick start

```bash
npm install
npm run dev          # http://localhost:5173
npm run build        # → dist/  (also emits dist/sw.js)
npm run preview      # serve the build; the service worker only runs here
npm run verify:color # colour pipeline self-check (no browser needed)
npm run verify:deploy # check a served build's base path, scope and offline
npm run icons        # re-render public/icons/*.png from icon.svg
```

There is no service worker in `npm run dev`, so install and offline behaviour
only appear under `npm run preview` or on the deployed site. The camera and
IndexedDB also behave differently over plain HTTP, so test on a real phone
against the deployed HTTPS URL rather than `npm run dev:host`.

---

## How it works

```
capture ──► tap paper ×2 ──► tap cells 3,4 ──► tap stool ──► read ──► store
            (mixed light?)   (relative mode)   (disc mean)  (saturation) (IndexedDB)
```

Two design decisions everything else follows from.

**The user marks the references; the app does not look for them.** Automatic
white-patch detection is the part that breaks in a dim bedroom at 3 a.m.; a tap
is not. The same reasoning extends to the card cells in relative mode.

**The reading is one continuous number, not one of seven classes.** Bile-duct
obliteration is gradual, so stool colour fades along a continuum; a 7-way
classification is the wrong shape for it, and no per-card reference value
exists to classify against anyway (see below). The decision variable is HSV
saturation, with thresholds taken from published work — see the long note at
the top of `src/lib/stoolCard.js` for the three papers and their numbers.

Output is three zones rather than two. Both published cutoffs (56 and 60) fall
inside the empty band between the cards' normal and abnormal saturation ranges,
so that band is reported as *unclear* instead of being split at either one.
Everything below 67 prompts medical contact, which preserves the 100%
sensitivity reported at the 60% cutoff while labelling genuinely ambiguous
readings as ambiguous — misclassification was the stated concern of the
programme's custodians, and an honest uncertain band is the answer to it.

Sampling is a mean over a 20px disc, and when several stool points are given
the **palest** one decides: stool is heterogeneous and it is the pale region
that carries the signal, so averaging it away is exactly the wrong move.

A falling trend is treated as a signal in its own right, because it can appear
before any single reading crosses a threshold. The serum side already works
this way — Harpavat's two-stage newborn screening calls stage 2 positive when
bilirubin exceeds *the stage 1 value*, not a fixed cutoff.

Why the correction matters, from `npm run verify:color`:

```
warm light, corrected    S=3.3%  → 異常
warm light, uncorrected  S=35.3% → 異常
```

Under tungsten light the same stool reads ten times more saturated before
correction. That shift is the whole reason the tool exists.

---

## Project layout

```
src/
├── lib/
│   ├── stoolCard.js   card swatches, zone thresholds, wording, sources
│   ├── color.js       saturation, sampling, gates, white balance, trend (pure)
│   └── db.js          IndexedDB: records, thumbnails, CSV export
├── components/
│   ├── StepDots.jsx         progress indicator
│   ├── Disclaimer.jsx       two registers: prominent / quiet
│   ├── StoolCardStrip.jsx   the seven cards, for reference only
│   ├── SaturationGauge.jsx  the reading on its actual axis
│   └── screens/             Welcome → Guide → Camera → Annotate → Result → History
├── styles/
│   ├── theme.js       design tokens
│   └── global.css     reset, focus rings, reduced motion
├── App.jsx            screen routing, persistence, trend
└── main.jsx
```

`lib/color.js` is pure and has no browser dependency, which is what makes
`verify:color` possible and what any future validation work should target.

Captures are refused rather than read when the arithmetic has broken down: a
clipped or underexposed white reference, a tap that landed on something
genuinely coloured, mixed illumination across the frame, or a sample that
clips after gain. Refusals are distinct from advisories — a strong colour cast
is flagged but still read, because white paper under tungsten light *is*
strongly chromatic and that is precisely the capture the correction exists to
rescue.

---

## Why there are no per-card reference values

An earlier version matched against seven CIELAB centroids. That model was built
on a premise the card does not support.

Each cell of the physical card is a **photograph of real stool**, not a flat
patch: it has shading, texture and an internal gradient. The Taiwan Children's
Liver Foundation confirmed this directly — the programme keeps no CMYK or
Pantone definition on purpose, and sends someone to the printing plant each
year to colour-match by eye, because the colours within one cell cannot be
pinned to a single number. "The Lab value of card 3" is not a number that
exists.

Saturation sidesteps this. Within one photograph lightness varies a great deal
between highlight and shadow while chroma stays comparatively stable, so a
one-dimensional chroma reading survives the internal variation that defeats a
three-dimensional Lab point. And the card→number translation has already been
done in that space and published, so no spectrophotometer is needed.

The seven swatches in `STOOL_CARD` are kept purely as the on-screen reference a
parent recognises from the 健兒手冊. Their hex values are chosen so each sits
inside the saturation band measured for its side of the card, and
`verify:color` asserts that alignment — but they are approximations for
rendering, and nothing clinical is decided from them.

**Still provisional:** the zone thresholds are literature-derived, not locally
validated, and the trend slope threshold is a judgement call with nothing
behind it yet. Both are the obvious targets for a prospective study.

---

## Privacy

Nothing leaves the device. Photographs are held in memory for the length of one
check and never written to disk; only a ~200px thumbnail (≈8 KB) is stored
alongside each record in IndexedDB. There is no account, no analytics, and no
network call after the page loads.

The result screen states this in plain words rather than burying it in a policy
page, because that is where a parent is deciding whether to take the photo.

`.env.example` reserves Supabase keys for a later, consent-gated research
upload. `db.js` already carries `consent` and `uploaded` flags, indexed so a
future sync can find the backlog in one cursor pass — no schema migration
needed when that arrives.

---

## Installing and offline

The app installs to the home screen and runs with no connection, which is the
point for a check repeated weekly over three months — an icon on the home
screen is the difference between remembering and not, and a parent checking a
nappy at 3 a.m. may have no usable signal.

`scripts/sw-template.js` is the service worker; the `pwa()` plugin in
`vite.config.js` substitutes a precache list and a build id into it at build
time. The build id is a hash of the precached URLs and names the cache, so a
new build gets a fresh cache and the old one is dropped on activate — and a
rebuild that changes nothing reuses the cache the user already has.

Navigations are network-first with a 3s timeout falling back to the cached
shell, because a connection that is present but useless (hospital wifi, a
captive portal) is worse than none. Assets are cache-first, which is safe
because Vite content-hashes them.

The worker never takes over on its own. A new version waits, and the app
offers it only on the welcome and history screens — swapping the JS while a
parent is part-way through tapping the white paper and the stool would discard
a photograph of a nappy that no longer exists.

Two things to know if you touch this:

- **Every cache lookup passes `ignoreVary: true`.** Vite marks its module
  script and stylesheet `crossorigin`, so those requests carry an `Origin`
  header the worker's own precache fetches do not. Any host that sets
  `Vary: Origin` then makes `cache.match` miss on exactly those two files. The
  symptom is invisible online and total offline: the shell loads and renders
  nothing.
- **`beforeinstallprompt` is captured at module load in `src/lib/pwa.js`,** not
  in the component that shows the invitation. It fires once and early, and the
  invitation lives on the welcome screen, which unmounts as soon as a check
  starts.

## Two modes

The guide screen asks one question — does the parent have the 健兒手冊 to
hand? — and the answer changes what the reading is made of. The choice is
remembered, since it rarely varies between weekly checks.

**Relative** (card in frame, five taps: paper ×2, cell 3, cell 4, stool).
The parent photographs the nappy, a sheet of white paper and the stool-card
page together, and the stool is compared against cells 3 and 4 *as measured in
that same photograph*. Cells 1–3 are the acholic side and 4–7 the normal side,
so the card's own boundary becomes the decision boundary: at or below cell 3 is
referred, at or above cell 4 is normal, between them is unclear.

Nothing absolute is needed anywhere in this path. The print batch of that
particular booklet, the phone's sensor and colour pipeline, the exposure the
camera chose and the colour of the light in the room all land on the stool and
on the card cells equally, and cancel in the comparison. `verify:color` pins
this down: the same stool under a warm and a cool illuminant returns the same
verdict, and a card printed a shade off still brackets it correctly.

It is also the answer to the obstacle that stopped the earlier NTU attempt —
rather than trying to standardise the photographing conditions, the conditions
are allowed to vary and are measured out.

Two taps that cannot both be right are refused rather than read: if cell 4 does
not come out more saturated than cell 3, the taps landed somewhere other than
where the parent was asked to tap, and the app says which step to redo. A
boundary narrower than 8 saturation points is read but flagged.

**Absolute** (paper only, three taps). The published thresholds, for when the
booklet is not to hand. The result says which method produced it, and suggests
bringing the card next time.

## The second white tap

Both modes ask for two taps on the paper, at different spots. Two whites that
disagree by more than 12 ΔE mean more than one light source in the frame — half
window light, half lamp — and correcting by either one is then worse than not
correcting at all, so the capture is refused. When they agree they are averaged
into a slightly steadier reference than either alone.

## Not yet built

- local threshold validation; prospective clinical evaluation

---

## Deployment

The app is deployed to its own subdomain — **`https://bastoolscreen.<your-domain>`** —
so it owns the whole origin: served at `/`, no base path, and a service worker
whose scope is the entire site.

**1. Cloudflare Pages**

| Setting                | Value           |
| ---------------------- | --------------- |
| Build command          | `npm run build` |
| Build output directory | `dist`          |

**2. Custom domain.** In the Pages project, Custom domains → add
`bastoolscreen.<your-domain>`. With the domain already on Cloudflare the CNAME
is created automatically and the certificate is issued within a few minutes.

HTTPS is required, not optional: without it neither the camera nor the service
worker will start. Cloudflare provides it.

**3. Check it.** With the site live:

```bash
node scripts/verify-deploy.mjs https://bastoolscreen.<your-domain> /
```

This is worth running after the first deploy and after any change to `BASE`.
A wrong base path is invisible online — the app loads and looks fine — and
total offline, because the worker's scope and precache URLs no longer match
what the browser asks for. The assertions are what separate those two.

### Serving from a sub-path instead

`BASE` at the top of `vite.config.js` is the only place a deployment path is
written down; asset URLs, the precache list, the worker's scope and its
registration URL all derive from it.

```bash
BASE_PATH=/bastoolscreen/ npm run build
```

The output then nests into `dist/bastoolscreen/`, so `dist` remains the publish
directory and the app lands at `<domain>/bastoolscreen/`. Both forms are
covered by `verify-deploy.mjs`; pass the base as the second argument.

`manifest.json` needs no change either way — its `start_url`, `scope` and icon
URLs are relative, so they resolve against wherever the manifest is served.

### Changing the path

`BASE` at the top of `vite.config.js` is the only place the deployment path is
written down. Asset URLs, the service worker's precache list, its scope and its
registration URL all derive from it, because a base path that is right in four
places and wrong in the fifth gives an app that loads and then silently fails
to work offline.

For a one-off build elsewhere:

```bash
BASE_PATH=/ npm run build          # domain root, or a subdomain
BASE_PATH=/tools/stool/ npm run build
```

`manifest.json` needs no change at any path: its `start_url`, `scope` and icon
URLs are relative, so they resolve against wherever the manifest itself is
served.

A subdomain (`bastoolscreen.example.com`) would avoid the base path entirely —
`BASE_PATH=/` and nothing else to think about. The path form is supported
because it was asked for, not because it is simpler.
