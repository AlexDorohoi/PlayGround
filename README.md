# Kamikaze Robots

A complete browser-playable recreation inspired by Digital Chocolate's 2007 Java ME robot racer. Built with HTML5 Canvas, TypeScript and Vite. The art is original vector-style canvas work; no original game assets are required.

## Run it

- **Quick start:** run `./start.sh` in the provided OMGithub environment. The preview server builds and serves the game.
- **Local development:** install Node.js 20+ and run `npm install`, then `npm run dev`. Open the URL Vite prints (usually `http://localhost:5173`).
- **Production build:** `npm run build`; serve the generated `dist/` folder from any static web server.
- **Type check:** `npm run typecheck`.

## Controls

- Hold **Space**, **Down**, **Z**, or press and hold the large on-screen button to brake/reverse your rotation and point the robot's feet down.
- Let go to free-spin clockwise. More spin earns a stronger bounce. Time your brake before you hit the ground.
- **Escape** pauses a race; click the on-screen buttons to resume or quit. **S** opens settings from the main menu.
- Mouse and touch are supported. Sound effects are synthesized locally with Web Audio and can be toggled in-race or in settings.

## Features

- Tournament progression with **30 named, increasingly long and demanding courses**, unlockable in order, and cleared-course replay for chip farming.
- Quick Race / Practice with solo play or up to three configurable AI bots.
- Automatic downhill motion, bump and gap terrain, clockwork kick intro, continuous camera follow, airborne spin control, angle-sensitive landings and springy bounce.
- Progressive damage: arms break first, then legs. If the robot's torso is all that's left, an impact ejects a rocket-powered head that can still cross the finish line.
- Four race objectives (win, spin, height and distance), up to four chips per race, four purchasable upgrades with visible stat effects, and local save data.
- Original cartoon robot/terrain illustration, themed hills and space courses, sparks, debris, screen shake, chiptune-style synthesized SFX, HUD, pause, how-to screen and responsive portrait layout.

## Scope notes

- This is an inspired recreation, not a frame-for-frame port. It uses original vector-style art and a shared procedural terrain model; the 30 courses vary in length, challenge settings and visual theme rather than using 30 separately authored track layouts.
- Quick Race supports solo practice or AI opponents. Local pass-and-play multiplayer is not implemented.

## Tuning

- `src/game.ts`: the `LEVELS` list-generation table, `THEMES`, `ground`, physics (`startJump`, `updateActor`, `badImpact`) and rendering.
- `src/main.ts`: menus, controls, race HUD, objective thresholds, progression and upgrades.
- `src/style.css`: interface and responsive styling.

Progress is stored in browser `localStorage` under `kamikaze-save`. Clear the site's storage to reset the tournament.
