import * as THREE from 'three';
import { AppConfig } from '../core/config';
import { applyGroundRadialBayerDither, makeCelMaterial } from '../rendering/materials';
import { createSeededRandom, TextureSet } from '../rendering/textures';

export interface GroundIsland {
  groundGroup: THREE.Group;
  dispose: () => void;
}

export function createGroundIsland(
  scene: THREE.Scene,
  config: AppConfig,
  textures: TextureSet,
  toonGradientTex: THREE.Texture
): GroundIsland {
  const groundGroup = new THREE.Group();
  groundGroup.name = 'GroundIsland';
  scene.add(groundGroup);

  const makeGroundMat = (color: number, map?: THREE.Texture) =>
    applyGroundRadialBayerDither(makeCelMaterial(toonGradientTex, { color, map }), config);

  const groundMainMat = makeGroundMat(0xd8d2c5, textures.groundTile);
  const groundSubSoilMat = makeGroundMat(0x5c5346);

  // Top cobblestone slab (16x16 units centered at 0,0,0)
  const groundSlabGeo = new THREE.BoxGeometry(16, 0.36, 16);
  const groundSlab = new THREE.Mesh(groundSlabGeo, groundMainMat);
  groundSlab.position.set(0, -0.18, 0);
  groundSlab.receiveShadow = true;
  groundSlab.castShadow = false;
  groundSlab.customDepthMaterial = groundMainMat.userData.customDepthMaterial as THREE.Material;
  groundGroup.add(groundSlab);

  // Subtle earthen under-layer for edge thickness
  const subSlabGeo = new THREE.BoxGeometry(15.6, 0.45, 15.6);
  const subSlab = new THREE.Mesh(subSlabGeo, groundSubSoilMat);
  subSlab.position.set(0, -0.58, 0);
  subSlab.receiveShadow = true;
  subSlab.customDepthMaterial = groundSubSoilMat.userData.customDepthMaterial as THREE.Material;
  groundGroup.add(subSlab);

  // Scattered stray grass tufts, mossy stepping stones & pebbles on the ground (also dithered!)
  const grassMat = makeGroundMat(0x5c7a45);
  const mossMat = makeGroundMat(0x718c54);
  const pebbleMat = makeGroundMat(0x757067);
  const flagstoneMat = makeGroundMat(0x9c9588);

  const geometries: THREE.BufferGeometry[] = [groundSlabGeo, subSlabGeo];
  const materials: THREE.Material[] = [
    groundMainMat,
    groundSubSoilMat,
    grassMat,
    mossMat,
    pebbleMat,
    flagstoneMat
  ];

  // Path flagstones leading from front door (+Z) out into the courtyard
  const pathCoords: [number, number, number, number][] = [
    [0.0, 2.3, 1.1, 0.8],
    [0.15, 3.3, 1.0, 0.75],
    [-0.1, 4.25, 0.95, 0.7],
    [0.2, 5.15, 0.85, 0.65],
    [-1.4, 3.6, 0.75, 0.65],
    [-2.4, 3.1, 0.8, 0.7]
  ];
  pathCoords.forEach(([x, z, w, d]) => {
    const geo = new THREE.BoxGeometry(w, 0.06, d);
    geometries.push(geo);
    const stone = new THREE.Mesh(geo, flagstoneMat);
    stone.position.set(x, 0.03, z);
    stone.receiveShadow = true;
    groundGroup.add(stone);
  });

  // Scatter voxel grass blades & pebbles around the island perimeter
  const scatterRng = createSeededRandom(999);
  for (let i = 0; i < 85; i++) {
    const angle = scatterRng() * Math.PI * 2;
    const radius = 2.6 + scatterRng() * 5.2;
    const gx = Math.cos(angle) * radius;
    const gz = Math.sin(angle) * radius;
    // Don't place inside the shack footprint
    if (Math.abs(gx) < 2.5 && Math.abs(gz) < 2.2) continue;

    if (scatterRng() > 0.35) {
      // Voxel grass tuft (2-3 tiny blades)
      const h = 0.14 + scatterRng() * 0.22;
      const geo = new THREE.BoxGeometry(0.12, h, 0.12);
      geometries.push(geo);
      const blade = new THREE.Mesh(
        geo,
        scatterRng() > 0.5 ? grassMat : mossMat
      );
      blade.position.set(gx, h * 0.5, gz);
      blade.castShadow = true;
      blade.receiveShadow = true;
      groundGroup.add(blade);
    } else {
      // Voxel pebble
      const s = 0.12 + scatterRng() * 0.14;
      const geo = new THREE.BoxGeometry(s * 1.2, s * 0.6, s);
      geometries.push(geo);
      const pebble = new THREE.Mesh(geo, pebbleMat);
      pebble.position.set(gx, s * 0.3, gz);
      pebble.receiveShadow = true;
      groundGroup.add(pebble);
    }
  }

  return {
    groundGroup,
    dispose() {
      geometries.forEach((g) => g.dispose());
      materials.forEach((m) => {
        (m.userData.customDepthMaterial as THREE.Material | undefined)?.dispose();
        m.dispose();
      });
    }
  };
}
