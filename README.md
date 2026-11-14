# ASTRONEX — A Museum of Abandoned Spacecraft

NASA Space Apps Challenge project, theme **"Abandoned but not Forgotten"**: an interactive mini-museum of historic rovers, landers and probes, with their history, creators, fun facts and a built-in mini-game.

```
astronex/
├── frontend/        HTML / CSS / JS (css/theme.css holds all colors and fonts)
│   └── models/      drop .glb files here (file names come from the "model" field in data/exhibits.json)
├── backend/         Flask API (empty for now)
└── data/exhibits.json   exhibit data
```

## Running the site
- **Just have a look:** double-click `frontend/index.html`. The site works as-is.
- **With 3D models (.glb) and textures:** you need a local server, otherwise the browser will not let the page read those files.
  Double-click `run.command` (macOS/Linux) or `run.bat` (Windows),
  or run this from the `astronex/` folder: `python3 -m http.server 8000`, then open http://localhost:8000/frontend/index.html

## Interactive Explore (the button before the museum)
Flow: button → the page slides aside and the site darkens → a real-time three.js intro plays (see below, ~14 s) → darkening again →
Moon and Mars appear → pick a planet (it moves closer) → markers show abandoned objects → info panel with a 3D model of the object.
- **Intro:** no video file is needed. The ~7.5 s rocket launch is drawn on a 2D canvas in the site style (flat rocket with dark outline, cartoon smoke) by `frontend/src/explore/intro.js`; timing lives in the `TL` object at the top of that file. The Esc key skips it (there are no on-screen buttons).
- **Markers:** the `markers` field of each exhibit in `data/exhibits.json` (`planet`: moon | mars, `lat` and `lon` in degrees, lon from -180 to 180).
- **Planets and objects are abstract shapes for now.** When the real assets are ready:
  - Object: put a `.glb` into `frontend/models/` named as in the `model` field. The panel will show it instead of the placeholder (needs the local server: `run.command` / `run.bat`).
  - Planet: put `frontend/textures/moon.jpg` and `mars.jpg` (equirectangular projection, longitude -180 to 180).
- **3D code** lives in `frontend/src/explore/`. The site only needs the prebuilt `frontend/js/explore.bundle.js`.
  If you edit the source: `cd tools && npm install && npm run build`.

## Intro animation (rocket launch)
One continuous scene driven by a single timeline (about 14 s): starry sky with a distant planet, asteroids and a nebula, then a huge rocket rises from below the frame with smoke and fire; the smoke fills the screen, everything dissolves into the haze, and the screen ends almost black with the title fading in.
- **Preview on its own:** open `frontend/intro.html` (works by double-click).
- **Timings:** the `TL` object at the top of `intro.js` (ignite, launch, exit, title time, total duration). Fade-out delays of each object are in the `fades` array.
- **Hook for the site:** `createIntro({ onAnimationEnd() {...} })`. It is called once, when the animation ends or is skipped. The title uses the CSS class `.xp-intro-title.show` (styles in `css/explore.css`).
- **Performance:** smoke pool is 5000 instanced billboards (reused, no allocations per frame). The intro lowers its own resolution and turns off bloom if the frame rate drops. Users with `prefers-reduced-motion` skip it.
- After editing `intro.js`: `cd tools && npm install && npm run build`.

## 3D models
Used on exhibit pages (`exhibit.html`) and in the Interactive Explore panel. As soon as a .glb is in `frontend/models/`, the site picks it up automatically (needs the local server: `run.command` / `run.bat`).

| File | What | Status |
|---|---|---|
| `apollo-lm.glb` | Apollo Lunar Module | **real model** |
| `mer.glb` | Spirit & Opportunity (one shared exhibit) | placeholder |
| `ingenuity.glb` | Ingenuity helicopter | placeholder |
| `moon.glb`, `mars.glb` | the two planets in Interactive Explore | placeholder |
| `surveyor3`, `sojourner`, `viking`, `phoenix`, `insight`, `pioneer`, `dawn` (.glb) | other exhibits | no file yet, an abstract shape is shown |

**Replacing a placeholder:** overwrite the file with the same name. No code changes needed.
Placeholders can be regenerated at any time: `cd tools && npm install && npm run placeholders`.

**Spacecraft models:** any scale and orientation work (the viewer centers and fits them). Y axis is up.

**Planet models (`moon.glb`, `mars.glb`):** markers sit on the surface at real latitude/longitude, so the planet must match the marker math:
- a sphere centered at the origin (any size, it is scaled to fit automatically), Y axis = north pole;
- UV map = standard equirectangular (same as `THREE.SphereGeometry`): longitude -180° at the left edge of the texture, +180° at the right;
- if the surface looks rotated against the markers, rotate the sphere around Y in Blender.

If `moon.glb` / `mars.glb` is missing, the site draws a procedural planet (and uses `textures/moon.jpg` / `mars.jpg` if present).

## Adding an exhibit
1. Add an object to the `exhibits` array in `data/exhibits.json` (`hall`: moon | mars | deep).
2. Run `python3 data/build.py`. It regenerates `data/exhibits.js`, which the site reads (the Flask API can serve the JSON directly).

## Team
- **Fazliddin** — frontend (HTML/CSS/JS)
- **Sharifhuja** — 3D models in Blender (.glb into `frontend/models/`)
- **Azimkhon** — backend (Flask API)

## Credits
3D models and imagery from NASA, where used, must credit NASA, must not imply NASA endorsement, and must not misuse NASA insignia. See [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources).

## Visual style

The site uses a playful "sticker" look: indigo background with a dot grid, lime labels with pink offset shadows, cream headings, flat toon-shaded planets with a dark outline and a pink crescent. All colours live in `frontend/css/theme.css`. The Rubik font (SIL OFL) is bundled in `frontend/fonts/`, so no external font requests are made.

## Draco-compressed models
`.glb` files compressed with Draco (e.g. `apollo-lm.glb`, `ingenuity.glb`) are supported. The decoder lives in `frontend/draco/` — keep that folder in the repo.

## Exhibit data fields (data/exhibits.json)
Besides the basic fields each exhibit has: `story` (paragraphs shown in the main window), `details` (the "Study in detail" blocks on the exhibit page), `signal` (one-way light time used by the "Send signal" button) and `placeholder: true` while the 3D model is still a stand-in ("3D model in development" labels). After editing the JSON run `python3 data/build.py`. Archive card pictures live in `frontend/img/exhibits/<id>.png`.

## Mobile / phones

The whole site is responsive (tested at 390 px width and up):
- the header collapses into a burger menu below 760 px (`js/common.js`, styles at the end of `css/app.css`);
- exhibit pages stack into one column, the 3D window is sized to the screen;
- in Explore the planets stack vertically, the sites of a planet are a swipeable strip at the bottom, and the info panel is a bottom sheet (`css/explore.css`, portrait layout in `src/explore/explore.js`).

Rebuild the Explore bundle after editing anything in `frontend/src/explore/`: `cd tools && npm install && npm run build`.

## Placing markers on the planets (marker tool)
Open `frontend/index.html?explore=mars&edit=1` (or `explore=moon`) from the local server. Fly to the planet, **click the exact spot** on the surface — a red dot appears and the panel shows `lat / lon` plus a ready JSON line. Arrow keys nudge the point by 0.25° (Shift = 1°). Press **Copy JSON** and paste it into the exhibit's `markers` list in `data/exhibits.json`, then run `python3 data/build.py`.

## Exhibit images
Each exhibit shows two images on its page (swipe / arrows / dots). Put the files at `frontend/img/exhibits/<id>-1.jpg` and `<id>-2.jpg` (ids are in `data/exhibits.json`); until a file exists a "coming soon" card is shown. Use NASA / JPL public-domain images and keep the credit line.

## Signal times
`signal.contacts` in `data/exhibits.json` holds the real last-contact date, distance and one-way light time per exhibit (Moon/Mars distances computed from ephemerides; Pioneer 10 and Dawn from NASA/JPL statements).
