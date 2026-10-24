# Somen Catch

A nagashi-sōmen timing game. Noodle bundles slide down a bamboo flume toward you. Tap (or click, or press Space) to catch them with your chopsticks.

Three shops of five levels: KYOTO FLUME (one flume), FLUME HALL (2–4 flumes: tap the flume to aim, or keys 1–4 / A S D F) and POOL SLIDES (spiral waterslides).

Keyboard: in a level, ← → aim at a tube and Space (or Enter) catches; 1–4 or A S D F aim and catch in one press. In menus, the arrows move the highlight, Space or Enter picks, Esc goes back.

- Static site: open `index.html` through any static server (for example `npx serve somen-catch`).
- No build step. Plain ES modules and Canvas 2D.
- Logic tests: `npm test` (runs `node --test`).

## Layout

| File | What it does |
| --- | --- |
| `src/path.js` | Tube paths: distance along the tube `s` → screen position and scale (straight flumes, lanes, curved slides) |
| `src/flow.js` | Spawning and moving noodle bundles |
| `src/catch.js` | Catch judging and the chopstick hand cycle |
| `src/score.js` | Grams, combos, stars |
| `src/levels.js` | The 3 shops and 15 levels (tune here) |
| `src/storage.js` | Saved progress (localStorage, safe if blocked) |
| `src/render.js`, `src/sprites.js` | Pixel-art drawing at 180×320, scaled up sharply |
| `src/curves.js` | Waterslide drawing with a depth buffer, so crossing slides overlap correctly |
| `src/audio.js` | Generated sound effects |
| `src/main.js` | Game loop, input, screens |

Spec and design: `openspec/changes/nagashi-somen-game/` in the parent repo.
