# KWD-001 Architecture Documentation (`kowloon-diorama`)

## 1. Overview & Module Responsibilities

The single-file prototype has been decomposed into focused, strictly typed TypeScript modules under `src/` with zero circular dependencies and explicit resource lifecycle (`dispose()`) ownership:

```text
kowloon-diorama/
├── prototype/
│   └── index.original.html          # Byte-for-byte copy of original prototype
├── src/
│   ├── main.ts                      # Application bootstrap entry point
│   ├── core/
│   │   ├── config.ts                # AppConfig types, defaults, Three.js ColorManagement setup
│   │   └── game.ts                  # Top-level KowloonGame orchestrator & lifecycle owner
│   ├── rendering/
│   │   ├── renderer.ts              # WebGLRenderer creation (1:1 pixel ratio, BasicShadowMap)
│   │   ├── textures.ts              # Seeded PRNG & 12 procedural pixel-art CanvasTextures
│   │   ├── materials.ts             # 4-step cel-shaded MeshToonMaterial factory & Bayer 4x4 ground shader
│   │   ├── pixelPipeline.ts         # Low-res color/depth/normal render targets & outline/quantization pass
│   │   └── lighting.ts              # Ambient, directional shadow, fill, and interior/neon point lights
│   ├── camera/
│   │   └── cameraController.ts      # Isometric orthographic camera, orbit/zoom input, floor raycasting
│   ├── world/
│   │   └── ground.ts                # 16x16 cobblestone island, subsoil, flagstones, grass/pebble scatter
│   ├── buildings/
│   │   └── prototypeShack.ts        # 2-story Kowloon shack geometry, props, and cutaway wall lerp
│   ├── residents/
│   │   └── prototypeResident.ts     # Pure waypoint state machine + articulated voxel resident & sparks
│   └── ui/
│       ├── hud.ts                   # DOM HUD bindings, status badge/progress updates, 3D speech bubble
│       └── styles.css               # Original CSS variables, editorial layout, Day/Night styling
└── tests/
    ├── unit.test.ts                 # Pure logic unit tests (config, PRNG, render targets, camera, AI routine)
    └── browser.test.ts              # Real-browser Playwright smoke tests & baseline/migrated parity suite
```

---

## 2. Initialization Flow

`createKowloonGame(container)` in `src/core/game.ts` preserves the exact initialization order of the original prototype:

1. **Configuration (`createDefaultConfig`)**: Initializes `CONFIG` (`pixelScale = 2`, `theme = 'day'`, `sliceMode = 'all'`, `simSpeed = 1`) and disables Three.js r152+ automatic sRGB color conversions (`THREE.ColorManagement.enabled = false`) to preserve legacy r128 color and shader behavior.
2. **Procedural Textures (`createTextures`)**: Generates all 12 canvas textures deterministically using `createSeededRandom`.
3. **Renderer (`createRenderer`)**: Creates the `WebGLRenderer` (`antialias: false`, `pixelRatio: 1`, `BasicShadowMap`) and mounts the canvas into `#canvas-container`.
4. **Scene & Camera (`createCameraController`)**: Creates the `THREE.Scene` with `dayBg`, constructs the `OrthographicCamera`, and applies the initial isometric transform.
5. **Pixel Pipeline (`createPixelPipeline`)**: Initializes the fullscreen post-processing quad (`postQuadMaterial`) and builds the low-resolution `colorTarget` (with `DepthTexture`) and `normalTarget`.
6. **Lighting & Toon Gradient (`createLighting`, `createToonGradientTexture`)**: Adds `ambientLight`, `dirLight` (with `512×512` shadow frustum), `fillLight`, `stoveLight1F`, `lanternLight2F`, and `neonGlowLight`.
7. **Ground Island (`createGroundIsland`)**: Builds `GroundIsland` with radial Bayer 4×4 dither injected via `onBeforeCompile` on both visual and shadow depth materials.
8. **Prototype Shack (`createShackMaterials`, `createPrototypeShack`)**: Builds `KowloonShack` (`FloorGroup_1`, `FloorGroup_2`, `RoofGroup`), registers `pickableMeshes` (`floorTag = 1 | 2`), and shifts cutaway wall geometry origins to their floor bases for vertical scaling.
9. **Prototype Resident (`createPrototypeResident`)**: Builds `PixelResident` and `sparkGroup`, and places the agent at its initial courtyard waypoint `(0, 0, 2.7)`.
10. **HUD & Input Binding (`createHudController`, `cameraController.bindEvents`)**: Binds `[data-slice]`, `[data-pixel]`, `[data-theme]`, and `[data-speed]` buttons, pointer orbit/click listeners, wheel zoom listener, window resize listener, and exposes `window.__KOWLOON_DIORAMA__`.

---

## 3. Rendering Pipeline

Each frame executes a 3-pass pixel-art pipeline in `pixelPipeline.render()`:

1. **Pass 1 — Low-Resolution Color & Depth (`colorTarget`)**
   - Renders the full `scene` (ground, shack, resident, sparks, lights, shadows) into `colorTarget` at `w = max(64, floor(innerWidth / pixelScale))`, `h = max(64, floor(innerHeight / pixelScale))`.
   - `colorTarget.texture` and `colorTarget.depthTexture` use `THREE.NearestFilter`.
2. **Pass 2 — Structure & Resident Normals (`normalTarget`)**
   - Temporarily sets `scene.background = null`, `groundGroup.visible = false`, and `scene.overrideMaterial = normalOverrideMaterial`, clearing `normalTarget` with `alpha = 0.0`.
   - Ensures only the shack and resident write `alpha > 0.5` into `normalTarget`, preventing the dithered ground island from receiving dark 1px outline borders.
3. **Pass 3 — Fullscreen Post-Process Composite (`postScene`)**
   - Samples `tColor`, `tDepth`, and `tNormal` with nearest-neighbor filtering.
   - Quantizes non-background RGB channels to 28 levels per channel (`floor(col * 28.0 + 0.5) / 28.0`).
   - Where `tNormal.a > 0.5`, applies 1px silhouette depth outlines (`depthDiff >= 0.55`) and 1px normal crease darkening (`normDiff >= 0.42` without depth jump).

---

## 4. Camera Ownership

`CameraController` (`src/camera/cameraController.ts`) owns:

- The `THREE.OrthographicCamera` instance and its frustum aspect updates (`handleResize`).
- `camState` (`yaw`, `pitch`, `distance`, `zoom`, `targetZoom`, `target`, `desiredTarget`, and drag tracking vectors).
- Smooth per-frame damping (`updateSmoothCamera`) lerping `target` toward `desiredTarget` and `zoom` toward `targetZoom` with factor `min(1.0, rawDt * 9.0)`.
- Pointer drag orbit, wheel zoom (`[0.68, 3.2]`), and `THREE.Raycaster` floor picking (`getHoveredFloor`).

---

## 5. Simulation & Frame Update Flow

`KowloonGame` owns a single `requestAnimationFrame` loop (`start()` / `stop()`) that delegates to `stepFrame(rawDt, elapsed)`:

1. Clamps `rawDt` to `0.1s` and computes `simDt = clampedDt * CONFIG.simSpeed`.
2. Calls `resident.update(simDt)`:
   - Pure logic function `stepAgentSimState(agent, states, simDt)` advances position, yaw, pause timers, and state transitions across `WANDER_OUTSIDE -> ENTER_SHACK -> WORK_1F -> CLIMB_STAIRS`.
   - Updates 14 Hz quantized limb rotations and workbench spark positions.
3. Calls `hud.updateAgentHud(...)` to update DOM badges, progress bar width, and the 3D-projected `#resident-bubble` position.
4. Calls `shack.updateCutawayAndSway(CONFIG.sliceMode, clampedDt, elapsed)` to lerp 1F/2F cutaway wall `scale.y` and animate hanging laundry shirts.
5. Updates ambient stove fire flicker and night-mode neon sign pulse.
6. Updates camera smoothing (`cameraController.updateSmoothCamera(clampedDt)`).
7. Executes the 3-pass render (`pixelPipeline.render(...)`).

---

## 6. Intended Extension Points

While KWD-001 introduces no new gameplay abstractions, the modular boundaries cleanly prepare for subsequent milestones:

- **Multi-Building Enclave Grid:** `src/buildings/` can add new building factories alongside `prototypeShack.ts` without touching `pixelPipeline.ts` or `cameraController.ts`.
- **Multi-Resident Simulation:** `stepAgentSimState` in `src/residents/prototypeResident.ts` is already separated from Three.js mesh manipulation and can be instantiated for multiple agents.
- **Resource Cleanup:** Every subsystem returns a `dispose()` method invoked by `game.dispose()`, ensuring GPU textures, geometries, materials, render targets, and DOM event listeners can be cleanly torn down and reinitialized.
