# KWD-001 Migration Report

## 1. Files Created

| File Path | Purpose |
| :--- | :--- |
| `prototype/index.original.html` | Exact byte-for-byte copy of original single-file HTML prototype |
| `index.html` | Vite HTML entry point preserving original HUD DOM structure |
| `package.json` | Project metadata, scripts (`dev`, `build`, `preview`, `typecheck`, `test`), dependencies |
| `tsconfig.json` | TypeScript configuration (`strict: true`, `noUnusedLocals`, `noUnusedParameters`, `noImplicitReturns`) |
| `vite.config.ts` | Vite configuration |
| `.gitignore` | Excludes `node_modules/`, `dist/`, test artifacts, and OS metadata |
| `src/main.ts` | Application bootstrap entry point |
| `src/core/config.ts` | `AppConfig` interface, default values, and Three.js legacy color management toggle |
| `src/core/game.ts` | `KowloonGame` orchestrator, single RAF loop, theme/slice/pixel/speed controllers, and disposal |
| `src/rendering/renderer.ts` | `WebGLRenderer` creation (`pixelRatio: 1`, `BasicShadowMap`) |
| `src/rendering/textures.ts` | Deterministic seeded PRNG (`createSeededRandom`) and 12 procedural pixel-art canvas textures |
| `src/rendering/materials.ts` | 4-step cel-shaded `MeshToonMaterial` factory and "Stari Most" radial Bayer 4×4 ground dither |
| `src/rendering/pixelPipeline.ts` | Low-res color/depth/normal render targets and 1px outline + palette quantization post-processing pass |
| `src/rendering/lighting.ts` | Ambient, directional shadow, fill, stove, lantern, and neon point lights |
| `src/camera/cameraController.ts` | Isometric orthographic camera, orbit/zoom input handlers, and floor raycasting |
| `src/world/ground.ts` | `16×16` cobblestone island, earthen under-slab, flagstones, and voxel grass/pebble scatter |
| `src/buildings/prototypeShack.ts` | 2-story Kowloon shack geometry (`FloorGroup_1`, `FloorGroup_2`, `RoofGroup`) and cutaway wall animation |
| `src/residents/prototypeResident.ts` | Pure waypoint state machine (`stepAgentSimState`) and articulated voxel resident + workbench sparks |
| `src/ui/hud.ts` | DOM HUD state readouts, button bindings, hover tooltip, and 3D-projected speech bubble |
| `src/ui/styles.css` | Extracted baseline CSS variables, layout, and Day Paper / Night Neon styles |
| `tests/unit.test.ts` | Unit tests for config, PRNG, render-target dimensions, camera state, and resident state machine |
| `tests/browser.test.ts` | Real-browser Playwright verification and baseline-vs-migrated visual comparison suite |
| `docs/BASELINE.md` | Source SHA-256, feature inventory, pre-existing limitations, and baseline capture details |
| `docs/ARCHITECTURE.md` | Module responsibilities, initialization order, rendering pipeline, and simulation flow |
| `docs/MIGRATION_REPORT.md` | This migration report |

---

## 2. Installed Package Versions

| Package | Version | Role |
| :--- | :--- | :--- |
| `three` | `0.171.0` | 3D WebGL rendering engine (installed via npm) |
| `@types/three` | `0.171.0` | TypeScript definitions for Three.js |
| `@types/node` | `25.9.3` | TypeScript definitions for Node.js test harness |
| `vite` | `6.3.6` | Build tool and dev/preview server |
| `typescript` | `5.8.3` | Strict TypeScript compiler |
| `vitest` | `3.2.7` | Automated test runner |
| `@playwright/test` / `playwright` | `1.54.1` | Headless Chrome browser automation and screenshot verification |
| `rollup` (override) | `4.39.0` | Pinned Rollup version matching local offline cache |

### Minimal Three.js Compatibility Adjustments (r128 → r171)

Because the original prototype loaded Three.js `r128` from CDN and npm installs `three@0.171.0`, two minimal compatibility settings were documented and applied so the visual output matches `r128`:

1. **`THREE.ColorManagement.enabled = false`** (`src/core/config.ts`): Three.js r152+ enabled automatic sRGB-to-linear color management by default, which alters hex color literals and procedural canvas textures unless disabled. Setting `THREE.ColorManagement.enabled = false` preserves the exact `r128` color space pipeline.
2. **PointLight `decay = 1`** (`src/rendering/lighting.ts`): Three.js r155+ changed the default `PointLight.decay` from `1` to `2`. Explicitly passing `decay = 1` to `stoveLight1F`, `lanternLight2F`, and `neonGlowLight` preserves the original warm interior and neon point-light falloff.

---

## 3. Verification Commands & Results

All commands were executed in `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City/kowloon-diorama`:

1. **Typecheck (`npm run typecheck`)**
   - Command: `tsc --noEmit`
   - Result: **PASS** (0 errors, `strict: true`).
2. **Production Build (`npm run build`)**
   - Command: `tsc --noEmit && vite build`
   - Result: **PASS** (`dist/index.html`, `dist/assets/index-*.css`, `dist/assets/index-*.js` built in ~713ms).
3. **Automated Unit & Browser Verification Suite (`npm test`)**
   - Command: `vitest run`
   - Result: **PASS** (`2` test files passed, `12` tests passed, `0` console errors, `0` page/WebGL errors).

---

## 4. Visual Comparison Results (`1280×800` Viewport)

Reference screenshots for both `prototype/index.original.html` (`docs/screenshots/baseline/`) and the migrated Vite + TypeScript build (`docs/screenshots/migrated/`) were captured at identical `1280×800` viewport dimensions and compared pixel-by-pixel (`docs/screenshots/parity-report.json`):

| Reference State | Screenshot Filename | Mean Abs RGB Diff (0–255) | Pixels Within ±8 RGB (%) |
| :--- | :--- | :---: | :---: |
| Day Paper, all floors (`2px`) | `01-day-all-floors.png` | `0.0210` | `99.55%` |
| Night Neon, all floors (`2px`) | `02-night-all-floors.png` | `0.0189` | `99.57%` |
| Day Paper, 1F sliced (`2px`) | `03-day-1f-sliced.png` | `0.0988` | `97.83%` |
| Day Paper, 2F sliced (`2px`) | `04-day-2f-sliced.png` | `0.0785` | `98.31%` |
| Pixel Scale `1px` | `05-pixel-scale-1px.png` | `0.0408` | `99.31%` |
| Pixel Scale `2px` | `06-pixel-scale-2px.png` | `0.0229` | `99.49%` |
| Pixel Scale `3px` | `07-pixel-scale-3px.png` | `0.0204` | `99.55%` |
| Resident working on 1F (`WORK_1F`) | `08-resident-working-1f.png` | `0.0497` | `98.99%` |
| Resident resting on 2F (`CLIMB_STAIRS`) | `09-resident-resting-2f.png` | `0.0379` | `99.48%` |

### Observable Deviations

- **Asynchronous Wall/Camera Lerp Timing (< 2.2% pixels on transitions):** Because `THREE.Clock.getDelta()` depends on wall-clock frame intervals during the `650ms` settle window after switching slice modes, exponential damping (`camState.target.lerp` and `mesh.scale.y`) can differ by a fraction of a sub-pixel between two browser runs, shifting a small number of low-res pixel edges by 1 texel during slice transitions (`97.83%`–`98.31%` exact match). Static states match at `99.31%`–`99.57%` with mean RGB difference `< 0.05 / 255`.
- **Three.js Version (`r128` CDN vs `0.171.0` npm):** With `THREE.ColorManagement.enabled = false` and `PointLight` `decay = 1`, material colors, cel-shading bands, Bayer 4×4 ground dithering, and 1px depth/normal outlines match the baseline prototype.

---

## 5. Known Migration Risks & Outstanding Issues

- **Workspace Placement Note:** The active workspace root is `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City` and OS sandbox permissions restrict writing to the parent directory `/Users/edmondyip/Documents/Projects/Games/`. Consequently, `kowloon-diorama` was created at `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City/kowloon-diorama` while keeping `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City/index.html` completely untouched and also preserving `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City/kowloon-diorama/prototype/index.original.html`.
- **Pre-Existing Baseline Quirks Preserved:** Roof corrugation orientation and resident visibility when `sliceMode === '1'` and the resident is on 2F were intentionally left unmodified per KWD-001 instructions.
