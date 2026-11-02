import * as THREE from 'three';
import { AppConfig, createDefaultConfig, SliceMode, ThemeMode } from './config';
import { createTextures, TextureSet } from '../rendering/textures';
import { createRenderer, RendererBundle } from '../rendering/renderer';
import { CameraController, createCameraController } from '../camera/cameraController';
import { createPixelPipeline, PixelPipeline } from '../rendering/pixelPipeline';
import { createLighting, SceneLights } from '../rendering/lighting';
import { createShackMaterials, createToonGradientTexture, ShackMaterialSet } from '../rendering/materials';
import { createGroundIsland, GroundIsland } from '../world/ground';
import { createPrototypeShack, PrototypeShack } from '../buildings/prototypeShack';
import { AgentSimState, createPrototypeResident, PrototypeResident } from '../residents/prototypeResident';
import { createHudController, HudController } from '../ui/hud';

export interface KowloonDebugHandle {
  CONFIG: AppConfig;
  setSliceMode: (mode: SliceMode | string | number) => void;
  setPixelScale: (scale: number | string) => void;
  setTheme: (theme: ThemeMode | string) => void;
  setSimSpeed: (speed: number | string) => void;
  FloorGroup_1: THREE.Group;
  FloorGroup_2: THREE.Group;
  RoofGroup: THREE.Group;
  agent: AgentSimState;
}

declare global {
  interface Window {
    __KOWLOON_DIORAMA__?: KowloonDebugHandle;
  }
}

export interface KowloonGame {
  readonly config: AppConfig;
  readonly textures: TextureSet;
  readonly rendererBundle: RendererBundle;
  readonly scene: THREE.Scene;
  readonly cameraController: CameraController;
  readonly pixelPipeline: PixelPipeline;
  readonly lights: SceneLights;
  readonly materials: ShackMaterialSet;
  readonly ground: GroundIsland;
  readonly shack: PrototypeShack;
  readonly resident: PrototypeResident;
  readonly hud: HudController;
  setSliceMode: (mode: SliceMode | string | number) => void;
  setPixelScale: (scale: number | string) => void;
  setTheme: (theme: ThemeMode | string) => void;
  setSimSpeed: (speed: number | string) => void;
  stepFrame: (rawDt: number, elapsed: number) => void;
  start: () => void;
  stop: () => void;
  dispose: () => void;
}

export function createKowloonGame(container: HTMLElement): KowloonGame {
  // 1. Configuration & Global State
  const CONFIG = createDefaultConfig();

  // 2. Procedural Pixel-Art Canvas Texture Generator
  const TEXTURES = createTextures();

  // 3. Scene, Camera & Low-Res Pixel Art Pipeline Setup
  const rendererBundle = createRenderer(container, window.innerWidth, window.innerHeight);
  const { renderer } = rendererBundle;

  const scene = new THREE.Scene();
  scene.background = CONFIG.dayBg.clone();

  const cameraController = createCameraController(CONFIG, window.innerWidth, window.innerHeight);
  const { camera } = cameraController;

  const pixelPipeline = createPixelPipeline(CONFIG, camera, window.innerWidth, window.innerHeight);

  // 4. Lighting & Cel-Stepped Pixel Material Factory
  const lights = createLighting(scene);
  const toonGradientTex = createToonGradientTexture();

  // 5. "Stari Most" Ground-Only Radial Bayer 4x4 Dithered Edge Fade
  const ground = createGroundIsland(scene, CONFIG, TEXTURES, toonGradientTex);

  // 6. The 2-Story Kowloon Wooden/Tin Shack & Interactive Floor Cutaway
  const MAT = createShackMaterials(TEXTURES, toonGradientTex);
  const shack = createPrototypeShack(scene, MAT);

  // 7. Autonomous Pixel Resident (Agent Simulation & Waypoint Routine)
  const resident = createPrototypeResident(scene, TEXTURES, toonGradientTex);

  // 8. UI Overlay & Interactive Floor Slice Controls
  const hud = createHudController(container);

  function setSliceMode(mode: SliceMode | string | number): void {
    const normalized = String(mode) as SliceMode;
    CONFIG.sliceMode = normalized;

    hud.updateSliceUI(normalized);

    if (normalized === '1') {
      shack.FloorGroup_1.visible = true;
      shack.FloorGroup_2.visible = false;
      shack.RoofGroup.visible = false;
    } else if (normalized === '2') {
      shack.FloorGroup_1.visible = true;
      shack.FloorGroup_2.visible = true;
      shack.RoofGroup.visible = false;
    } else {
      shack.FloorGroup_1.visible = true;
      shack.FloorGroup_2.visible = true;
      shack.RoofGroup.visible = true;
    }
    cameraController.applySliceCameraTarget(normalized);
  }

  function setPixelScale(scale: number | string): void {
    CONFIG.pixelScale = Number(scale);
    hud.updatePixelScaleUI(CONFIG.pixelScale);
    pixelPipeline.initRenderTargets(window.innerWidth, window.innerHeight);
  }

  function setTheme(theme: ThemeMode | string): void {
    const normalized: ThemeMode = theme === 'night' ? 'night' : 'day';
    CONFIG.theme = normalized;
    const isNight = normalized === 'night';

    hud.updateThemeUI(normalized);

    (scene.background as THREE.Color).copy(isNight ? CONFIG.nightBg : CONFIG.dayBg);
    pixelPipeline.setNightMode(isNight);

    // Adjust scene lighting and window/neon glow for Night Neon vs Day Paper
    if (isNight) {
      lights.ambientLight.color.setHex(0x3a4c6e);
      lights.ambientLight.intensity = 0.46;
      lights.dirLight.color.setHex(0x6b88b8);
      lights.dirLight.intensity = 0.42;
      lights.stoveLight1F.intensity = 1.45;
      lights.lanternLight2F.intensity = 1.35;
      lights.neonGlowLight.intensity = 1.65;
      MAT.windowGlass.emissiveIntensity = 0.95;
      MAT.neonSign.emissiveIntensity = 1.0;
    } else {
      lights.ambientLight.color.setHex(0xfff4e0);
      lights.ambientLight.intensity = 0.72;
      lights.dirLight.color.setHex(0xfff2d6);
      lights.dirLight.intensity = 0.92;
      lights.stoveLight1F.intensity = 0.80;
      lights.lanternLight2F.intensity = 0.55;
      lights.neonGlowLight.intensity = 0.0;
      MAT.windowGlass.emissiveIntensity = 0.15;
      MAT.neonSign.emissiveIntensity = 0.35;
    }
  }

  function setSimSpeed(speed: number | string): void {
    CONFIG.simSpeed = Number(speed);
    hud.updateSimSpeedUI(CONFIG.simSpeed);
  }

  hud.bindButtons({
    onSliceMode: (m) => setSliceMode(m),
    onPixelScale: (s) => setPixelScale(s),
    onTheme: (t) => setTheme(t),
    onSimSpeed: (sp) => setSimSpeed(sp)
  });

  // 9. Raycasting (Hover & Click Floor Selection) + Orbit/Zoom Camera Input
  cameraController.bindEvents(container, shack.pickableMeshes, shack.FloorGroup_2, {
    onDragStart() {
      hud.hideTooltip();
    },
    onHoverFloorChange(hoveredFloorTag, clientX, clientY) {
      hud.updateHoverFloorUI(hoveredFloorTag, CONFIG.sliceMode, clientX, clientY);
    },
    onFloorClick(clickedFloor) {
      if (clickedFloor === 1) {
        setSliceMode('1');
      } else if (clickedFloor === 2) {
        setSliceMode('2');
      } else if (CONFIG.sliceMode !== 'all') {
        setSliceMode('all');
      }
    }
  });

  const onWindowResize = (): void => {
    cameraController.handleResize(window.innerWidth, window.innerHeight);
    renderer.setSize(window.innerWidth, window.innerHeight);
    pixelPipeline.initRenderTargets(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onWindowResize);

  // 10. Animation Loop
  const clock = new THREE.Clock();
  let rafId: number | null = null;

  function stepFrame(rawDt: number, elapsed: number): void {
    const clampedDt = Math.min(rawDt, 0.1);
    const simDt = clampedDt * CONFIG.simSpeed;

    // 1. Update autonomous resident
    const stepResult = resident.update(simDt);
    hud.updateAgentHud(stepResult, resident.agent.pos, camera, window.innerWidth, window.innerHeight);

    // 2. Update cutaway wall heights & ambient animations
    shack.updateCutawayAndSway(CONFIG.sliceMode, clampedDt, elapsed);

    // Subtle stove fire flicker
    lights.stoveLight1F.intensity =
      (CONFIG.theme === 'night' ? 1.35 : 0.75) + Math.sin(elapsed * 17.0) * 0.12;

    // Subtle neon sign pulse in Night Mode
    if (CONFIG.theme === 'night') {
      lights.neonGlowLight.intensity = 1.55 + Math.sin(elapsed * 8.0) * 0.15;
    }

    // 3. Smoothly lerp camera target & zoom
    cameraController.updateSmoothCamera(clampedDt);

    // 4-6. Multi-pass low-res pixel pipeline
    pixelPipeline.render(renderer, scene, camera, ground.groundGroup);
  }

  function animate(): void {
    rafId = requestAnimationFrame(animate);
    const rawDt = clock.getDelta();
    const elapsed = clock.getElapsedTime();
    stepFrame(rawDt, elapsed);
  }

  function start(): void {
    if (rafId !== null) return;
    clock.start();
    animate();
  }

  function stop(): void {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
  }

  function dispose(): void {
    stop();
    window.removeEventListener('resize', onWindowResize);
    hud.dispose();
    cameraController.dispose();
    resident.dispose();
    shack.dispose();
    ground.dispose();
    MAT.dispose();
    lights.dispose();
    pixelPipeline.dispose();
    rendererBundle.dispose();
    TEXTURES.dispose();
    if (window.__KOWLOON_DIORAMA__?.CONFIG === CONFIG) {
      delete window.__KOWLOON_DIORAMA__;
    }
  }

  // Expose state helper on window for quick inspection/debugging
  window.__KOWLOON_DIORAMA__ = {
    CONFIG,
    setSliceMode,
    setPixelScale,
    setTheme,
    setSimSpeed,
    FloorGroup_1: shack.FloorGroup_1,
    FloorGroup_2: shack.FloorGroup_2,
    RoofGroup: shack.RoofGroup,
    agent: resident.agent
  };

  return {
    config: CONFIG,
    textures: TEXTURES,
    rendererBundle,
    scene,
    cameraController,
    pixelPipeline,
    lights,
    materials: MAT,
    ground,
    shack,
    resident,
    hud,
    setSliceMode,
    setPixelScale,
    setTheme,
    setSimSpeed,
    stepFrame,
    start,
    stop,
    dispose
  };
}
