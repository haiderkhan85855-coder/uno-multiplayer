# Off the Grid — Sunset District

A free-roam, third-person Three.js game. Walk the coastal town or pick up a car, scooter, motorcycle, or bicycle. There is no login, download at runtime, or build step. Three.js, models, textures, and fonts are served with the game.

## Play

Use the live preview, or serve this folder with any static HTTP server:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** in a modern browser with WebGL 2 and choose **Play game**. Serve the folder over HTTP rather than opening `index.html` as a `file://` URL; browsers restrict local ES module and model loading.

| Control | Action |
| --- | --- |
| WASD | Walk relative to the camera. On a vehicle, W accelerates, S brakes/reverses, and A/D steer. |
| Shift / Space | Run / jump on foot |
| Drag | Orbit the camera; it settles back behind a moving vehicle after a short delay |
| E | Enter a nearby vehicle or dismount to a clear spot |
| Esc / R | Pause / reset the player and vehicles |

Colored dots on the minimap mark parked vehicles. Touch devices get on-screen movement, jump, run, and interaction buttons.

## Add a vehicle

Add an entry to `vehicleSpecs` in `vehicles.js` with a unique `id`, display `name`, marker `color`, and `spawn: [x, z, heading]`. Heading `0` faces negative Z; angles use radians and distances/speeds use meters and seconds. Start from an existing entry and adjust `max`, `reverse`, `accel`, `brake`, `drag`, and `steer`. `radius` and `axle` size the collision footprint; `range` sets the boarding distance and `camera` sets follow distance. An optional `seat: [height, z]` shows a rider.

Implement `build(color)` to return a `{ mesh, wheels }` fallback. For an imported asset, put the GLB and any textures in `models/`, then set `model: { url, yaw, scale, wheels, wheelDirection }`. Only `url` is required. Name the wheel nodes in `wheels` if their local X axes should roll. Keep the rear and front clear of buildings at the spawn; new entries are picked up automatically by the HUD, minimap, and interaction system.

`game.js` owns input, movement, camera, and HUD. `town.js` builds and batches static scenery and exposes collision bounds. `vehicles.js` defines rides and loads their assets.

## Assets and verification

The bundled car is from [Kenney Car Kit](https://kenney.nl/assets/car-kit) and the motorcycle is from [Kenney Starter Kit Racing](https://github.com/KenneyNL/Starter-Kit-Racing) (both CC0). The scooter, bicycle, player, and town are built from low-poly geometry. The car and motorcycle have procedural fallbacks. The title illustration is separate from the in-game scene. See `models/README.md` and the licenses in `vendor/` and `assets/fonts/`.

The optional smoke test drives the actual game in Chromium: it walks from the default spawn to the car, then separately walks up to, enters, drives, steers, and exits each ride. It also checks running, jumping, camera orbit, reset, pause/resume, title replay, and GLB loading for the car and motorcycle.

```sh
# While the server above is running (not needed to play)
npm install --no-save --no-package-lock playwright-core
CHROMIUM_PATH=/path/to/chromium node tests/smoke.mjs
```

Physics are arcade-style. Real-device touch controls and cross-browser performance have not been verified.
