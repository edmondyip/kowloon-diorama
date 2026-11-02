import * as THREE from 'three';

// Disable modern Three.js (r152+) automatic sRGB->linear color management so hex colors
// and procedural canvas textures match Three.js r128 legacy gamma/sRGB behavior.
THREE.ColorManagement.enabled = false;

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
