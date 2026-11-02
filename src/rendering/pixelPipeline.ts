import * as THREE from 'three';
import { AppConfig } from '../core/config';

export interface RenderTargetDimensions {
  w: number;
  h: number;
}

export function getRenderTargetDimensions(
  pixelScale: number,
  viewportWidth = window.innerWidth,
  viewportHeight = window.innerHeight
): RenderTargetDimensions {
  const w = Math.max(64, Math.floor(viewportWidth / pixelScale));
  const h = Math.max(64, Math.floor(viewportHeight / pixelScale));
  return { w, h };
}

export interface PixelPipeline {
  readonly colorTarget: THREE.WebGLRenderTarget;
  readonly normalTarget: THREE.WebGLRenderTarget;
  readonly normalOverrideMaterial: THREE.MeshNormalMaterial;
  readonly postScene: THREE.Scene;
  readonly postCamera: THREE.OrthographicCamera;
  readonly postQuadMaterial: THREE.ShaderMaterial;
  readonly postQuad: THREE.Mesh;
  initRenderTargets: (viewportWidth?: number, viewportHeight?: number) => RenderTargetDimensions;
  setNightMode: (isNight: boolean) => void;
  render: (
    renderer: THREE.WebGLRenderer,
    scene: THREE.Scene,
    camera: THREE.Camera,
    groundGroup: THREE.Object3D
  ) => void;
  dispose: () => void;
}

export function createPixelPipeline(
  config: AppConfig,
  camera: THREE.OrthographicCamera,
  initialWidth = window.innerWidth,
  initialHeight = window.innerHeight
): PixelPipeline {
  let colorTarget: THREE.WebGLRenderTarget | null = null;
  let normalTarget: THREE.WebGLRenderTarget | null = null;
  const normalOverrideMaterial = new THREE.MeshNormalMaterial();

  const postScene = new THREE.Scene();
  const postCamera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);

  const postQuadMaterial = new THREE.ShaderMaterial({
    uniforms: {
      tColor: { value: null },
      tDepth: { value: null },
      tNormal: { value: null },
      uResolution: { value: new THREE.Vector2(320, 240) },
      uNear: { value: camera.near },
      uFar: { value: camera.far },
      uNightMode: { value: 0.0 }
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = vec4(position.xy, 0.0, 1.0);
      }
    `,
    fragmentShader: `
      precision highp float;
      uniform sampler2D tColor;
      uniform sampler2D tDepth;
      uniform sampler2D tNormal;
      uniform vec2 uResolution;
      uniform float uNear;
      uniform float uFar;
      uniform float uNightMode;
      varying vec2 vUv;

      float getLinearDepth(vec2 coord) {
        float z = texture2D(tDepth, coord).x;
        // Ortho camera depth is already linear in [0, 1]
        return mix(uNear, uFar, z);
      }

      void main() {
        vec2 texel = 1.0 / uResolution;
        vec4 baseCol = texture2D(tColor, vUv);

        float dCenter = getLinearDepth(vUv);
        float dLeft   = getLinearDepth(vUv + vec2(-texel.x, 0.0));
        float dRight  = getLinearDepth(vUv + vec2( texel.x, 0.0));
        float dUp     = getLinearDepth(vUv + vec2(0.0,  texel.y));
        float dDown   = getLinearDepth(vUv + vec2(0.0, -texel.y));

        // Only draw depth outline if current pixel is closer than neighbor (external silhouette crispness)
        float depthDiff = 0.0;
        depthDiff = max(depthDiff, dLeft  - dCenter);
        depthDiff = max(depthDiff, dRight - dCenter);
        depthDiff = max(depthDiff, dUp    - dCenter);
        depthDiff = max(depthDiff, dDown  - dCenter);

        vec3 nCenter = texture2D(tNormal, vUv).xyz * 2.0 - 1.0;
        vec3 nRight  = texture2D(tNormal, vUv + vec2(texel.x, 0.0)).xyz * 2.0 - 1.0;
        vec3 nUp     = texture2D(tNormal, vUv + vec2(0.0, texel.y)).xyz * 2.0 - 1.0;

        float normDiff = max(distance(nCenter, nRight), distance(nCenter, nUp));

        // Ignore background sky pixels
        bool isBackground = (texture2D(tDepth, vUv).x > 0.999);
        // Only apply dark 1px silhouette/crease outlines to 3D structures & resident (alpha > 0.5 in normalTarget),
        // keeping the Stari Most radial Bayer 4x4 ground dither completely clean as it dissolves into the paper background!
        bool isStructureOrAgent = (texture2D(tNormal, vUv).a > 0.5);

        float depthEdge = step(0.55, depthDiff);
        float normalEdge = step(0.42, normDiff) * (1.0 - step(0.25, abs(dRight - dCenter) + abs(dUp - dCenter)));

        vec3 col = baseCol.rgb;

        if (!isBackground) {
          // Subtle 16-bit palette quantization
          col = floor(col * 28.0 + 0.5) / 28.0;

          // Apply 1px dark outline on depth silhouettes and crease edges of structures & resident
          if (isStructureOrAgent) {
            if (depthEdge > 0.5) {
              vec3 outlineCol = mix(vec3(0.14, 0.12, 0.10), vec3(0.03, 0.04, 0.06), uNightMode);
              col = mix(col, outlineCol, 0.82);
            } else if (normalEdge > 0.5) {
              col *= 0.78;
            }
          }
        }

        gl_FragColor = vec4(col, 1.0);
      }
    `,
    depthWrite: false,
    depthTest: false
  });

  const postQuadGeo = new THREE.PlaneGeometry(2, 2);
  const postQuad = new THREE.Mesh(postQuadGeo, postQuadMaterial);
  postScene.add(postQuad);

  function initRenderTargets(
    viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight
  ): RenderTargetDimensions {
    const { w, h } = getRenderTargetDimensions(config.pixelScale, viewportWidth, viewportHeight);
    if (colorTarget) {
      colorTarget.depthTexture?.dispose();
      colorTarget.dispose();
    }
    if (normalTarget) {
      normalTarget.dispose();
    }

    const depthTexture = new THREE.DepthTexture(w, h);
    depthTexture.type = THREE.UnsignedShortType;
    depthTexture.minFilter = THREE.NearestFilter;
    depthTexture.magFilter = THREE.NearestFilter;

    colorTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthTexture: depthTexture,
      depthBuffer: true,
      stencilBuffer: false
    });

    normalTarget = new THREE.WebGLRenderTarget(w, h, {
      minFilter: THREE.NearestFilter,
      magFilter: THREE.NearestFilter,
      format: THREE.RGBAFormat,
      depthBuffer: true,
      stencilBuffer: false
    });

    postQuadMaterial.uniforms.tColor.value = colorTarget.texture;
    postQuadMaterial.uniforms.tDepth.value = colorTarget.depthTexture;
    postQuadMaterial.uniforms.tNormal.value = normalTarget.texture;
    (postQuadMaterial.uniforms.uResolution.value as THREE.Vector2).set(w, h);

    return { w, h };
  }

  initRenderTargets(initialWidth, initialHeight);

  return {
    get colorTarget(): THREE.WebGLRenderTarget {
      return colorTarget!;
    },
    get normalTarget(): THREE.WebGLRenderTarget {
      return normalTarget!;
    },
    normalOverrideMaterial,
    postScene,
    postCamera,
    postQuadMaterial,
    postQuad,
    initRenderTargets,
    setNightMode(isNight: boolean) {
      postQuadMaterial.uniforms.uNightMode.value = isNight ? 1.0 : 0.0;
    },
    render(
      renderer: THREE.WebGLRenderer,
      scene: THREE.Scene,
      cam: THREE.Camera,
      groundGroup: THREE.Object3D
    ) {
      // Pass 1: Render low-res Color + Depth into `colorTarget`
      renderer.setRenderTarget(colorTarget);
      renderer.clear();
      renderer.render(scene, cam);

      // Pass 2: Render low-res Normals into `normalTarget` for 1px normal/crease outlines on shack & resident
      const prevBg = scene.background;
      scene.background = null;
      groundGroup.visible = false;
      scene.overrideMaterial = normalOverrideMaterial;
      renderer.setRenderTarget(normalTarget);
      renderer.setClearColor(0x000000, 0.0);
      renderer.clear();
      renderer.render(scene, cam);
      scene.overrideMaterial = null;
      groundGroup.visible = true;
      scene.background = prevBg;
      if (prevBg instanceof THREE.Color) {
        renderer.setClearColor(prevBg, 1.0);
      }

      // Pass 3: Composite low-res render target + 1px pixel-art outlines onto fullscreen quad
      renderer.setRenderTarget(null);
      renderer.render(postScene, postCamera);
    },
    dispose() {
      if (colorTarget) {
        colorTarget.depthTexture?.dispose();
        colorTarget.dispose();
      }
      if (normalTarget) {
        normalTarget.dispose();
      }
      normalOverrideMaterial.dispose();
      postQuadMaterial.dispose();
      postQuadGeo.dispose();
    }
  };
}
