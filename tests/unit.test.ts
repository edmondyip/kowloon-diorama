import { describe, it, expect } from 'vitest';
import { createDefaultConfig } from '../src/core/config';
import { createSeededRandom } from '../src/rendering/textures';
import { getRenderTargetDimensions } from '../src/rendering/pixelPipeline';
import { createCameraController, createInitialCameraState } from '../src/camera/cameraController';
import {
  createAgentRoutineStates,
  createInitialAgentSimState,
  stepAgentSimState
} from '../src/residents/prototypeResident';

describe('Core Configuration & Determinism', () => {
  it('initializes default configuration matching baseline prototype', () => {
    const cfg = createDefaultConfig();
    expect(cfg.pixelScale).toBe(2);
    expect(cfg.theme).toBe('day');
    expect(cfg.sliceMode).toBe('all');
    expect(cfg.simSpeed).toBe(1);
    expect(cfg.dayBg.getHex()).toBe(0xf4f3ef);
    expect(cfg.nightBg.getHex()).toBe(0x0f1216);
    expect(cfg.islandInnerRadius).toBe(5.0);
    expect(cfg.islandOuterRadius).toBe(8.3);
    expect(cfg.baseFrustum).toBe(13.5);
  });

  it('produces deterministic seeded random sequences', () => {
    const rngA = createSeededRandom(101);
    const rngB = createSeededRandom(101);
    const seqA = [rngA(), rngA(), rngA(), rngA(), rngA()];
    const seqB = [rngB(), rngB(), rngB(), rngB(), rngB()];
    expect(seqA).toEqual(seqB);
  });
});

describe('Pixel-Scale Render Target Dimensions', () => {
  it('computes low-resolution dimensions for 1px, 2px, and 3px scales', () => {
    expect(getRenderTargetDimensions(1, 1280, 800)).toEqual({ w: 1280, h: 800 });
    expect(getRenderTargetDimensions(2, 1280, 800)).toEqual({ w: 640, h: 400 });
    expect(getRenderTargetDimensions(3, 1280, 800)).toEqual({ w: 426, h: 266 });
  });

  it('clamps minimum render target dimensions to 64x64', () => {
    expect(getRenderTargetDimensions(3, 100, 90)).toEqual({ w: 64, h: 64 });
  });
});

describe('Camera Controller & State Initialization', () => {
  it('initializes isometric orthographic camera state', () => {
    const state = createInitialCameraState();
    expect(state.yaw).toBeCloseTo(Math.PI * 0.25, 5);
    expect(state.pitch).toBeCloseTo(Math.atan(1 / Math.sqrt(2)), 5);
    expect(state.distance).toBe(36);
    expect(state.zoom).toBe(1.22);
    expect(state.targetZoom).toBe(1.22);
    expect(state.target.toArray()).toEqual([0, 1.8, 0]);
  });

  it('updates camera slice target and zoom for 1F, 2F, and all floors', () => {
    const cfg = createDefaultConfig();
    const ctrl = createCameraController(cfg, 1280, 800);

    ctrl.applySliceCameraTarget('1');
    expect(ctrl.camState.desiredTarget.toArray()).toEqual([0, 1.05, 0]);
    expect(ctrl.camState.targetZoom).toBe(1.68);

    ctrl.applySliceCameraTarget('2');
    expect(ctrl.camState.desiredTarget.toArray()).toEqual([0, 3.15, 0]);
    expect(ctrl.camState.targetZoom).toBeGreaterThanOrEqual(1.62);

    ctrl.applySliceCameraTarget('all');
    expect(ctrl.camState.desiredTarget.toArray()).toEqual([0, 1.85, 0]);
    expect(ctrl.camState.targetZoom).toBe(1.22);

    ctrl.updateSmoothCamera(0.05);
    expect(ctrl.camState.target.y).toBeGreaterThan(1.8);
  });

  it('updates orthographic frustum on resize', () => {
    const cfg = createDefaultConfig();
    const ctrl = createCameraController(cfg, 1000, 1000);
    expect(ctrl.camera.left).toBeCloseTo(-13.5, 5);
    expect(ctrl.camera.right).toBeCloseTo(13.5, 5);

    ctrl.handleResize(1600, 800);
    expect(ctrl.camera.left).toBeCloseTo(-27.0, 5);
    expect(ctrl.camera.right).toBeCloseTo(27.0, 5);
  });
});

describe('Resident Waypoint & Simulation State Machine', () => {
  it('defines the 4 core routine states with exact waypoints', () => {
    const states = createAgentRoutineStates();
    expect(states.map((s) => s.code)).toEqual([
      'WANDER_OUTSIDE',
      'ENTER_SHACK',
      'WORK_1F',
      'CLIMB_STAIRS'
    ]);
    expect(states[0].waypoints.length).toBe(6);
    expect(states[1].waypoints.length).toBe(4);
    expect(states[2].waypoints.length).toBe(1);
    expect(states[2].waypoints[0].isWorking).toBe(true);
    expect(states[3].waypoints.length).toBe(11);
    expect(states[3].waypoints[5].isResting2F).toBe(true);
  });

  it('advances resident along waypoints and transitions across all 4 states back to 0', () => {
    const states = createAgentRoutineStates();
    const agent = createInitialAgentSimState();

    const visitedStates = new Set<string>();
    for (let i = 0; i < 1500; i++) {
      const res = stepAgentSimState(agent, states, 0.1);
      visitedStates.add(res.activeState.code);
    }

    expect(Array.from(visitedStates)).toEqual([
      'WANDER_OUTSIDE',
      'ENTER_SHACK',
      'WORK_1F',
      'CLIMB_STAIRS'
    ]);
  });
});
