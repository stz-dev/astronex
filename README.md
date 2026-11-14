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
- **With 3D models (.glb), video and textures:** you need a local server, otherwise the browser will not let the page read those files.
  Double-click `run.command` (macOS/Linux) or `run.bat` (Windows),
  or run this from the `astronex/` folder: `python3 -m http.server 8000`, then open http://localhost:8000/frontend/index.html

## 3D models
Used on exhibit pages (`exhibit.html`) and in the Interactive Explore panel.
Until a file exists, the page shows a "3D MODEL SLOT" with the name of the file it expects.
As soon as a .glb appears in `frontend/models/`, the site picks it up automatically.
File names: apollo-lm, lrv, surveyor3, mer, ingenuity, sojourner, viking, phoenix, insight, pioneer, dawn (.glb).

## Adding an exhibit
1. Add an object to the `exhibits` array in `data/exhibits.json` (`hall`: moon | mars | deep).
2. Run `python3 data/build.py`. It regenerates `data/exhibits.js`, which the site reads (the Flask API can serve the JSON directly).

## Team
- **Fazliddin** — frontend (HTML/CSS/JS)
- **Zafar** — frontend (HTML/CSS/JS)
- **Sharifhuja** — 3D models in Blender (.glb into `frontend/models/`)
- **Azimkhon** — backend (Flask API)
- **Muhammadsaid** — project coordinator (Research, Content, Documentation)

## Credits
3D models and imagery from NASA, where used, must credit NASA, must not imply NASA endorsement, and must not misuse NASA insignia. See [NASA 3D Resources](https://github.com/nasa/NASA-3D-Resources).
