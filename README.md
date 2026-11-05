# MY ENGLISH TOWN

A 1-player English-learning town-building game for Grade 3-4 (React + TypeScript + Vite + Phaser 4).
Students explore a town, talk to residents, do English activities, earn coins/EXP, build and decorate.
Everything runs in the browser; no backend. Progress is saved in IndexedDB on the device (and can be exported as a JSON backup).

## Run

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests (vitest)
npm run build      # type-check + production build into dist/
```

Deploy `dist/` to any static host (Netlify, GitHub Pages). Assets use relative paths (`base: './'`).

## What works in this milestone (vertical slice)

Start screen, new game / continue / load backup, character setup (6 characters), 24x18 tile town,
WASD/arrow/virtual-pad/tap-to-move, NPC dialogue (Mia, Emma) with listen button and 3-step hints,
quest chain (hello -> build bakery -> take orders -> decorate), Bakery Order mini-game (drag or tap, 3 order types),
rewards (first-clear vs repeat, once per run), building placement with valid/invalid preview, move buildings,
10 decorations (buy / place / move / pick up), town levels, IndexedDB autosave with backup copy, JSON export/import,
multiple student profiles, content validation.

Not built yet: School, Market, Post Office, Park mini-games; building upgrades (data model supports 3 levels); NPC wandering;
teacher editing UI (content is JSON in `src/content`). These are shown as "Coming soon" in the Build menu.

## Layout

```
src/content/     JSON content (grade3/, grade4/ packs, quests, buildings, decorations, economy) + validation
src/systems/     pure game logic: economy, building, quests, learning, progression  (unit tested)
src/storage/     IndexedDB, schema migration, export/import
src/game/        Phaser scenes, asset manager (manifest + placeholders)
src/app/         single store shared by React and Phaser
src/screens, src/components, src/minigames   React UI
public/assets/   art + manifest.json (optional; placeholders are drawn when missing)
tests/
```

## Teachers: editing content

Words and sentences live in `src/content/grade3/town.json` and `grade4/town.json` (`foods` use explicit singular/plural forms,
so sentences like "I like tomatoes." are never built by blind string concatenation). Rewards are in `economy.json` and `quests.json`.
The start screen > Settings shows a content check; `validatePack()` reports missing fields, duplicate ids, bad answers.

## Saving

Saved only in this browser on this device. It does not sync between devices. Use Settings > Download to keep a backup file.
Deleting a profile always asks for confirmation.
