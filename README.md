# POSE

A mobile-web photography assistant. You open a URL in Safari, describe or pick
the shot you are taking, get poses that actually suit the place you are in, see
what each one should look like, then line it up through the camera with a
transparent guide over the live view.

No install. No account. No server. Everything — search, recommendation, camera,
pose detection — runs in the browser on the device.

## Running it

```bash
npm install
npm run dev      # development server
npm run build    # production build into dist/
npm run preview  # serve the production build
npm test         # 142 unit tests, no browser required
npm run smoke    # 18 end-to-end checks against a served build
```

`npm run smoke` needs the app already being served (`npm run preview`) and
Playwright's Chromium. It covers what unit tests cannot: that the camera
actually starts, the model loads from the bundled assets, capture produces a
clean image, and Back keeps the user's context.

The camera needs a secure context. `localhost` counts; anything else must be
served over https.

## Running it on your phone

iOS Safari only grants camera access over **https** or on `localhost`. A LAN
address like `http://192.168.1.5:5173` will load the app but the camera will
refuse, so the usual "open the dev server on your phone" approach does not work
here. Two options that do:

### GitHub Pages (a permanent link)

`.github/workflows/pages.yml` builds and deploys on every push. It needs Pages
switched on once, because the workflow token is not allowed to create the Pages
site itself:

> Repository **Settings → Pages → Build and deployment → Source → GitHub Actions**

Then re-run the workflow (or push anything). The app lands at
`https://<owner>.github.io/<repo>/` and every later push updates it.

### A tunnel (for iterating)

Faster while you are changing things — your phone hits your local dev server
over https, with hot reload:

```bash
npm run dev -- --host
npx cloudflared tunnel --url http://localhost:5173
```

That prints a `trycloudflare.com` https URL. Open it on the phone.

### On the phone itself

Tap **Use this pose** to enter the camera; that is when Safari asks for
permission. If you deny it by accident, Settings → Safari → Camera → Ask, then
reload. Share → Add to Home Screen gives a full-screen icon, but nothing
requires it.

## What it does

**Discover** — describe the shot in your own words ("sitting at a cafe beside a
window, candid") or tap a scene. The description is interpreted locally into
explicit, editable constraints, shown as chips you can remove. Nothing is
hidden behind a black box.

**Recommend** — scene, body position and people count are hard constraints:
choose Beach + Standing + Individual and you will never be shown a seated pose,
a couple pose, or a pose that only works in a restaurant. Everything else
scores, and the results are diversified by pose family so the top of the list is
six different photographs rather than six variants of one.

**Preview** — each pose shows what the photograph should look like, one
instruction for the subject and one for the photographer.

**Shoot** — the real camera opens with a rule-of-thirds grid and a transparent
human guide you can drag, pinch, mirror, fade, lock and reset. Where pose
detection is available it adds one short correction at a time, labelled CAMERA
or POSE so it is clear who has to move, and settles into HOLD when the pose is
close enough. Capture produces a clean photograph containing none of the
guidance interface.

You can switch pose, step through compatible poses, or change the whole shot
setup without leaving the camera or restarting anything.

## Honest state of the build

**Pose reference photography does not exist yet.** This is the one part of the
specification that cannot be satisfied from code. Every pose currently renders a
procedurally generated anatomical silhouette, built from that pose's own target
skeleton at real human proportions, and it is labelled a *reference render*
everywhere it appears. It is production-quality for its functional job — the
transparent camera guide — but it is not a photograph and the app never implies
otherwise.

The asset architecture is complete and waiting. To add real references:

1. Put the files in `public/assets/poses/`.
2. Register them in `src/data/assetManifest.ts`.
3. Nothing else changes. The resolver picks them up and the placeholder badges
   disappear for those poses.

`#/dev/assets` lists exactly what is outstanding, and reports any declared asset
that fails to load rather than showing a broken image.

**Group poses are guided by placement and framing, not per-person joint
matching.** With Group selected the app checks headcount and composition and
leaves the bodies to the visual guide. It does not claim otherwise.

**Head guidance is coarse and confidence-gated.** Head yaw and pitch are derived
from the pose model's nose, eye and ear points. At full-body distance those are
small and noisy, so guidance about the head is suppressed unless the face is
confidently visible. There is no gaze estimation, and the app never pretends
there is.

**Torch, zoom and lens selection are only offered where the browser actually
exposes them.** On iOS Safari it does not, so those controls do not appear.
There are no decorative 0.5x/1x/3x buttons.

## Architecture

```
src/
  app/            router, shell, shot session store
  camera/         stream lifecycle, capability detection, coordinates, capture
  components/     shared UI, icon set, silhouette renderer
  data/           pose catalogue, asset manifest, repository
  features/       discover, shot-setup, pose-library, pose-detail, camera,
                  capture-review, saved, dev
  guidance/       ordered state machine, smoothing, instruction types
  models/         taxonomy, landmarks, skeleton rig, pose, shot session
  pose-matching/  features, normalisation, matcher
  recommendations/layered ranking and diversification
  search/         scene interpreter
  styles/         tokens and global styles
  utilities/      storage, base path
  vision/         MediaPipe pose detector
```

Two decisions shape most of the rest:

**Poses are authored as joint angles, not coordinates.** A small forward-
kinematic rig turns a handful of angles into a 33-point skeleton. The visual
guide and the matcher targets are both derived from that one rig, so the picture
the user sees and the geometry the app checks cannot drift apart.

**High-frequency data never enters React state.** Landmarks live in refs, the
alignment anchors draw to a canvas, and only the guidance text — which changes a
few times a minute — is published to components.

## Privacy

Camera frames, body geometry and captured photos stay on the device. Nothing is
uploaded. There is no face recognition, no identity matching, no analytics and
no advertising SDK. Favourites and session state are stored in `localStorage`
and the app works correctly when that is unavailable.

## Where the vision model comes from

`public/vision/` holds the MediaPipe Pose Landmarker model and its WASM runtime,
bundled rather than fetched from a CDN so the camera works offline and inside
embedded contexts where remote fetches are blocked. It is code-split: a device
that never opens the camera never downloads it.
