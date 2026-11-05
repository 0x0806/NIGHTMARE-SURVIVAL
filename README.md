# Nightmare Survival

A top-down flashlight horror game that runs in the browser. No build step, no dependencies.

The ward lost power at 3:07 a.m. Restore every fuse, reach the exit, and don't let the dark get into your head.

**Play online:** https://0x0806.github.io/NIGHTMARE-SURVIVAL/ (installable and playable offline after the first visit).

**Run locally:** open `index.html` in a modern browser, or serve the folder (`python3 -m http.server`) and visit `http://localhost:8000`.

## How it plays

- **Goal:** collect every fuse in the ward, then reach the exit. Each ward is procedurally generated and larger than the last.
- **Light is everything.** Dynamic raycast lighting means you only see what your torch (or a flare) reaches. Walls and props cast real shadows. The battery drains.
- **Four things hunt you**
  - *Wraith*: patrols and chases on sight. Using your torch makes you easier to spot.
  - *Crawler*: fast, hears everything. Flares make it flee.
  - *Stalker*: moves only while it is out of your light. Keep it in the beam.
  - *Howler*: never moves, but its scream pulls every hunter to you.
- **Sanity:** darkness and close encounters erode it. Low sanity brings flickering light, hallucinations and screen distortion; at zero it hurts you.
- **Noise:** sprinting is loud, standing still is quiet, throwing a flare is loud. Enemies react to what they hear.
- **Lockers:** press `E` beside one to hide. Hunters lose sight of you, but they come and check, and a hunter that stands next to your locker long enough finds you.
- **Lamps:** some rooms have ceiling lamps. Lit rooms restore your mind and freeze the Stalker. Many of them are failing, and flicker.
- **Case file:** each ward hides a note from the staff. Collected notes are saved and readable from the menu.
- **Pickups:** batteries, medkits, pills and flares are scattered around; fuses glow faintly through the dark.
- **Difficulty:** Easy, Normal or Nightmare (enemy speed, supplies and score multiplier). On top of that, a small director nudges things up or down based on how you did last ward.

### Modes

| Mode | Goal |
|---|---|
| Survival | Go as deep as you can. Score is based on wards, fuses and speed. |
| Speedrun | Clear five wards as fast as possible. Ranked by total time. |

Leaderboards are stored **locally on your device** (`localStorage`); there is no server.

## Controls

| Input | Action |
|---|---|
| `W A S D` / arrows | Move |
| Mouse | Aim the torch |
| `Shift` | Run (loud, drains breath) |
| Left click / `F` / `Space` | Throw a flare |
| Right click / `Q` | Torch on/off |
| `E` | Use the exit / hide in a locker / come out |
| `Esc` / `P` | Pause |
| `M` | Mute |

**Touch:** left stick moves, right stick aims, buttons for run, flare, torch and use. **Gamepad:** sticks move/aim, `A` flare, `X` torch, `Y` use, `Start` pause.

## Settings

Difficulty, volume, darkness (higher is harder to see), graphics quality (temporarily lowers itself if the frame rate drops, without changing your saved setting), screen shake and glitches (off by default when your OS asks for reduced motion), vibration, and a frame-rate counter.

## Under the hood

| File | Contents |
|---|---|
| `index.html` | Screens, HUD and touch controls |
| `style.css` | Interface styling |
| `script.js` | Everything else |
| `sw.js`, `manifest.webmanifest` | Offline cache and install support |
| `fonts/`, `icons/` | Self-hosted woff2 fonts, app icons and the link-preview image (no third-party requests) |

`script.js` is organised into: seeded level generator (rooms, corridors, props with guaranteed connectivity), grid-DDA raycaster used for lighting and line of sight, enemy AI (patrol / investigate / chase / search) over BFS flow fields, a procedural Web Audio engine (drones, heartbeat, positional growls, no audio files), a canvas renderer with pre-baked tile sprites, and the UI/state machine.

## Credits

Developed by 0x0806. Fonts: IM Fell English SC and Special Elite (SIL Open Font License), self-hosted.
