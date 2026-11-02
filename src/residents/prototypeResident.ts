import * as THREE from 'three';
import { makeCelMaterial } from '../rendering/materials';
import { TextureSet } from '../rendering/textures';

export interface ResidentWaypoint {
  pos: THREE.Vector3;
  pause: number;
  lookYaw?: number;
  isWorking?: boolean;
  isResting2F?: boolean;
}

export interface AgentRoutineState {
  code: 'WANDER_OUTSIDE' | 'ENTER_SHACK' | 'WORK_1F' | 'CLIMB_STAIRS';
  icon: string;
  bubble: string;
  desc: string;
  waypoints: ResidentWaypoint[];
}

export interface AgentSimState {
  stateIndex: number;
  waypointIndex: number;
  pos: THREE.Vector3;
  yaw: number;
  pauseTimer: number;
  walkSpeed: number;
  animTime: number;
  stateElapsed: number;
}

export interface AgentStepResult {
  activeState: AgentRoutineState;
  currentWP: ResidentWaypoint;
  isMoving: boolean;
  wpProgress: number;
}

export function createAgentRoutineStates(): AgentRoutineState[] {
  return [
    {
      code: 'WANDER_OUTSIDE',
      icon: '☀',
      bubble: 'STROLL',
      desc: 'Walking around the dithered island courtyard',
      waypoints: [
        { pos: new THREE.Vector3(0.0, 0.0, 2.7), pause: 0.4 },
        { pos: new THREE.Vector3(-2.6, 0.0, 3.2), pause: 1.0, lookYaw: -0.6 },
        { pos: new THREE.Vector3(-3.4, 0.0, 0.4), pause: 0.8, lookYaw: 1.4 },
        { pos: new THREE.Vector3(-2.2, 0.0, 3.6), pause: 0.5 },
        { pos: new THREE.Vector3(2.5, 0.0, 3.4), pause: 1.1, lookYaw: -2.2 },
        { pos: new THREE.Vector3(0.0, 0.0, 2.5), pause: 0.4 }
      ]
    },
    {
      code: 'ENTER_SHACK',
      icon: '⌂',
      bubble: 'ENTER 1F',
      desc: 'Entering 1st floor doorway into shack',
      waypoints: [
        { pos: new THREE.Vector3(0.0, 0.12, 1.95), pause: 0.2 },
        { pos: new THREE.Vector3(0.0, 0.24, 1.15), pause: 0.25 },
        { pos: new THREE.Vector3(-0.35, 0.24, -0.35), pause: 0.2 },
        { pos: new THREE.Vector3(-0.92, 0.24, -0.52), pause: 0.2, lookYaw: Math.PI }
      ]
    },
    {
      code: 'WORK_1F',
      icon: '⚒',
      bubble: 'WORK 1F',
      desc: 'Tinkering & cooking at 1F workbench stove',
      waypoints: [
        { pos: new THREE.Vector3(-0.92, 0.24, -0.58), pause: 5.2, lookYaw: Math.PI, isWorking: true }
      ]
    },
    {
      code: 'CLIMB_STAIRS',
      icon: '▲',
      bubble: '2F LOFT',
      desc: 'Climbing stairs to 2F loft & resting by window',
      waypoints: [
        // Walk from workbench to bottom of stairs
        { pos: new THREE.Vector3(0.25, 0.24, 0.85), pause: 0.15 },
        { pos: new THREE.Vector3(1.36, 0.36, 0.90), pause: 0.15, lookYaw: Math.PI },
        // Climb up the stairs to 2F
        { pos: new THREE.Vector3(1.36, 1.35, 0.00), pause: 0.0, lookYaw: Math.PI },
        { pos: new THREE.Vector3(1.36, 2.56, -1.05), pause: 0.2, lookYaw: -Math.PI * 0.5 },
        // Walk to 2F front window & tea table
        { pos: new THREE.Vector3(0.20, 2.56, -1.05), pause: 0.15 },
        { pos: new THREE.Vector3(-0.85, 2.56, 1.22), pause: 3.8, lookYaw: 0.0, isResting2F: true },
        // Return down stairs to exit
        { pos: new THREE.Vector3(0.20, 2.56, -1.05), pause: 0.1 },
        { pos: new THREE.Vector3(1.36, 2.56, -1.05), pause: 0.15, lookYaw: 0.0 },
        { pos: new THREE.Vector3(1.36, 0.36, 0.90), pause: 0.15, lookYaw: 0.0 },
        { pos: new THREE.Vector3(0.0, 0.24, 1.20), pause: 0.15, lookYaw: 0.0 },
        { pos: new THREE.Vector3(0.0, 0.0, 2.50), pause: 0.2, lookYaw: 0.0 }
      ]
    }
  ];
}

export function createInitialAgentSimState(): AgentSimState {
  return {
    stateIndex: 0,
    waypointIndex: 0,
    pos: new THREE.Vector3(0.0, 0.0, 2.7),
    yaw: 0,
    pauseTimer: 0,
    walkSpeed: 1.65,
    animTime: 0,
    stateElapsed: 0
  };
}

const tempVec3 = new THREE.Vector3();

export function stepAgentSimState(
  agent: AgentSimState,
  states: AgentRoutineState[],
  dt: number
): AgentStepResult {
  const currentState = states[agent.stateIndex];
  const currentWP = currentState.waypoints[agent.waypointIndex];
  agent.stateElapsed += dt;

  const toTarget = tempVec3.subVectors(currentWP.pos, agent.pos);
  const dist = toTarget.length();

  let isMoving = false;

  if (dist > 0.04) {
    isMoving = true;
    const step = Math.min(dist, agent.walkSpeed * dt);
    toTarget.normalize();
    agent.pos.addScaledVector(toTarget, step);

    // Smoothly turn towards movement direction on XZ
    const desiredYaw = Math.atan2(toTarget.x, toTarget.z);
    let diff = desiredYaw - agent.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    agent.yaw += diff * Math.min(1.0, dt * 12.0);
  } else {
    agent.pos.copy(currentWP.pos);
    if (currentWP.lookYaw !== undefined) {
      let diff = currentWP.lookYaw - agent.yaw;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      agent.yaw += diff * Math.min(1.0, dt * 10.0);
    }

    agent.pauseTimer += dt;
    if (agent.pauseTimer >= (currentWP.pause || 0)) {
      agent.pauseTimer = 0;
      agent.waypointIndex++;
      if (agent.waypointIndex >= currentState.waypoints.length) {
        agent.waypointIndex = 0;
        agent.stateIndex = (agent.stateIndex + 1) % states.length;
        agent.stateElapsed = 0;
      }
    }
  }

  agent.animTime += dt;

  const activeState = states[agent.stateIndex];
  const wpProgress =
    (agent.waypointIndex + Math.min(1, agent.pauseTimer / Math.max(0.2, currentWP.pause || 1))) /
    activeState.waypoints.length;

  return {
    activeState,
    currentWP,
    isMoving,
    wpProgress
  };
}

export interface SparkParticle {
  mesh: THREE.Mesh;
  phase: number;
}

export interface PrototypeResident {
  residentGroup: THREE.Group;
  sparkGroup: THREE.Group;
  sparks: SparkParticle[];
  states: AgentRoutineState[];
  agent: AgentSimState;
  update: (dt: number) => AgentStepResult;
  dispose: () => void;
}

export function createPrototypeResident(
  scene: THREE.Scene,
  textures: TextureSet,
  toonGradientTex: THREE.Texture
): PrototypeResident {
  const residentGroup = new THREE.Group();
  residentGroup.name = 'PixelResident';
  scene.add(residentGroup);

  const skinMat = makeCelMaterial(toonGradientTex, { color: 0xf1c29b });
  const headMat = makeCelMaterial(toonGradientTex, { map: textures.residentHead });
  const torsoMat = makeCelMaterial(toonGradientTex, { map: textures.residentTorso });
  const pantsMat = makeCelMaterial(toonGradientTex, { color: 0x323b4d });
  const shoeMat = makeCelMaterial(toonGradientTex, { color: 0x261d18 });

  const geometries: THREE.BufferGeometry[] = [];
  const materials: THREE.Material[] = [skinMat, headMat, torsoMat, pantsMat, shoeMat];

  // Articulated limbs with top pivot groups
  const torsoGeo = new THREE.BoxGeometry(0.30, 0.36, 0.20);
  geometries.push(torsoGeo);
  const torsoMesh = new THREE.Mesh(torsoGeo, torsoMat);
  torsoMesh.position.set(0, 0.46, 0);
  torsoMesh.castShadow = true;
  residentGroup.add(torsoMesh);

  const headGeo = new THREE.BoxGeometry(0.28, 0.28, 0.28);
  geometries.push(headGeo);
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.position.set(0, 0.80, 0);
  headMesh.castShadow = true;
  residentGroup.add(headMesh);

  function createLimb(
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    mat: THREE.Material,
    shoe = false
  ): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(x, y, z);
    const geo = new THREE.BoxGeometry(w, h, d);
    geo.translate(0, -h / 2, 0);
    geometries.push(geo);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    pivot.add(mesh);
    if (shoe) {
      const shoeGeo = new THREE.BoxGeometry(w + 0.02, 0.08, d + 0.05);
      geometries.push(shoeGeo);
      const shoeMesh = new THREE.Mesh(shoeGeo, shoeMat);
      shoeMesh.position.set(0, -h + 0.04, 0.02);
      pivot.add(shoeMesh);
    }
    residentGroup.add(pivot);
    return pivot;
  }

  const leftArm = createLimb(0.11, 0.32, 0.11, -0.21, 0.62, 0, skinMat, false);
  const rightArm = createLimb(0.11, 0.32, 0.11,  0.21, 0.62, 0, skinMat, false);
  const leftLeg = createLimb(0.12, 0.28, 0.12, -0.08, 0.28, 0, pantsMat, true);
  const rightLeg = createLimb(0.12, 0.28, 0.12,  0.08, 0.28, 0, pantsMat, true);

  // Tiny voxel sparks / steam particles above workbench when resident is working
  const sparkGroup = new THREE.Group();
  sparkGroup.position.set(-1.35, 1.15, -1.10);
  scene.add(sparkGroup);
  const sparks: SparkParticle[] = [];
  const sparkMat = new THREE.MeshBasicMaterial({ color: 0xffcf56 });
  materials.push(sparkMat);
  for (let i = 0; i < 6; i++) {
    const spGeo = new THREE.BoxGeometry(0.07, 0.07, 0.07);
    geometries.push(spGeo);
    const sp = new THREE.Mesh(spGeo, sparkMat);
    sp.visible = false;
    sparkGroup.add(sp);
    sparks.push({ mesh: sp, phase: i * 0.17 });
  }

  const states = createAgentRoutineStates();
  const agent = createInitialAgentSimState();
  residentGroup.position.copy(agent.pos);

  function update(dt: number): AgentStepResult {
    const result = stepAgentSimState(agent, states, dt);
    const { currentWP, isMoving } = result;

    // Apply quantized stop-motion feel to limb animation (12 fps pose quantization)
    const qTime = Math.floor(agent.animTime * 14) / 14;

    residentGroup.position.copy(agent.pos);
    residentGroup.rotation.y = agent.yaw;

    if (isMoving) {
      const swing = Math.sin(qTime * 11.0) * 0.68;
      leftLeg.rotation.x = swing;
      rightLeg.rotation.x = -swing;
      leftArm.rotation.x = -swing * 0.85;
      rightArm.rotation.x = swing * 0.85;
      headMesh.position.y = 0.80 + Math.abs(Math.sin(qTime * 11.0)) * 0.03;
    } else if (currentWP.isWorking) {
      // Rapid arm bobbing at 1F workbench!
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftArm.rotation.x = -0.75 + Math.sin(qTime * 24.0) * 0.38;
      rightArm.rotation.x = -0.75 - Math.sin(qTime * 24.0) * 0.38;
      headMesh.position.y = 0.80 + Math.sin(qTime * 16.0) * 0.02;
    } else if (currentWP.isResting2F) {
      // Looking out the 2F window / sipping tea
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftArm.rotation.x = -0.35 + Math.sin(qTime * 3.0) * 0.08;
      rightArm.rotation.x = 0.0;
      headMesh.rotation.y = Math.sin(qTime * 1.8) * 0.25;
    } else {
      leftLeg.rotation.x = 0;
      rightLeg.rotation.x = 0;
      leftArm.rotation.x = Math.sin(qTime * 2.5) * 0.06;
      rightArm.rotation.x = -Math.sin(qTime * 2.5) * 0.06;
      headMesh.rotation.y = 0;
    }

    // Workbench sparks when working on 1F
    const showSparks = Boolean(!isMoving && currentWP.isWorking);
    sparks.forEach((sp, idx) => {
      sp.mesh.visible = showSparks;
      if (showSparks) {
        const t = (agent.animTime * 2.2 + sp.phase) % 1.0;
        sp.mesh.position.set(
          Math.sin(idx * 2.1 + agent.animTime * 6) * 0.16,
          t * 0.55,
          Math.cos(idx * 1.7 + agent.animTime * 5) * 0.16
        );
        const s = 1.0 - t * 0.7;
        sp.mesh.scale.set(s, s, s);
      }
    });

    return result;
  }

  return {
    residentGroup,
    sparkGroup,
    sparks,
    states,
    agent,
    update,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
    }
  };
}
