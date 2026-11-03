import * as THREE from 'three';

// Disable modern Three.js (r152+) automatic sRGB->linear color management so hex colors
// and procedural canvas textures match Three.js r128 legacy gamma/sRGB behavior.
THREE.ColorManagement.enabled = false;

// Restore Three.js r128 legacy non-physical lighting (renderer.physicallyCorrectLights = false)
// removed in Three.js r155–r165:
// 1. In r128 WebGLLights, all light intensities were multiplied by Math.PI (canceling out the
//    1/PI factor in BRDF_Lambert so MeshToonMaterial colors were not dimmed by 3.14159x).
// 2. In r128 punctualLightIntensityToIrradianceFactor, PointLight attenuation used normalized
//    range falloff `pow(saturate(-lightDistance / cutoffDistance + 1.0), decayExponent)` rather
//    than physical inverse-power `1.0 / max(pow(lightDistance, decayExponent), 0.01)`.
let legacyLightingPatched = false;
export function ensureLegacyR128LightingShaders(): void {
  if (legacyLightingPatched) return;
  legacyLightingPatched = true;

  THREE.ShaderChunk.lights_toon_pars_fragment =
    THREE.ShaderChunk.lights_toon_pars_fragment
      .replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        'reflectedLight.directDiffuse += irradiance * material.diffuseColor;'
      )
      .replace(
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        'reflectedLight.indirectDiffuse += irradiance * material.diffuseColor;'
      );

  THREE.ShaderChunk.lights_pars_begin = THREE.ShaderChunk.lights_pars_begin.replace(
    `float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
\tfloat distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
\tif ( cutoffDistance > 0.0 ) {
\t\tdistanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
\t}
\treturn distanceFalloff;
}`,
    `float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
\tif ( cutoffDistance > 0.0 && decayExponent > 0.0 ) {
\t\treturn pow( saturate( - lightDistance / cutoffDistance + 1.0 ), decayExponent );
\t}
\treturn 1.0;
}`
  );
}
ensureLegacyR128LightingShaders();

export type ThemeMode = 'day' | 'night';
export type SliceMode = 'all' | '1' | '2';
export type PixelScale = 1 | 2 | 3;
export type SimSpeed = 1 | 2;

export interface AppConfig {
  pixelScale: number;
  theme: ThemeMode;
  sliceMode: SliceMode;
  simSpeed: number;
  dayBg: THREE.Color;
  nightBg: THREE.Color;
  islandInnerRadius: number;
  islandOuterRadius: number;
  baseFrustum: number;
}

export function createDefaultConfig(): AppConfig {
  return {
    pixelScale: 2,           // 1, 2, or 3 screen pixels per render-target pixel
    theme: 'day',            // 'day' (#f4f3ef) | 'night' (#0f1216)
    sliceMode: 'all',        // 'all' | '1' | '2'
    simSpeed: 1,             // 1 or 2
    dayBg: new THREE.Color(0xf4f3ef),
    nightBg: new THREE.Color(0x0f1216),
    islandInnerRadius: 5.0,  // Full opacity inside this radius
    islandOuterRadius: 8.3,  // Fully dissolved outside this radius
    baseFrustum: 13.5
  };
}
