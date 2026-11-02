import * as THREE from 'three';

export interface SceneLights {
  ambientLight: THREE.AmbientLight;
  dirLight: THREE.DirectionalLight;
  fillLight: THREE.DirectionalLight;
  stoveLight1F: THREE.PointLight;
  lanternLight2F: THREE.PointLight;
  neonGlowLight: THREE.PointLight;
  dispose: () => void;
}

export function createLighting(scene: THREE.Scene): SceneLights {
  const ambientLight = new THREE.AmbientLight(0xfff4e0, 0.72);
  scene.add(ambientLight);

  const dirLight = new THREE.DirectionalLight(0xfff2d6, 0.92);
  dirLight.position.set(14, 24, 16);
  dirLight.castShadow = true;
  dirLight.shadow.mapSize.width = 512;
  dirLight.shadow.mapSize.height = 512;
  dirLight.shadow.camera.near = 1;
  dirLight.shadow.camera.far = 60;
  const shadowCamSize = 11;
  dirLight.shadow.camera.left = -shadowCamSize;
  dirLight.shadow.camera.right = shadowCamSize;
  dirLight.shadow.camera.top = shadowCamSize;
  dirLight.shadow.camera.bottom = -shadowCamSize;
  dirLight.shadow.bias = -0.0015;
  scene.add(dirLight);

  // Subtle fill light from opposite angle
  const fillLight = new THREE.DirectionalLight(0x9cb8d9, 0.28);
  fillLight.position.set(-14, 10, -12);
  scene.add(fillLight);

  // Warm interior point lights (for 1F stove/workbench & 2F room glow)
  // Note: decay = 1 preserves Three.js r128 legacy non-physical point-light falloff
  const stoveLight1F = new THREE.PointLight(0xff9240, 0.8, 6.5, 1);
  stoveLight1F.position.set(-0.9, 1.3, -0.6);
  scene.add(stoveLight1F);

  const lanternLight2F = new THREE.PointLight(0xffb85c, 0.6, 6.5, 1);
  lanternLight2F.position.set(0.2, 3.8, 0.0);
  scene.add(lanternLight2F);

  const neonGlowLight = new THREE.PointLight(0xff477e, 0.0, 5.5, 1);
  neonGlowLight.position.set(2.5, 3.6, 1.4);
  scene.add(neonGlowLight);

  return {
    ambientLight,
    dirLight,
    fillLight,
    stoveLight1F,
    lanternLight2F,
    neonGlowLight,
    dispose() {
      dirLight.shadow.map?.dispose();
    }
  };
}
