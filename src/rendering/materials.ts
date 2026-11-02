import * as THREE from 'three';
import { AppConfig } from '../core/config';
import { makePixelCanvasTexture, TextureSet } from './textures';

export interface CelMaterialOptions {
  color?: THREE.ColorRepresentation;
  map?: THREE.Texture | null;
  emissive?: THREE.ColorRepresentation;
  emissiveMap?: THREE.Texture | null;
  emissiveIntensity?: number;
}

export function createToonGradientTexture(): THREE.CanvasTexture {
  // Helper to create 4-step Toon gradient map so all materials have crisp cel-shaded lighting bands
  return makePixelCanvasTexture(4, 1, (ctx) => {
    ctx.fillStyle = '#555555'; ctx.fillRect(0, 0, 1, 1);
    ctx.fillStyle = '#888888'; ctx.fillRect(1, 0, 1, 1);
    ctx.fillStyle = '#c4c4c4'; ctx.fillRect(2, 0, 1, 1);
    ctx.fillStyle = '#ffffff'; ctx.fillRect(3, 0, 1, 1);
  });
}

export function makeCelMaterial(
  toonGradientTex: THREE.Texture,
  options: CelMaterialOptions = {}
): THREE.MeshToonMaterial {
  const mat = new THREE.MeshToonMaterial({
    color: options.color !== undefined ? options.color : 0xffffff,
    map: options.map || null,
    gradientMap: toonGradientTex,
    emissive: options.emissive !== undefined ? new THREE.Color(options.emissive) : new THREE.Color(0x000000),
    emissiveMap: options.emissiveMap || null,
    emissiveIntensity: options.emissiveIntensity !== undefined ? options.emissiveIntensity : 0.0
  });
  return mat;
}

// ============================================================================
// "STARI MOST" GROUND-ONLY RADIAL BAYER 4x4 DITHERED EDGE FADE
// ============================================================================
// Inject world-space radial 4x4 Bayer dither discard ONLY into ground materials!
export function applyGroundRadialBayerDither<T extends THREE.Material>(
  material: T,
  config: AppConfig
): T {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uInnerRadius = { value: config.islandInnerRadius };
    shader.uniforms.uOuterRadius = { value: config.islandOuterRadius };

    shader.vertexShader = shader.vertexShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vGroundWorldPos;`
    );
    shader.vertexShader = shader.vertexShader.replace(
      '#include <worldpos_vertex>',
      `#include <worldpos_vertex>
       vGroundWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
       varying vec3 vGroundWorldPos;
       uniform float uInnerRadius;
       uniform float uOuterRadius;

       // Classic 4x4 Bayer threshold matrix in [0, 1)
       float bayer4x4(vec2 pos) {
         int x = int(mod(pos.x, 4.0));
         int y = int(mod(pos.y, 4.0));
         int index = x + y * 4;
         if (index == 0)  return  0.0 / 16.0;
         if (index == 1)  return  8.0 / 16.0;
         if (index == 2)  return  2.0 / 16.0;
         if (index == 3)  return 10.0 / 16.0;
         if (index == 4)  return 12.0 / 16.0;
         if (index == 5)  return  4.0 / 16.0;
         if (index == 6)  return 14.0 / 16.0;
         if (index == 7)  return  6.0 / 16.0;
         if (index == 8)  return  3.0 / 16.0;
         if (index == 9)  return 11.0 / 16.0;
         if (index == 10) return  1.0 / 16.0;
         if (index == 11) return  9.0 / 16.0;
         if (index == 12) return 15.0 / 16.0;
         if (index == 13) return  7.0 / 16.0;
         if (index == 14) return 13.0 / 16.0;
         return 5.0 / 16.0;
       }`
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <dithering_fragment>',
      `#include <dithering_fragment>
       // Quantize world XZ to crisp pixel-grid cells (8 sub-cells per world unit)
       vec2 gridXZ = floor(vGroundWorldPos.xz * 8.0);
       float angle = atan(vGroundWorldPos.z, vGroundWorldPos.x);
       float organicWobble = sin(angle * 5.0) * 0.28 + cos(angle * 3.0) * 0.22;
       float radialDist = length(vGroundWorldPos.xz) + organicWobble;
       float fadeFactor = 1.0 - smoothstep(uInnerRadius, uOuterRadius, radialDist);

       // Screen-space & world-grid hybrid Bayer 4x4 stipple discard
       float threshold = bayer4x4(gl_FragCoord.xy);
       if (fadeFactor <= threshold + 0.02) {
         discard;
       }`
    );
  };
  // Ensure custom depth material for shadows also clips identically
  const customDepthMat = new THREE.MeshDepthMaterial({
    depthPacking: THREE.RGBADepthPacking
  });
  customDepthMat.onBeforeCompile = material.onBeforeCompile;
  material.userData.customDepthMaterial = customDepthMat;
  return material;
}

export interface ShackMaterialSet {
  toonGradientTex: THREE.CanvasTexture;
  woodWall: THREE.MeshToonMaterial;
  woodDark: THREE.MeshToonMaterial;
  woodBeam: THREE.MeshToonMaterial;
  woodLight: THREE.MeshToonMaterial;
  floor1F: THREE.MeshToonMaterial;
  floor2F: THREE.MeshToonMaterial;
  concrete: THREE.MeshToonMaterial;
  tinWall: THREE.MeshToonMaterial;
  tinRoof: THREE.MeshToonMaterial;
  rustMetal: THREE.MeshToonMaterial;
  darkMetal: THREE.MeshToonMaterial;
  pipeMetal: THREE.MeshToonMaterial;
  copperPipe: THREE.MeshToonMaterial;
  redCrate: THREE.MeshToonMaterial;
  blueTarp: THREE.MeshToonMaterial;
  bamboo: THREE.MeshToonMaterial;
  quilt: THREE.MeshToonMaterial;
  pillow: THREE.MeshToonMaterial;
  stoveFire: THREE.MeshBasicMaterial;
  windowGlass: THREE.MeshToonMaterial;
  neonSign: THREE.MeshToonMaterial;
  lanternBulb: THREE.MeshBasicMaterial;
  acUnit: THREE.MeshToonMaterial;
  foliage: THREE.MeshToonMaterial;
  terracotta: THREE.MeshToonMaterial;
  laundryWhite: THREE.MeshToonMaterial;
  laundryYellow: THREE.MeshToonMaterial;
  dispose: () => void;
}

export function createShackMaterials(
  textures: TextureSet,
  toonGradientTex = createToonGradientTexture()
): ShackMaterialSet {
  const makeCel = (opts?: CelMaterialOptions) => makeCelMaterial(toonGradientTex, opts);

  const materials = {
    woodWall: makeCel({ map: textures.woodPlanks, color: 0xd8c6b0 }),
    woodDark: makeCel({ color: 0x4f3624 }),
    woodBeam: makeCel({ color: 0x61422c }),
    woodLight: makeCel({ color: 0xb88b5e }),
    floor1F: makeCel({ map: textures.interiorFloor, color: 0xd4be9e }),
    floor2F: makeCel({ map: textures.interiorFloor, color: 0xc9b08e }),
    concrete: makeCel({ map: textures.concreteWall, color: 0xd2ccc0 }),
    tinWall: makeCel({ map: textures.patchedWallTin, color: 0xd0dedc }),
    tinRoof: makeCel({ map: textures.corrugatedTin, color: 0xc8d2d6 }),
    rustMetal: makeCel({ color: 0x7d4430 }),
    darkMetal: makeCel({ color: 0x363b3e }),
    pipeMetal: makeCel({ color: 0x677278 }),
    copperPipe: makeCel({ color: 0xb36a42 }),
    redCrate: makeCel({ color: 0xc23b2b }),
    blueTarp: makeCel({ color: 0x2f6999 }),
    bamboo: makeCel({ color: 0xb89d58 }),
    quilt: makeCel({ map: textures.quilt }),
    pillow: makeCel({ color: 0xeee8dc }),
    stoveFire: new THREE.MeshBasicMaterial({ color: 0xff6b2b }),
    windowGlass: makeCel({
      map: textures.windowPane,
      emissive: 0xffaa44,
      emissiveMap: textures.windowPane,
      emissiveIntensity: 0.15
    }),
    neonSign: makeCel({
      map: textures.neonSign,
      emissive: 0xffffff,
      emissiveMap: textures.neonSign,
      emissiveIntensity: 0.35
    }),
    lanternBulb: new THREE.MeshBasicMaterial({ color: 0xffd27d }),
    acUnit: makeCel({ map: textures.acUnit }),
    foliage: makeCel({ color: 0x4d7c3e }),
    terracotta: makeCel({ color: 0xa8553a }),
    laundryWhite: makeCel({ color: 0xeae6df }),
    laundryYellow: makeCel({ color: 0xe0b956 })
  };

  return {
    toonGradientTex,
    ...materials,
    dispose() {
      Object.values(materials).forEach((m) => m.dispose());
      toonGradientTex.dispose();
    }
  };
}
