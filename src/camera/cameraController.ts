import * as THREE from 'three';
import { AppConfig, SliceMode } from '../core/config';
import { FloorTag } from '../buildings/prototypeShack';

export interface CameraState {
  yaw: number;
  pitch: number;
  distance: number;
  zoom: number;
  targetZoom: number;
  target: THREE.Vector3;
  desiredTarget: THREE.Vector3;
  isDragging: boolean;
  dragStart: THREE.Vector2;
  pointerDownPos: THREE.Vector2;
  dragMoved: boolean;
}

export interface CameraControllerCallbacks {
  onHoverFloorChange: (hoveredFloor: FloorTag | null, clientX: number, clientY: number) => void;
  onFloorClick: (clickedFloor: FloorTag | null) => void;
  onDragStart: () => void;
}

export interface CameraController {
  camera: THREE.OrthographicCamera;
  camState: CameraState;
  updateCameraTransform: () => void;
  updateSmoothCamera: (dt: number) => void;
  applySliceCameraTarget: (mode: SliceMode) => void;
  getHoveredFloor: (clientX: number, clientY: number) => FloorTag | null;
  handleResize: (viewportWidth?: number, viewportHeight?: number) => void;
  bindEvents: (
    container: HTMLElement,
    pickableMeshes: THREE.Mesh[],
    floorGroup2: THREE.Object3D,
    callbacks: CameraControllerCallbacks
  ) => void;
  dispose: () => void;
}

export function createInitialCameraState(): CameraState {
  return {
    yaw: Math.PI * 0.25,          // Classic 45° isometric yaw
    pitch: Math.atan(1 / Math.sqrt(2)), // True isometric ~35.264° pitch
    distance: 36,
    zoom: 1.22,
    targetZoom: 1.22,
    target: new THREE.Vector3(0, 1.8, 0),
    desiredTarget: new THREE.Vector3(0, 1.8, 0),
    isDragging: false,
    dragStart: new THREE.Vector2(),
    pointerDownPos: new THREE.Vector2(),
    dragMoved: false
  };
}

export function createCameraController(
  config: AppConfig,
  initialWidth = window.innerWidth,
  initialHeight = window.innerHeight
): CameraController {
  const aspect = initialWidth / initialHeight;
  const camera = new THREE.OrthographicCamera(
    -config.baseFrustum * aspect,
    config.baseFrustum * aspect,
    config.baseFrustum,
    -config.baseFrustum,
    0.1,
    120
  );

  const camState = createInitialCameraState();

  function updateCameraTransform(): void {
    const cosPitch = Math.cos(camState.pitch);
    const sinPitch = Math.sin(camState.pitch);
    const cosYaw = Math.cos(camState.yaw);
    const sinYaw = Math.sin(camState.yaw);

    camera.position.set(
      camState.target.x + camState.distance * cosPitch * sinYaw,
      camState.target.y + camState.distance * sinPitch,
      camState.target.z + camState.distance * cosPitch * cosYaw
    );
    camera.lookAt(camState.target);
    camera.zoom = camState.zoom;
    camera.updateProjectionMatrix();
  }

  updateCameraTransform();

  function updateSmoothCamera(dt: number): void {
    camState.target.lerp(camState.desiredTarget, Math.min(1.0, dt * 9.0));
    camState.zoom += (camState.targetZoom - camState.zoom) * Math.min(1.0, dt * 9.0);
    updateCameraTransform();
  }

  function applySliceCameraTarget(mode: SliceMode): void {
    if (mode === '1') {
      camState.desiredTarget.set(0.0, 1.05, 0.0);
      camState.targetZoom = Math.max(camState.targetZoom, 1.68);
    } else if (mode === '2') {
      camState.desiredTarget.set(0.0, 3.15, 0.0);
      camState.targetZoom = Math.max(camState.targetZoom, 1.62);
    } else {
      camState.desiredTarget.set(0.0, 1.85, 0.0);
      camState.targetZoom = 1.22;
    }
  }

  function handleResize(
    viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight
  ): void {
    const newAspect = viewportWidth / viewportHeight;
    camera.left = -config.baseFrustum * newAspect;
    camera.right = config.baseFrustum * newAspect;
    camera.top = config.baseFrustum;
    camera.bottom = -config.baseFrustum;
    camera.updateProjectionMatrix();
  }

  const raycaster = new THREE.Raycaster();
  const pointerNDC = new THREE.Vector2();
  let boundPickableMeshes: THREE.Mesh[] = [];
  let boundFloorGroup2: THREE.Object3D | null = null;
  let cleanupListeners: (() => void) | null = null;

  function updatePointerNDC(clientX: number, clientY: number): void {
    pointerNDC.x = (clientX / window.innerWidth) * 2 - 1;
    pointerNDC.y = -(clientY / window.innerHeight) * 2 + 1;
  }

  function getHoveredFloor(clientX: number, clientY: number): FloorTag | null {
    updatePointerNDC(clientX, clientY);
    raycaster.setFromCamera(pointerNDC, camera);
    const hits = raycaster.intersectObjects(boundPickableMeshes, false);
    for (let i = 0; i < hits.length; i++) {
      const obj = hits[i].object;
      const floorTag = obj.userData.floorTag as FloorTag | undefined;
      // Ignore hidden floor groups
      if (floorTag === 2 && boundFloorGroup2 && !boundFloorGroup2.visible) continue;
      if (floorTag) {
        return floorTag;
      }
    }
    return null;
  }

  function bindEvents(
    container: HTMLElement,
    pickableMeshes: THREE.Mesh[],
    floorGroup2: THREE.Object3D,
    callbacks: CameraControllerCallbacks
  ): void {
    if (cleanupListeners) {
      cleanupListeners();
    }
    boundPickableMeshes = pickableMeshes;
    boundFloorGroup2 = floorGroup2;

    const onPointerDown = (e: PointerEvent): void => {
      if (e.button !== 0) return;
      camState.isDragging = true;
      camState.dragMoved = false;
      camState.dragStart.set(e.clientX, e.clientY);
      camState.pointerDownPos.set(e.clientX, e.clientY);
    };

    const onPointerMove = (e: PointerEvent): void => {
      if (camState.isDragging) {
        const dx = e.clientX - camState.dragStart.x;
        const dy = e.clientY - camState.dragStart.y;
        if (Math.hypot(e.clientX - camState.pointerDownPos.x, e.clientY - camState.pointerDownPos.y) > 5) {
          camState.dragMoved = true;
        }
        camState.yaw -= dx * 0.0075;
        camState.pitch = Math.max(0.22, Math.min(1.18, camState.pitch + dy * 0.0055));
        camState.dragStart.set(e.clientX, e.clientY);
        callbacks.onDragStart();
        return;
      }

      const hoveredFloorTag = getHoveredFloor(e.clientX, e.clientY);
      callbacks.onHoverFloorChange(hoveredFloorTag, e.clientX, e.clientY);
    };

    const onPointerUp = (e: PointerEvent): void => {
      if (!camState.isDragging) return;
      camState.isDragging = false;

      // If it was a clean click (not an orbit drag), check floor raycast!
      if (!camState.dragMoved) {
        const clickedFloor = getHoveredFloor(e.clientX, e.clientY);
        callbacks.onFloorClick(clickedFloor);
      }
    };

    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      const zoomFactor = e.deltaY > 0 ? 0.90 : 1.11;
      camState.targetZoom = Math.max(0.68, Math.min(3.2, camState.targetZoom * zoomFactor));
    };

    container.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    container.addEventListener('wheel', onWheel, { passive: false });

    cleanupListeners = () => {
      container.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      container.removeEventListener('wheel', onWheel);
    };
  }

  return {
    camera,
    camState,
    updateCameraTransform,
    updateSmoothCamera,
    applySliceCameraTarget,
    getHoveredFloor,
    handleResize,
    bindEvents,
    dispose() {
      if (cleanupListeners) {
        cleanupListeners();
        cleanupListeners = null;
      }
    }
  };
}
