# Somen Catch

A nagashi-sōmen timing game. Noodle bundles slide down a bamboo flume toward you. Tap (or click, or press Space) to catch them with your chopsticks.

- Static site: open `index.html` through any static server (for example `npx serve somen-catch`).
- No build step. Plain ES modules and Canvas 2D.
- Logic tests: `npm test` (runs `node --test`).

## Layout

| File | What it does |
| --- | --- |
| `src/path.js` | Flume path: distance along the flume `s` → screen position and scale |
| `src/flow.js` | Spawning and moving noodle bundles |
| `src/catch.js` | Catch judging and the chopstick hand cycle |
| `src/score.js` | Grams, combos, stars |
| `src/levels.js` | Level data (tune here) |
| `src/storage.js` | Saved progress (localStorage, safe if blocked) |
| `src/render.js`, `src/sprites.js` | Pixel-art drawing at 180×320, scaled up sharply |
| `src/audio.js` | Generated sound effects |
| `src/main.js` | Game loop, input, screens |

Spec and design: `openspec/changes/nagashi-somen-game/` in the parent repo.
