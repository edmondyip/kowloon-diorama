import * as THREE from 'three';

export interface RendererBundle {
  renderer: THREE.WebGLRenderer;
  dispose: () => void;
}

export function createRenderer(
  container: HTMLElement,
  width = window.innerWidth,
  height = window.innerHeight
): RendererBundle {
  const renderer = new THREE.WebGLRenderer({
    antialias: false,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(1); // Crucial: 1:1 CSS pixel buffer so low-res upscale stays razor sharp
  renderer.setSize(width, height);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.BasicShadowMap; // Crisp pixel shadows!
  container.appendChild(renderer.domElement);

  return {
    renderer,
    dispose() {
      renderer.dispose();
      if (renderer.domElement.parentNode === container) {
        container.removeChild(renderer.domElement);
      }
    }
  };
}
