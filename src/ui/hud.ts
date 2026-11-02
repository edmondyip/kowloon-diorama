import * as THREE from 'three';
import { SliceMode, ThemeMode } from '../core/config';
import { FloorTag } from '../buildings/prototypeShack';
import { AgentStepResult } from '../residents/prototypeResident';

export interface HudElements {
  container: HTMLElement;
  domStateCode: HTMLElement | null;
  domStateDesc: HTMLElement | null;
  domStateProgress: HTMLElement | null;
  domSliceReadout: HTMLElement | null;
  domHoverStatus: HTMLElement | null;
  domBubble: HTMLElement | null;
  domBubbleIcon: HTMLElement | null;
  domBubbleText: HTMLElement | null;
  domFloorTooltip: HTMLElement | null;
}

export interface HudActionHandlers {
  onSliceMode: (mode: SliceMode) => void;
  onPixelScale: (scale: number) => void;
  onTheme: (theme: ThemeMode) => void;
  onSimSpeed: (speed: number) => void;
}

export interface HudController {
  elements: HudElements;
  updateSliceUI: (mode: SliceMode) => void;
  updatePixelScaleUI: (scale: number) => void;
  updateThemeUI: (theme: ThemeMode) => void;
  updateSimSpeedUI: (speed: number) => void;
  updateHoverFloorUI: (hoveredFloorTag: FloorTag | null, sliceMode: SliceMode, clientX: number, clientY: number) => void;
  hideTooltip: () => void;
  updateAgentHud: (
    stepResult: AgentStepResult,
    agentPos: THREE.Vector3,
    camera: THREE.Camera,
    viewportWidth?: number,
    viewportHeight?: number
  ) => void;
  bindButtons: (handlers: HudActionHandlers) => void;
  dispose: () => void;
}

const tempVec3 = new THREE.Vector3();

export function createHudController(
  container: HTMLElement,
  doc: Document = document
): HudController {
  const elements: HudElements = {
    container,
    domStateCode: doc.getElementById('state-code'),
    domStateDesc: doc.getElementById('state-desc'),
    domStateProgress: doc.getElementById('state-progress'),
    domSliceReadout: doc.getElementById('slice-readout'),
    domHoverStatus: doc.getElementById('hover-status'),
    domBubble: doc.getElementById('resident-bubble'),
    domBubbleIcon: doc.getElementById('bubble-icon'),
    domBubbleText: doc.getElementById('bubble-text'),
    domFloorTooltip: doc.getElementById('floor-tooltip')
  };

  const buttonCleanups: (() => void)[] = [];

  function updateSliceUI(mode: SliceMode): void {
    doc.querySelectorAll('[data-slice]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-slice') === mode);
    });
    if (elements.domSliceReadout) {
      if (mode === '1') {
        elements.domSliceReadout.textContent = 'SLICE: 1F INTERIOR';
      } else if (mode === '2') {
        elements.domSliceReadout.textContent = 'SLICE: 2F LOFT';
      } else {
        elements.domSliceReadout.textContent = 'VIEW: ALL FLOORS';
      }
    }
  }

  function updatePixelScaleUI(scale: number): void {
    doc.querySelectorAll('[data-pixel]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.getAttribute('data-pixel')) === scale);
    });
  }

  function updateThemeUI(theme: ThemeMode): void {
    const isNight = theme === 'night';
    doc.body.classList.toggle('night-mode', isNight);
    doc.querySelectorAll('[data-theme]').forEach((btn) => {
      btn.classList.toggle('active', btn.getAttribute('data-theme') === theme);
    });
  }

  function updateSimSpeedUI(speed: number): void {
    doc.querySelectorAll('[data-speed]').forEach((btn) => {
      btn.classList.toggle('active', Number(btn.getAttribute('data-speed')) === speed);
    });
  }

  function hideTooltip(): void {
    if (elements.domFloorTooltip) {
      elements.domFloorTooltip.style.opacity = '0';
    }
  }

  function updateHoverFloorUI(
    hoveredFloorTag: FloorTag | null,
    sliceMode: SliceMode,
    clientX: number,
    clientY: number
  ): void {
    if (hoveredFloorTag) {
      container.classList.add('hovering-floor');
      if (elements.domHoverStatus) {
        elements.domHoverStatus.textContent = `[HOVER: ${hoveredFloorTag}F]`;
      }
      if (elements.domFloorTooltip) {
        elements.domFloorTooltip.textContent =
          sliceMode === String(hoveredFloorTag)
            ? `${hoveredFloorTag}F SLICED (CLICK GROUND TO RESET)`
            : `CLICK TO SLICE ${hoveredFloorTag}F`;
        elements.domFloorTooltip.style.left = `${clientX}px`;
        elements.domFloorTooltip.style.top = `${clientY}px`;
        elements.domFloorTooltip.style.opacity = '1';
      }
    } else {
      container.classList.remove('hovering-floor');
      if (elements.domHoverStatus) {
        elements.domHoverStatus.textContent = '';
      }
      if (elements.domFloorTooltip) {
        elements.domFloorTooltip.style.opacity = '0';
      }
    }
  }

  function updateAgentHud(
    stepResult: AgentStepResult,
    agentPos: THREE.Vector3,
    camera: THREE.Camera,
    viewportWidth = window.innerWidth,
    viewportHeight = window.innerHeight
  ): void {
    const { activeState, wpProgress } = stepResult;
    if (elements.domStateCode) elements.domStateCode.textContent = activeState.code;
    if (elements.domStateDesc) elements.domStateDesc.textContent = activeState.desc;
    if (elements.domBubbleIcon) elements.domBubbleIcon.textContent = activeState.icon;
    if (elements.domBubbleText) elements.domBubbleText.textContent = activeState.bubble;

    if (elements.domStateProgress) {
      elements.domStateProgress.style.width = `${Math.min(100, Math.round(wpProgress * 100))}%`;
    }

    if (elements.domBubble) {
      // Project 3D position above resident's head to 2D screen coordinates for status bubble
      tempVec3.copy(agentPos);
      tempVec3.y += 1.22;
      tempVec3.project(camera);
      const screenX = (tempVec3.x * 0.5 + 0.5) * viewportWidth;
      const screenY = (-tempVec3.y * 0.5 + 0.5) * viewportHeight;
      elements.domBubble.style.left = `${Math.round(screenX)}px`;
      elements.domBubble.style.top = `${Math.round(screenY)}px`;
    }
  }

  function bindButtons(handlers: HudActionHandlers): void {
    buttonCleanups.forEach((fn) => fn());
    buttonCleanups.length = 0;

    doc.querySelectorAll('[data-slice]').forEach((btn) => {
      const handler = () => {
        const val = btn.getAttribute('data-slice');
        if (val === 'all' || val === '1' || val === '2') {
          handlers.onSliceMode(val);
        }
      };
      btn.addEventListener('click', handler);
      buttonCleanups.push(() => btn.removeEventListener('click', handler));
    });

    doc.querySelectorAll('[data-pixel]').forEach((btn) => {
      const handler = () => {
        const val = Number(btn.getAttribute('data-pixel'));
        if (val) handlers.onPixelScale(val);
      };
      btn.addEventListener('click', handler);
      buttonCleanups.push(() => btn.removeEventListener('click', handler));
    });

    doc.querySelectorAll('[data-theme]').forEach((btn) => {
      const handler = () => {
        const val = btn.getAttribute('data-theme');
        if (val === 'day' || val === 'night') {
          handlers.onTheme(val);
        }
      };
      btn.addEventListener('click', handler);
      buttonCleanups.push(() => btn.removeEventListener('click', handler));
    });

    doc.querySelectorAll('[data-speed]').forEach((btn) => {
      const handler = () => {
        const val = Number(btn.getAttribute('data-speed'));
        if (val) handlers.onSimSpeed(val);
      };
      btn.addEventListener('click', handler);
      buttonCleanups.push(() => btn.removeEventListener('click', handler));
    });
  }

  return {
    elements,
    updateSliceUI,
    updatePixelScaleUI,
    updateThemeUI,
    updateSimSpeedUI,
    updateHoverFloorUI,
    hideTooltip,
    updateAgentHud,
    bindButtons,
    dispose() {
      buttonCleanups.forEach((fn) => fn());
      buttonCleanups.length = 0;
    }
  };
}
