import * as THREE from 'three';

export function createSeededRandom(seed: number): () => number {
  let s = seed >>> 0;
  return function (): number {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export type CanvasDrawFn = (
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number
) => void;

export function makePixelCanvasTexture(
  width: number,
  height: number,
  drawFn: CanvasDrawFn,
  repeatX = 1,
  repeatY = 1
): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.imageSmoothingEnabled = false;
    drawFn(ctx, width, height);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.magFilter = THREE.NearestFilter;
  tex.minFilter = THREE.NearestFilter;
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeatX, repeatY);
  tex.needsUpdate = true;
  return tex;
}

export interface TextureSet {
  groundTile: THREE.CanvasTexture;
  woodPlanks: THREE.CanvasTexture;
  interiorFloor: THREE.CanvasTexture;
  corrugatedTin: THREE.CanvasTexture;
  patchedWallTin: THREE.CanvasTexture;
  concreteWall: THREE.CanvasTexture;
  windowPane: THREE.CanvasTexture;
  neonSign: THREE.CanvasTexture;
  acUnit: THREE.CanvasTexture;
  quilt: THREE.CanvasTexture;
  residentHead: THREE.CanvasTexture;
  residentTorso: THREE.CanvasTexture;
  dispose: () => void;
}

export function createTextures(): TextureSet {
  // Ground cobblestone / mossy dirt tile (16x16 per tile)
  const groundTile = makePixelCanvasTexture(64, 64, (ctx, w, h) => {
    const rng = createSeededRandom(101);
    ctx.fillStyle = '#8b8374';
    ctx.fillRect(0, 0, w, h);

    // Draw 4x4 grid of 16x16 tiles with varied stone & moss tones
    const stonePalettes = ['#958d7e', '#888071', '#7d7567', '#9c9383', '#737a62'];
    for (let ty = 0; ty < 4; ty++) {
      for (let tx = 0; tx < 4; tx++) {
        const ox = tx * 16;
        const oy = ty * 16;
        ctx.fillStyle = stonePalettes[Math.floor(rng() * stonePalettes.length)];
        ctx.fillRect(ox + 1, oy + 1, 14, 14);

        // Mortar border
        ctx.fillStyle = '#625c50';
        ctx.fillRect(ox, oy, 16, 1);
        ctx.fillRect(ox, oy, 1, 16);

        // Top-left bevel highlight
        ctx.fillStyle = '#aba393';
        ctx.fillRect(ox + 1, oy + 1, 13, 1);
        ctx.fillRect(ox + 1, oy + 1, 1, 13);

        // Pixel speckles & moss patches
        for (let i = 0; i < 16; i++) {
          const px = ox + 2 + Math.floor(rng() * 12);
          const py = oy + 2 + Math.floor(rng() * 12);
          const r = rng();
          if (r < 0.22) ctx.fillStyle = '#5e6e47'; // moss pixel
          else if (r < 0.55) ctx.fillStyle = '#6f685c';
          else ctx.fillStyle = '#a49c8c';
          ctx.fillRect(px, py, 1, 1);
        }
      }
    }
  }, 4, 4);

  // Weathered Kowloon wood planks
  const woodPlanks = makePixelCanvasTexture(32, 32, (ctx, w) => {
    const rng = createSeededRandom(202);
    const plankColors = ['#7c583c', '#6e4d33', '#876243', '#64452d'];
    for (let row = 0; row < 4; row++) {
      const y = row * 8;
      ctx.fillStyle = plankColors[row % plankColors.length];
      ctx.fillRect(0, y, w, 7);
      // Dark seam
      ctx.fillStyle = '#3f2a1b';
      ctx.fillRect(0, y + 7, w, 1);
      // Highlight edge
      ctx.fillStyle = '#946e4e';
      ctx.fillRect(0, y, w, 1);
      // Wood grain & nail pixels
      const jointX = (row * 11 + 7) % 28 + 2;
      ctx.fillStyle = '#3f2a1b';
      ctx.fillRect(jointX, y, 1, 7);
      ctx.fillRect((jointX + 2) % w, y + 2, 1, 1);
      ctx.fillRect((jointX + 2) % w, y + 5, 1, 1);
      for (let i = 0; i < 12; i++) {
        ctx.fillStyle = rng() > 0.5 ? '#5b3d28' : '#8d6849';
        ctx.fillRect(Math.floor(rng() * w), y + 1 + Math.floor(rng() * 5), 2, 1);
      }
    }
  }, 2, 2);

  // Interior warm floorboards
  const interiorFloor = makePixelCanvasTexture(32, 32, (ctx, w) => {
    const rng = createSeededRandom(303);
    for (let row = 0; row < 8; row++) {
      const y = row * 4;
      ctx.fillStyle = row % 2 === 0 ? '#a87c51' : '#9b7047';
      ctx.fillRect(0, y, w, 3);
      ctx.fillStyle = '#6c4b2d';
      ctx.fillRect(0, y + 3, w, 1);
      for (let i = 0; i < 5; i++) {
        ctx.fillStyle = rng() > 0.5 ? '#b98d62' : '#855d38';
        ctx.fillRect(Math.floor(rng() * w), y + 1, 2, 1);
      }
    }
  }, 3, 3);

  // Corrugated rusty tin sheet
  const corrugatedTin = makePixelCanvasTexture(32, 32, (ctx, w, h) => {
    const rng = createSeededRandom(404);
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = '#738287';
      ctx.fillRect(x, 0, 1, h);
      ctx.fillStyle = '#8fa0a6';
      ctx.fillRect(x + 1, 0, 1, h);
      ctx.fillStyle = '#5c696e';
      ctx.fillRect(x + 2, 0, 1, h);
      ctx.fillStyle = '#475257';
      ctx.fillRect(x + 3, 0, 1, h);
    }
    // Rust patches
    for (let i = 0; i < 45; i++) {
      const rx = Math.floor(rng() * w);
      const ry = Math.floor(rng() * h);
      ctx.fillStyle = rng() > 0.4 ? '#8f4b32' : '#a85d3e';
      ctx.fillRect(rx, ry, 1 + Math.floor(rng() * 2), 1 + Math.floor(rng() * 3));
    }
  }, 2, 2);

  // Patched green/blue oxidized tin for 2F illegal extension walls
  const patchedWallTin = makePixelCanvasTexture(32, 32, (ctx, w, h) => {
    const rng = createSeededRandom(505);
    for (let x = 0; x < w; x += 4) {
      ctx.fillStyle = '#4e6e68';
      ctx.fillRect(x, 0, 2, h);
      ctx.fillStyle = '#3b5450';
      ctx.fillRect(x + 2, 0, 2, h);
    }
    // Horizontal seam
    ctx.fillStyle = '#293b38';
    ctx.fillRect(0, 15, w, 1);
    // Rust & wear
    for (let i = 0; i < 30; i++) {
      ctx.fillStyle = rng() > 0.5 ? '#7c4734' : '#63857e';
      ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), 2, 1);
    }
  }, 2, 1);

  // Concrete / brick base
  const concreteWall = makePixelCanvasTexture(32, 32, (ctx, w, h) => {
    const rng = createSeededRandom(606);
    ctx.fillStyle = '#9c968b';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rng() > 0.5 ? '#878176' : '#aba59a';
      ctx.fillRect(Math.floor(rng() * w), Math.floor(rng() * h), 1 + Math.floor(rng() * 2), 1);
    }
    // Exposed brick patch
    const bx = 6, by = 10;
    for (let r = 0; r < 3; r++) {
      for (let c = 0; c < 3; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#9e4f3b' : '#874130';
        ctx.fillRect(bx + c * 5 + (r % 2) * 2, by + r * 3, 4, 2);
      }
    }
  }, 2, 1);

  // Window pane texture (day/night emissive friendly)
  const windowPane = makePixelCanvasTexture(16, 16, (ctx, w, h) => {
    ctx.fillStyle = '#3a2b22';
    ctx.fillRect(0, 0, w, h);
    // 4 panes
    ctx.fillStyle = '#ffd584';
    ctx.fillRect(2, 2, 5, 5);
    ctx.fillRect(9, 2, 5, 5);
    ctx.fillRect(2, 9, 5, 5);
    ctx.fillRect(9, 9, 5, 5);
    // Highlights
    ctx.fillStyle = '#fff1cc';
    ctx.fillRect(3, 3, 2, 2);
    ctx.fillRect(10, 3, 2, 2);
  }, 1, 1);

  // Neon Sign texture ("九龍" pixel glyph look)
  const neonSign = makePixelCanvasTexture(32, 64, (ctx, w, h) => {
    ctx.fillStyle = '#18141c';
    ctx.fillRect(0, 0, w, h);
    // Outer neon border
    ctx.fillStyle = '#ff3e6c';
    ctx.fillRect(2, 2, w - 4, 2);
    ctx.fillRect(2, h - 4, w - 4, 2);
    ctx.fillRect(2, 2, 2, h - 4);
    ctx.fillRect(w - 4, 2, 2, h - 4);

    // Stylized pixel kanji / characters in warm gold & cyan
    ctx.fillStyle = '#ffe066';
    // Top glyph ("九")
    ctx.fillRect(14, 9, 3, 18);
    ctx.fillRect(8, 14, 15, 3);
    ctx.fillRect(20, 14, 3, 12);
    ctx.fillRect(20, 24, 6, 3);
    ctx.fillRect(9, 17, 3, 9);

    // Divider bar
    ctx.fillStyle = '#38f9d7';
    ctx.fillRect(7, 31, 18, 2);

    // Bottom glyph ("記")
    ctx.fillStyle = '#ff9f43';
    ctx.fillRect(8, 37, 7, 2);
    ctx.fillRect(8, 42, 7, 2);
    ctx.fillRect(8, 47, 7, 7);
    ctx.fillRect(17, 37, 8, 3);
    ctx.fillRect(22, 37, 3, 10);
    ctx.fillRect(17, 45, 8, 2);
    ctx.fillRect(17, 45, 2, 9);
    ctx.fillRect(17, 52, 9, 2);
  }, 1, 1);

  // AC Unit Front Grille
  const acUnit = makePixelCanvasTexture(16, 16, (ctx, w, h) => {
    ctx.fillStyle = '#c5c1b4';
    ctx.fillRect(0, 0, w, h);
    // Dark fan circle on left
    ctx.fillStyle = '#2d3134';
    ctx.fillRect(2, 3, 9, 10);
    ctx.fillStyle = '#4c5256';
    ctx.fillRect(5, 6, 3, 4);
    // Vents on right
    ctx.fillStyle = '#6c685e';
    for (let y = 3; y <= 12; y += 2) {
      ctx.fillRect(12, y, 3, 1);
    }
  }, 1, 1);

  // Bed Quilt Texture
  const quilt = makePixelCanvasTexture(16, 16, (ctx, w, h) => {
    ctx.fillStyle = '#b34438';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#d96b52';
    for (let y = 2; y < h; y += 4) {
      for (let x = 2; x < w; x += 4) {
        ctx.fillRect(x, y, 2, 2);
      }
    }
    // White sheet fold at top
    ctx.fillStyle = '#e8e4d9';
    ctx.fillRect(0, 0, w, 4);
  }, 1, 1);

  // Resident Head Face Texture
  const residentHead = makePixelCanvasTexture(16, 16, (ctx, w, h) => {
    // Skin base
    ctx.fillStyle = '#f1c29b';
    ctx.fillRect(0, 0, w, h);
    // Dark hair cap & sideburns
    ctx.fillStyle = '#231f20';
    ctx.fillRect(0, 0, w, 5);
    ctx.fillRect(0, 5, 2, 4);
    ctx.fillRect(w - 2, 5, 2, 4);
    // Red/white headband
    ctx.fillStyle = '#d14334';
    ctx.fillRect(0, 4, w, 2);
    // Eyes
    ctx.fillStyle = '#1c1917';
    ctx.fillRect(4, 8, 2, 3);
    ctx.fillRect(10, 8, 2, 3);
    // Eye shine
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(4, 8, 1, 1);
    ctx.fillRect(10, 8, 1, 1);
    // Warm blush / mouth
    ctx.fillStyle = '#d48c6f';
    ctx.fillRect(6, 12, 4, 1);
  }, 1, 1);

  // Resident Torso Shirt + Apron
  const residentTorso = makePixelCanvasTexture(16, 16, (ctx, w, h) => {
    // Teal/blue work jacket
    ctx.fillStyle = '#2d6a7e';
    ctx.fillRect(0, 0, w, h);
    // Cream undershirt collar
    ctx.fillStyle = '#f2eadc';
    ctx.fillRect(5, 0, 6, 3);
    // Work apron / pocket
    ctx.fillStyle = '#c88a4b';
    ctx.fillRect(3, 6, 10, 10);
    ctx.fillStyle = '#9e6832';
    ctx.fillRect(5, 9, 6, 4);
  }, 1, 1);

  const allTextures = [
    groundTile,
    woodPlanks,
    interiorFloor,
    corrugatedTin,
    patchedWallTin,
    concreteWall,
    windowPane,
    neonSign,
    acUnit,
    quilt,
    residentHead,
    residentTorso
  ];

  return {
    groundTile,
    woodPlanks,
    interiorFloor,
    corrugatedTin,
    patchedWallTin,
    concreteWall,
    windowPane,
    neonSign,
    acUnit,
    quilt,
    residentHead,
    residentTorso,
    dispose() {
      allTextures.forEach((t) => t.dispose());
    }
  };
}
