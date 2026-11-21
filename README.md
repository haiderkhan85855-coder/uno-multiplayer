# Off the Grid — Sunset District

A third-person Three.js game with two coastal neighborhoods, a driveable beach, seven drivable rides, and two flyovers. The original car, scooter, motorcycle, and bicycle are joined by an SUV, an open-bed pickup, and a sports car. The game has no login, build step, or external runtime requests.

## Play

Use the live preview, or serve this folder with any static HTTP server:

```sh
python3 -m http.server 8000
```

Open **http://localhost:8000** in a browser with WebGL 2. Serve the folder over HTTP rather than opening `index.html` as a `file://` URL, which browsers restrict for modules and model loading.

| Control | Action |
| --- | --- |
| WASD | Walk relative to the camera. On a vehicle, W accelerates, S brakes/reverses, and A/D steer. |
| Shift / Space | Run / jump on foot |
| Drag | Orbit the camera; it settles behind your vehicle after a short delay |
| E | Enter a nearby vehicle or dismount to a clear spot |
| Esc / R | Pause / reset the player, parked rides, and current attempt without losing records |
| H / headlight button | Toggle headlights while driving a four-wheel car; brake lights come on when braking |
| Speaker button | Mute or unmute the synthesized audio |

Touch devices have on-screen movement, jump, run, and interaction buttons. On the minimap, outlined colored dots are parked rides, small gold dots are coins, green is a delivery target, and blue shows the race gates. Gray dashed lines are flyovers; the active bridge turns cyan when you reach its upper deck. NPC traffic runs both ways and stops at signalized junctions. It slows near the player but does not physically collide or block missions. Pedestrians stay on sidewalk routes and step aside near vehicles.

## Activities

Choose an activity on the title screen, then press the yellow start button. To change activities, pause and select **Back to title**.

- **Free Roam:** Explore Sunset District, Lantern Bay, the boardwalk, and the beach. Run or drive through any of the 20 coins to collect it. Coins can also be collected in Delivery and Race.
- **Delivery:** Walk or drive into the glowing green pickup ring to collect the parcel. That starts the countdown and reveals the drop-off ring. Reach it before time runs out. Three jobs rotate as you complete them; use **Next job** or **Retry** to start another attempt.
- **Race:** Cross the blue start gate to begin Harbor Sprint, then pass through the five remaining gates in order, on foot or in a vehicle. The HUD shows your last and best times. Use **Race again** to retry.

Delivery totals, coin IDs, and race times are saved locally for this browser and origin. There is no account or cross-device sync. Pausing stops mission clocks.

## Streets and flyovers

- **Market Flyover:** Take the west half of the central north–south road, just north of town center. Its ramp crosses above the northern east–west road. Ground traffic can still pass under it there.
- **Coast Viaduct:** Enter from either end of the beach, east of the boardwalk. It follows the shoreline above the sand; the roads at beach level remain accessible. Both bridges are walkable and drivable in either direction. The guardrails have gaps where you can fall back to the level below.
- Lantern Bay has apartment towers, additional shops and homes, lit windows, roof details, and a planted park. Street lamps, traffic lights, bus shelters, textured curbs, manholes, and puddles use locally generated materials and geometry. Puddles reflect the sunset environment, not nearby objects.

## Code and assets

- `game.js`: existing input, player and vehicle movement, camera, and HUD/minimap integration.
- `missions.js`: jobs, checkpoint course, coins, title menu, and local progress. Spot and gate coordinates are defined at the top.
- `town.js` and `streetscape.js`: roads, buildings, foliage, street props, beach, and sunset lighting.
- `bridges.js`: elevation profiles shared by physics, bridge geometry, and the minimap.
- `vehicles.js`: handling, GLB loading with procedural fallbacks, wheel pivots, and vehicle lights. `traffic.js` handles junction signals, ambient traffic, and pedestrians. `player-model.js` handles rigged movement; `sound.js` synthesizes all audio with Web Audio.

To add a vehicle, copy an entry in `vehicleSpecs` and give it a unique `id`, display `name`, marker `color`, and `spawn: [x, z, heading]` (heading `0` faces negative Z). Adjust `max`, `reverse`, `accel`, `brake`, `drag`, and `steer`. `radius` and `axle` set the collision footprint; `range` sets interaction distance and `camera` sets follow distance. A `seat: [height, z]` shows a rider. Geometry and speeds use meters and seconds.

Implement `build(color)` to return a `{ mesh, wheels }` fallback. Add an optional `model: { url, yaw, scale, wheels, wheelAxis }` for a GLB in `models/`, with any textures alongside it. Only `url` is required; wheel names and the local wheel axis (X by default) enable wheel rotation. See [model credits](models/README.md) for the bundled assets and their licenses.

## Verification

With the static server running, install the optional test dependency and run the Chromium tests. None of this is needed to play:

```sh
npm install --no-save --no-package-lock playwright-core
CHROMIUM_PATH=/path/to/chromium node tests/smoke.mjs
CHROMIUM_PATH=/path/to/chromium node tests/missions.mjs
CHROMIUM_PATH=/path/to/chromium node tests/streets.mjs
FALLBACKS=1 CHROMIUM_PATH=/path/to/chromium node tests/smoke.mjs
```

The smoke test covers all seven rides, walking, sprinting, jumping, orbiting, pause/reset, and model loading. `FALLBACKS=1` supplies invalid GLBs to check that the game still plays with the procedural models. The mission test makes a full delivery, runs all six gates, collects coins, checks persistence, and drives onto the beach. The street test drives both flyovers, checks the upper minimap and a drop back to the street, runs up the coastal ramp on foot, and checks the lights and stopped traffic at junctions. Real-device touch, cross-browser performance, and subjective audio balance have not been verified.
