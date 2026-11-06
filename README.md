# MY ENGLISH TOWN

A 1-player English-learning town-building game for Grade 3, 4, 5 and 6 (React + TypeScript + Vite + Phaser 4).
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

Mini-games (all four grades, content in each `gradeN/town.json`): Bakery Order (find the food), School Timetable (subject + day),
Market Shop (read price tags, say the price), Post Office (clues, "Is this your ...?"), Park Action Challenge ("What are you doing?").
Each has a 3-step hint ladder and pays a first-clear vs repeat reward; hosting buildings pay +5 coins per upgrade level.

Not built yet: NPC quests for the four newer buildings; NPC wandering;
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

## Grades 3-6

Each grade has its own pack (`src/content/grade3..grade6/town.json`) built from the nalmal-playground word lists:
grade 3-4 use "I like ..."; grade 5 uses "What would you like? / I'd like a cake." (lesson 8); grade 6 uses
"I'm going to eat ..." (lesson 9). Pick the grade on the New Game screen. Sentences use word forms stored in the data
(`plural`, and `a` for forms with an article such as "a cake"), written in templates as `{0}` / `{0:a}`.

## Teachers: editing content in a page (no code)

Open `/teacher.html` (e.g. `https://ina-seol.github.io/my-english-town/teacher.html`). Pick a grade, edit the bakery words,
the "I like ..." forms and the sentence patterns, and read the live check. **"이 기기에서 시험"** applies the change only in this
browser so you can try it in the game. **"파일 받기"** downloads `gradeN.json`; put it in `public/content/` and push to GitHub
to apply it to every student. A broken file is ignored (built-in content keeps working). There is no password: nothing changes
for other students until a file is deployed, and the page is not linked from the game.

## Teachers: editing content in JSON

Words and sentences live in `src/content/grade3/town.json` and `grade4/town.json` (`foods` use explicit singular/plural forms,
so sentences like "I like tomatoes." are never built by blind string concatenation). Rewards are in `economy.json` and `quests.json`.
The start screen > Settings shows a content check; `validatePack()` reports missing fields, duplicate ids, bad answers.

## Saving

Saved only in this browser on this device. It does not sync between devices. Use Settings > Download to keep a backup file.
Deleting a profile always asks for confirmation.

## Pixel-art assets

The seven provided sheets live untouched in `public/assets/original/` (they are stripped from `dist/` at build time).
They are composite images (labels, panels, backgrounds), so they are processed rather than used directly:

```bash
pip install numpy scipy pillow
python tools/extract_assets.py            # re-extracts everything, writes public/assets/manifest.json and the atlases
```

| Sheet | Method | Result |
|---|---|---|
| terrain-tileset | alpha components | 5 grass + 5 flower + 3 water tiles (seamless crops), dirt/stone road autotiles by neighbour mask (missing orientations mirrored/rotated), bridges |
| buildings-sheet | alpha components, grid-assigned | 12 buildings x 3 levels |
| player-characters | background cut-out | 6 characters x 4 directions; Jun has real 4-frame walk cycles, the others have one stand pose per direction |
| npc-characters | background cut-out | 12 portraits; Mr. Baker also has a real 4-direction walk cycle; other residents appear in the world as a badge made from their portrait |
| decorations-sheet | per-panel-cell cut-out | 48 props (the clean ones), with shop categories |
| ui-assets | background cut-out | coin/gem/star/heart/etc., 6 navigation icons, 4 panel frames (the wooden one is used as a 9-slice frame) |
| main-title | converted to JPEG | title screen background (buttons are React, logo is part of the image) |

Runtime sprites are packed into 4 atlases (`public/assets/atlas/`) so a classroom of tablets makes a handful of requests;
the individual PNGs remain as the editable source and for React thumbnails. All art paths come from `manifest.json`;
if it or any image is missing the game falls back to drawn placeholders and keeps running.
To replace art, overwrite the PNGs (or edit the sheets) and re-run the script. Building visuals use `BuildingVisual`
(`src/game/assetManager/manifest.ts`): the image size is independent of the tile footprint stored in `buildings.json`.

Saved games are unaffected by the art change: internal ids (`mia`, `emma`, quest ids, decoration ids) are unchanged.
The two residents are shown as Ms. Rose (guide) and Mr. Baker (bakery clerk) to match the art.

### Not applied yet (needs new art or more work)

- Full-body walking sprites for the 11 residents other than Mr. Baker (they use a portrait badge), and walk cycles for characters 2-6.
- Pond/river shoreline tiles, bridges, hedges and stone paths are extracted but not placed by the map generator.
- Expression and special-action frames, seasonal/event props, the large title-scene props, hearts/gems/energy HUD, extra panel frames.
- A few furniture props (tables, swing, hammock) were clipped by the sheet layout and are left out.
