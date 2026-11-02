# KWD-001 Baseline Reference (`index.html`)

## 1. Original Source Location & Integrity

- **Original File Path:** `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City/index.html`
- **Preserved Copy Path:** `/Users/edmondyip/Documents/Projects/Games/Pixel Kowloon City/kowloon-diorama/prototype/index.original.html`
- **File Size:** `77,772` bytes (`2,151` lines)
- **SHA-256 Hash:** `895294caec32cc531ce7d6886c11f2d2b0e6f06a1cd6235a8b68b3f8f7df9b4b`

Both the original `index.html` and `prototype/index.original.html` match byte-for-byte with SHA-256 `895294caec32cc531ce7d6886c11f2d2b0e6f06a1cd6235a8b68b3f8f7df9b4b`.

---

## 2. Feature Inventory

1. **Three.js Scene & Orthographic Isometric Camera**
   - Orthographic camera with `baseFrustum = 13.5`, `near = 0.1`, `far = 120`.
   - Initial isometric framing: `yaw = Math.PI * 0.25` (45°), `pitch = Math.atan(1 / Math.sqrt(2))` (~35.264°), `distance = 36`, `zoom = 1.22`, `target = (0, 1.8, 0)`.
   - `WebGLRenderer` with `antialias: false`, `pixelRatio: 1`, `BasicShadowMap` (`512×512` directional shadow map).

2. **Multi-Pass Low-Resolution Pixel-Art Pipeline**
   - Pass 1 (`colorTarget`): Renders low-resolution color (`RGBAFormat`, `NearestFilter`) and hardware `DepthTexture` (`UnsignedShortType`, `NearestFilter`) at `floor(viewport / pixelScale)` (clamped to minimum `64×64`).
   - Pass 2 (`normalTarget`): Hides `GroundIsland` and renders `scene` with `MeshNormalMaterial` override and transparent clear (`alpha = 0`) so only 3D building structures and the resident have `alpha > 0.5`.
   - Pass 3 (`postScene` fullscreen quad): Nearest-neighbor upscale with 16-bit palette quantization (`floor(col * 28.0 + 0.5) / 28.0`), 1px silhouette depth outlines (`step(0.55, depthDiff)`), and 1px normal crease outlines (`step(0.42, normDiff)`), restricted to `isStructureOrAgent` (`normalTarget.a > 0.5`) so ground dithering remains clean.

3. **"Stari Most" Ground-Only Radial Bayer 4×4 Dither**
   - Injected via `material.onBeforeCompile` on ground materials (`groundMainMat`, `groundSubSoilMat`, `grassMat`, `mossMat`, `pebbleMat`, `flagstoneMat`) and their `customDepthMaterial`.
   - Dissolves the `16×16` cobblestone island radially between `uInnerRadius = 5.0` and `uOuterRadius = 8.3` with an angular harmonic wobble (`sin(5θ)*0.28 + cos(3θ)*0.22`) against a 4×4 Bayer threshold matrix.

4. **Procedural Pixel-Art Canvas Textures (`TEXTURES`)**
   - 12 deterministic LCG-seeded (`createSeededRandom`) canvas textures with `NearestFilter`:
     - `groundTile` (64×64, seed 101, repeat 4×4)
     - `woodPlanks` (32×32, seed 202, repeat 2×2)
     - `interiorFloor` (32×32, seed 303, repeat 3×3)
     - `corrugatedTin` (32×32, seed 404, repeat 2×2)
     - `patchedWallTin` (32×32, seed 505, repeat 2×1)
     - `concreteWall` (32×32, seed 606, repeat 2×1)
     - `windowPane` (16×16)
     - `neonSign` (32×64, "九記" pixel glyphs)
     - `acUnit` (16×16)
     - `quilt` (16×16)
     - `residentHead` (16×16)
     - `residentTorso` (16×16)
   - Plus a `4×1` 4-step `toonGradientTex` used by `MeshToonMaterial`.

5. **Two-Story Kowloon Shack (`KowloonShack`)**
   - `FloorGroup_1` (1F): Concrete plinth, wooden floor, front step, corner posts, cutaway walls, open inward door, window, tin awning, workbench & wok stove with fire, exhaust hood, tool box, stool, bed/cot with quilt & pillow, 8-step interior staircase with stringers/handrail/under-stair crate, exterior LPG cylinders, water pipe, red crate, and terracotta plant.
   - `FloorGroup_2` (2F): Overhanging cantilevered 4-slab deck (with stairwell opening), 6 diagonal support struts, wood/patched-tin cutaway walls, 3 glowing windows, exterior AC unit, vertical neon sign ("九記"), bamboo laundry pole with 2 swaying shirts, low tea table with cushions & teapot, bookshelf, and stairwell railing.
   - `RoofGroup`: Ceiling trim, pitched corrugated tin roof halves, ridge cap, blue tarpaulin patch, stilted metal water tank, fishbone TV antenna mast, and stove exhaust chimney.

6. **Floor Slicing & Cutaway Wall Animation**
   - Modes: `all`, `1` (1F), `2` (2F).
   - `1`: `FloorGroup_1.visible = true`, `FloorGroup_2.visible = false`, `RoofGroup.visible = false`; 1F cutaway walls smoothly lerp `scale.y` down to `cutScaleY`; camera target moves to `(0, 1.05, 0)` and zoom to `>= 1.68`.
   - `2`: `FloorGroup_1.visible = true`, `FloorGroup_2.visible = true`, `RoofGroup.visible = false`; 2F cutaway walls smoothly lerp `scale.y` down to `cutScaleY`; camera target moves to `(0, 3.15, 0)` and zoom to `>= 1.62`.
   - `all`: All groups visible, walls lerp back to `1.0`, camera target `(0, 1.85, 0)`, zoom `1.22`.

7. **Autonomous Resident Simulation (`PixelResident`)**
   - Articulated voxel character (torso, head, left/right arms and legs with top pivots and shoes) plus 6 workbench spark particles.
   - 4-state routine cycle (`AGENT_STATES`):
     1. `WANDER_OUTSIDE` (6 courtyard waypoints)
     2. `ENTER_SHACK` (4 doorway/interior waypoints)
     3. `WORK_1F` (1 workbench waypoint, `pause = 5.2s`, `isWorking = true`, rapid arm bobbing + sparks)
     4. `CLIMB_STAIRS` (11 waypoints climbing 1F stairs to 2F loft, resting by 2F window with `isResting2F = true` for `3.8s`, then descending and exiting)
   - Stop-motion limb animation quantized at 14 Hz (`Math.floor(animTime * 14) / 14`).

8. **Camera Controls, Raycasting & Editorial HUD**
   - Left-button pointer drag orbits 360° yaw and clamps pitch to `[0.22, 1.18]`.
   - Wheel scroll zooms within `[0.68, 3.2]`.
   - Pointer hover raycasts `pickableMeshes` (ignoring `FloorGroup_2` when hidden), displaying `#floor-tooltip` and `[HOVER: 1F/2F]`.
   - Clean click on 1F/2F meshes slices that floor; clicking ground/background resets to `all`.
   - Top HUD (`brand-card`, `agent-card` with state badge, description, progress bar, slice readout), floating 3D-tracked `#resident-bubble`, and bottom controls bar (`Slice`, `Pixel`, `Theme`, `Speed`).

---

## 3. Known Pre-Existing Baseline Limitations (Preserved Intentionally)

Per KWD-001 requirements, the following baseline behaviors are preserved without modification:

1. **Roof Corrugation Orientation:** The `corrugatedTin` canvas texture draws vertical stripes along X (`for (let x = 0; x < w; x += 4)`), which run across the roof pitch rather than down the slope.
2. **Resident Visibility During 1F Slice:** When `sliceMode === '1'` and the resident climbs to 2F (`CLIMB_STAIRS`), `residentGroup` remains visible in the scene even though `FloorGroup_2` is hidden.
3. **Initial vs. Reset Camera Target Y:** Initial `camState.target.y` is `1.8`, whereas `setSliceMode('all')` sets `camState.desiredTarget.y` to `1.85`.
4. **CDN Script Dependency in Original HTML:** `prototype/index.original.html` references `https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js`.

---

## 4. Baseline Capture Details

Baseline reference screenshots were captured at a fixed `1280×800` viewport in headless Google Chrome (ANGLE WebGL) with deterministic resident state positioning across all 9 required states:

- `docs/screenshots/baseline/01-day-all-floors.png` — Day Paper, all floors (`2px`)
- `docs/screenshots/baseline/02-night-all-floors.png` — Night Neon, all floors (`2px`)
- `docs/screenshots/baseline/03-day-1f-sliced.png` — Day Paper, 1F sliced
- `docs/screenshots/baseline/04-day-2f-sliced.png` — Day Paper, 2F sliced
- `docs/screenshots/baseline/05-pixel-scale-1px.png` — Day Paper, Pixel Scale `1px`
- `docs/screenshots/baseline/06-pixel-scale-2px.png` — Day Paper, Pixel Scale `2px`
- `docs/screenshots/baseline/07-pixel-scale-3px.png` — Day Paper, Pixel Scale `3px`
- `docs/screenshots/baseline/08-resident-working-1f.png` — Resident working at 1F workbench (`WORK_1F`, 1F sliced)
- `docs/screenshots/baseline/09-resident-resting-2f.png` — Resident resting by 2F loft window (`CLIMB_STAIRS`, 2F sliced)
