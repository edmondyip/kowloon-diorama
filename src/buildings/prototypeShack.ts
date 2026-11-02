import * as THREE from 'three';
import { SliceMode } from '../core/config';
import { ShackMaterialSet } from '../rendering/materials';

export type FloorTag = 1 | 2;

export interface BoxMeshOptions {
  cutawayFloor?: FloorTag;
  cutScaleY?: number;
  rotX?: number;
  rotY?: number;
  rotZ?: number;
  castShadow?: boolean;
  receiveShadow?: boolean;
  floorTag?: FloorTag;
}

export interface CutawayWallUserData {
  fullScaleY: number;
  cutScaleY: number;
  floorTag?: FloorTag;
}

export interface PrototypeShack {
  shackRoot: THREE.Group;
  FloorGroup_1: THREE.Group;
  FloorGroup_2: THREE.Group;
  RoofGroup: THREE.Group;
  pickableMeshes: THREE.Mesh[];
  cutawayWallMeshes1F: THREE.Mesh[];
  cutawayWallMeshes2F: THREE.Mesh[];
  neonSignMesh: THREE.Mesh;
  laundryShirt1: THREE.Mesh;
  laundryShirt2: THREE.Mesh;
  updateCutawayAndSway: (sliceMode: SliceMode, dt: number, elapsed: number) => void;
  dispose: () => void;
}

export function createPrototypeShack(
  scene: THREE.Scene,
  MAT: ShackMaterialSet
): PrototypeShack {
  const pickableMeshes: THREE.Mesh[] = [];
  const cutawayWallMeshes1F: THREE.Mesh[] = [];
  const cutawayWallMeshes2F: THREE.Mesh[] = [];
  const geometries: THREE.BufferGeometry[] = [];

  function addBox(
    parent: THREE.Object3D,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    material: THREE.Material,
    opts: BoxMeshOptions = {}
  ): THREE.Mesh {
    const geo = new THREE.BoxGeometry(w, h, d);
    geometries.push(geo);
    // If this is a cutaway wall, shift geometry origin to bottom so scaling Y scales cleanly from its floor base!
    if (opts.cutawayFloor) {
      geo.translate(0, h / 2, 0);
    }
    const mesh = new THREE.Mesh(geo, material);
    if (opts.cutawayFloor) {
      mesh.position.set(x, y - h / 2, z);
      mesh.userData.fullScaleY = 1.0;
      mesh.userData.cutScaleY = opts.cutScaleY !== undefined ? opts.cutScaleY : 0.22;
      if (opts.cutawayFloor === 1) cutawayWallMeshes1F.push(mesh);
      if (opts.cutawayFloor === 2) cutawayWallMeshes2F.push(mesh);
    } else {
      mesh.position.set(x, y, z);
    }

    if (opts.rotX) mesh.rotation.x = opts.rotX;
    if (opts.rotY) mesh.rotation.y = opts.rotY;
    if (opts.rotZ) mesh.rotation.z = opts.rotZ;

    mesh.castShadow = opts.castShadow !== undefined ? opts.castShadow : true;
    mesh.receiveShadow = opts.receiveShadow !== undefined ? opts.receiveShadow : true;

    if (opts.floorTag) {
      mesh.userData.floorTag = opts.floorTag;
      pickableMeshes.push(mesh);
    }
    parent.add(mesh);
    return mesh;
  }

  const shackRoot = new THREE.Group();
  shackRoot.name = 'KowloonShack';
  scene.add(shackRoot);

  // ----------------------------------------------------------------------------
  // FLOOR 1 (`FloorGroup_1`): y = 0.0 to 2.4
  // Footprint: X from -2.0 to +2.0 (width 4.0), Z from -1.7 to +1.7 (depth 3.4)
  // Doorway on Front Wall (+Z = +1.7), centered around X = 0.0 (width 0.95)
  // ----------------------------------------------------------------------------
  const FloorGroup_1 = new THREE.Group();
  FloorGroup_1.name = 'FloorGroup_1';
  shackRoot.add(FloorGroup_1);

  // Concrete foundation plinth & interior wooden floor
  addBox(FloorGroup_1, 4.2, 0.20, 3.6, 0, 0.10, 0, MAT.concrete, { floorTag: 1 });
  addBox(FloorGroup_1, 3.88, 0.06, 3.28, 0, 0.21, 0, MAT.floor1F, { floorTag: 1 });

  // Front stone step outside the doorway (+Z)
  addBox(FloorGroup_1, 1.25, 0.12, 0.45, 0.0, 0.06, 1.98, MAT.concrete, { floorTag: 1 });

  // Corner wooden structural posts (1F)
  const wallH1 = 2.2;
  const wallCenterY1 = 0.2 + wallH1 / 2; // 1.3
  addBox(FloorGroup_1, 0.16, wallH1, 0.16, -1.94, wallCenterY1, -1.64, MAT.woodBeam, { floorTag: 1 });
  addBox(FloorGroup_1, 0.16, wallH1, 0.16,  1.94, wallCenterY1, -1.64, MAT.woodBeam, { floorTag: 1 });
  addBox(FloorGroup_1, 0.16, wallH1, 0.16, -1.94, wallCenterY1,  1.64, MAT.woodBeam, { floorTag: 1, cutawayFloor: 1, cutScaleY: 0.22 });
  addBox(FloorGroup_1, 0.16, wallH1, 0.16,  1.94, wallCenterY1,  1.64, MAT.woodBeam, { floorTag: 1, cutawayFloor: 1, cutScaleY: 0.22 });

  // Back Wall (-Z = -1.64) — kept higher so interior has a backdrop, or slightly lowered to 0.55 on slice
  addBox(FloorGroup_1, 3.88, wallH1, 0.14, 0, wallCenterY1, -1.64, MAT.woodWall, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.42
  });

  // Left Wall (-X = -1.94) — drops to half/low height in cutaway
  addBox(FloorGroup_1, 0.14, wallH1, 3.28, -1.94, wallCenterY1, 0, MAT.concrete, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.24
  });

  // Right Wall (+X = +1.94) — drops to low height in cutaway
  addBox(FloorGroup_1, 0.14, wallH1, 3.28, 1.94, wallCenterY1, 0, MAT.woodWall, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.24
  });

  // Front Wall (+Z = +1.64) with open doorway in center (X in [-0.48, +0.48])
  // Left segment of front wall: X from -1.94 to -0.48 (width 1.46, center -1.21)
  addBox(FloorGroup_1, 1.46, wallH1, 0.14, -1.21, wallCenterY1, 1.64, MAT.woodWall, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.20
  });
  // Right segment of front wall: X from +0.48 to +1.94 (width 1.46, center +1.21)
  addBox(FloorGroup_1, 1.46, wallH1, 0.14, 1.21, wallCenterY1, 1.64, MAT.woodWall, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.20
  });
  // Door lintel above doorway
  addBox(FloorGroup_1, 1.02, 0.42, 0.16, 0.0, 2.19, 1.64, MAT.woodBeam, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.01
  });
  // Open wooden door leaf swung slightly inward
  addBox(FloorGroup_1, 0.08, 1.72, 0.78, -0.46, 1.08, 1.24, MAT.woodDark, {
    rotY: 0.35,
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.24
  });

  // 1F Front Window on right front wall (+X = 1.22, +Z = 1.68)
  addBox(FloorGroup_1, 0.72, 0.68, 0.18, 1.22, 1.38, 1.65, MAT.windowGlass, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.02
  });
  // Tiny corrugated metal rain awning over front door & window
  addBox(FloorGroup_1, 2.9, 0.08, 0.65, 0.4, 2.18, 1.98, MAT.tinRoof, {
    rotX: 0.22,
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.01
  });

  // --- 1F INTERIOR FURNITURE (Workbench/Stove, Bed, Shelves, Staircase) ---
  // 1) Workbench & Wok Stove on Left-Back corner (around X = -1.1, Z = -0.85)
  addBox(FloorGroup_1, 1.35, 0.68, 0.68, -1.12, 0.56, -1.12, MAT.woodLight, { floorTag: 1 }); // Bench counter
  addBox(FloorGroup_1, 1.40, 0.08, 0.72, -1.12, 0.92, -1.12, MAT.woodDark, { floorTag: 1 });  // Bench tabletop
  // Wok stove burner & iron wok on left side of bench
  addBox(FloorGroup_1, 0.46, 0.12, 0.46, -1.42, 1.00, -1.12, MAT.darkMetal, { floorTag: 1 });
  addBox(FloorGroup_1, 0.30, 0.06, 0.30, -1.42, 1.07, -1.12, MAT.stoveFire, { floorTag: 1 });
  // Tool rack & exhaust hood on back wall behind workbench
  addBox(FloorGroup_1, 0.65, 0.26, 0.45, -1.42, 1.78, -1.32, MAT.tinWall, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.1
  });
  // Small radio / tool box on right side of workbench
  addBox(FloorGroup_1, 0.34, 0.24, 0.26, -0.74, 1.08, -1.16, MAT.redCrate, { floorTag: 1 });
  // Wooden stool in front of workbench
  addBox(FloorGroup_1, 0.34, 0.38, 0.34, -0.95, 0.42, -0.42, MAT.woodDark, { floorTag: 1 });

  // 2) Cozy Cot / Bed on Left-Front corner (X = -1.25, Z = +0.55)
  addBox(FloorGroup_1, 1.15, 0.28, 1.55, -1.25, 0.36, 0.62, MAT.woodBeam, { floorTag: 1 }); // Bed frame
  addBox(FloorGroup_1, 1.06, 0.14, 1.46, -1.25, 0.54, 0.62, MAT.quilt, { floorTag: 1 });    // Mattress & quilt
  addBox(FloorGroup_1, 0.68, 0.12, 0.34, -1.25, 0.64, 1.12, MAT.pillow, { floorTag: 1 });   // Pillow

  // 3) Interior Wooden Staircase on Right side (X = +1.32), climbing from Z = +0.85 (bottom) to Z = -1.05 (top at 2F)
  const numSteps = 8;
  for (let s = 0; s < numSteps; s++) {
    const stepT = s / (numSteps - 1);
    const stepY = 0.38 + s * 0.27;
    const stepZ = 0.85 - stepT * 1.85;
    addBox(FloorGroup_1, 0.76, 0.12, 0.32, 1.36, stepY, stepZ, MAT.woodLight, { floorTag: 1 });
    // Support stringer post under every other step
    if (s % 2 === 1) {
      addBox(FloorGroup_1, 0.10, stepY - 0.22, 0.10, 1.02, 0.22 + (stepY - 0.22) / 2, stepZ, MAT.woodBeam, { floorTag: 1 });
    }
  }
  // Handrail post at bottom of stairs
  addBox(FloorGroup_1, 0.10, 0.75, 0.10, 1.00, 0.60, 0.95, MAT.woodDark, { floorTag: 1 });
  // Storage crate tucked under the stairs
  addBox(FloorGroup_1, 0.52, 0.44, 0.52, 1.38, 0.44, -0.85, MAT.redCrate, { floorTag: 1 });

  // --- 1F EXTERIOR PROPS (Pipes, Gas Canisters, Bamboo Pole, Potted Plant) ---
  // Twin LPG gas cylinders by the left wall
  addBox(FloorGroup_1, 0.32, 0.68, 0.32, -2.18, 0.54, -0.45, MAT.pipeMetal, { floorTag: 1 });
  addBox(FloorGroup_1, 0.32, 0.68, 0.32, -2.18, 0.54,  0.02, MAT.pipeMetal, { floorTag: 1 });
  addBox(FloorGroup_1, 0.14, 0.12, 0.14, -2.18, 0.92, -0.45, MAT.copperPipe, { floorTag: 1 });
  addBox(FloorGroup_1, 0.14, 0.12, 0.14, -2.18, 0.92,  0.02, MAT.copperPipe, { floorTag: 1 });

  // Exterior vertical water pipe running up front-left corner
  addBox(FloorGroup_1, 0.10, 2.35, 0.10, -2.06, 1.35, 1.52, MAT.pipeMetal, {
    floorTag: 1,
    cutawayFloor: 1,
    cutScaleY: 0.28
  });

  // Red plastic delivery crate & potted plant outside front door
  addBox(FloorGroup_1, 0.44, 0.36, 0.44, -0.95, 0.18, 1.96, MAT.redCrate, { floorTag: 1 });
  addBox(FloorGroup_1, 0.30, 0.28, 0.30,  0.88, 0.14, 1.98, MAT.terracotta, { floorTag: 1 });
  addBox(FloorGroup_1, 0.38, 0.36, 0.38,  0.88, 0.42, 1.98, MAT.foliage, { floorTag: 1 });

  // ----------------------------------------------------------------------------
  // FLOOR 2 (`FloorGroup_2`): y = 2.4 to 4.6
  // Overhanging illegal-extension style room!
  // Cantilevered wider & deeper than 1F: X from -2.25 to +2.35 (width 4.6), Z from -1.9 to +1.95 (depth 3.85)
  // ----------------------------------------------------------------------------
  const FloorGroup_2 = new THREE.Group();
  FloorGroup_2.name = 'FloorGroup_2';
  shackRoot.add(FloorGroup_2);

  // 2F Cantilevered Floor Deck (leaving stairwell opening on right-back around X:[0.95..1.75], Z:[-1.35..-0.15])
  // Main left/center floor slab (X from -2.25 to +0.96, width 3.21)
  addBox(FloorGroup_2, 3.21, 0.16, 3.85, -0.645, 2.48, 0.02, MAT.floor2F, { floorTag: 2 });
  // Front-right floor slab in front of stairwell (X from +0.96 to +2.35, Z from -0.15 to +1.95)
  addBox(FloorGroup_2, 1.39, 0.16, 2.10, 1.655, 2.48, 0.90, MAT.floor2F, { floorTag: 2 });
  // Back-right narrow ledge behind stairwell (X from +0.96 to +2.35, Z from -1.90 to -1.35)
  addBox(FloorGroup_2, 1.39, 0.16, 0.55, 1.655, 2.48, -1.625, MAT.floor2F, { floorTag: 2 });
  // Right outer rim strip alongside stairwell (X from +1.76 to +2.35)
  addBox(FloorGroup_2, 0.59, 0.16, 1.20, 2.055, 2.48, -0.75, MAT.floor2F, { floorTag: 2 });

  // Diagonal wooden/metal support struts under the 2F overhang
  const strutPositions: [number, number, number, number, number, number][] = [
    [-2.05, 2.22, -1.2,  0, 0,  0.65],
    [-2.05, 2.22,  1.2,  0, 0,  0.65],
    [ 2.10, 2.22, -1.2,  0, 0, -0.65],
    [ 2.10, 2.22,  1.2,  0, 0, -0.65],
    [-1.20, 2.22,  1.78, -0.65, 0, 0],
    [ 1.20, 2.22,  1.78, -0.65, 0, 0]
  ];
  strutPositions.forEach(([sx, sy, sz, rx, ry, rz]) => {
    addBox(FloorGroup_2, 0.12, 0.58, 0.12, sx, sy, sz, MAT.woodBeam, {
      rotX: rx, rotY: ry, rotZ: rz, floorTag: 2
    });
  });

  // 2F Walls (y from 2.56 to 4.56, height = 2.0)
  const wallH2 = 2.0;
  const wallCenterY2 = 2.56 + wallH2 / 2; // 3.56

  // 2F Back Wall (-Z = -1.84)
  addBox(FloorGroup_2, 4.56, wallH2, 0.14, 0.05, wallCenterY2, -1.84, MAT.woodWall, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.38
  });

  // 2F Left Wall (-X = -2.18) — corrugated green/teal tin illegal extension wall!
  addBox(FloorGroup_2, 0.14, wallH2, 3.82, -2.18, wallCenterY2, 0.02, MAT.tinWall, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.22
  });

  // 2F Right Wall (+X = +2.28)
  addBox(FloorGroup_2, 0.14, wallH2, 3.82, 2.28, wallCenterY2, 0.02, MAT.woodWall, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.22
  });

  // 2F Front Wall (+Z = +1.88) — mixed wood planks and patched tin extension with wide lookout window
  addBox(FloorGroup_2, 2.75, wallH2, 0.14, -0.85, wallCenterY2, 1.88, MAT.tinWall, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.20
  });
  addBox(FloorGroup_2, 1.85, wallH2, 0.14, 1.42, wallCenterY2, 1.88, MAT.woodWall, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.20
  });

  // 2F Glowing Windows (Front Left, Front Right, and Left Wall)
  addBox(FloorGroup_2, 1.15, 0.72, 0.18, -0.85, 3.62, 1.90, MAT.windowGlass, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.02
  });
  addBox(FloorGroup_2, 0.76, 0.68, 0.18, 1.38, 3.62, 1.90, MAT.windowGlass, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.02
  });
  addBox(FloorGroup_2, 0.18, 0.68, 0.92, -2.20, 3.62, 0.15, MAT.windowGlass, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.02
  });

  // Exterior AC Unit Box mounted on 2F Left/Front overhang + drip pipe
  addBox(FloorGroup_2, 0.48, 0.52, 0.72, -2.46, 3.15, 1.15, MAT.acUnit, { floorTag: 2 });
  addBox(FloorGroup_2, 0.52, 0.08, 0.78, -2.46, 2.86, 1.15, MAT.rustMetal, { floorTag: 2 });

  // Iconic Kowloon Vertical Neon / Warm Shop Sign mounted on Front-Right corner (+X = 2.48, +Z = 1.45)
  // Support iron brackets
  addBox(FloorGroup_2, 0.42, 0.08, 0.08, 2.46, 4.18, 1.45, MAT.darkMetal, { floorTag: 2 });
  addBox(FloorGroup_2, 0.42, 0.08, 0.08, 2.46, 3.05, 1.45, MAT.darkMetal, { floorTag: 2 });
  // Sign box
  const neonSignMesh = addBox(FloorGroup_2, 0.16, 1.48, 0.68, 2.68, 3.62, 1.45, MAT.neonSign, { floorTag: 2 });

  // Bamboo Laundry Pole sticking out from 2F Front Window with hanging clothes
  addBox(FloorGroup_2, 1.75, 0.06, 0.06, -0.85, 4.12, 2.38, MAT.bamboo, { floorTag: 2 });
  addBox(FloorGroup_2, 0.06, 0.06, 0.56, -1.45, 4.12, 2.14, MAT.bamboo, { floorTag: 2 });
  addBox(FloorGroup_2, 0.06, 0.06, 0.56, -0.25, 4.12, 2.14, MAT.bamboo, { floorTag: 2 });

  const laundryShirt1 = addBox(FloorGroup_2, 0.36, 0.46, 0.05, -1.10, 3.86, 2.38, MAT.laundryWhite, { floorTag: 2 });
  const laundryShirt2 = addBox(FloorGroup_2, 0.32, 0.40, 0.05, -0.60, 3.89, 2.38, MAT.laundryYellow, { floorTag: 2 });

  // --- 2F INTERIOR FURNITURE (Low Tea Table, Cushions, Bookshelf, Window Chair) ---
  // Low tea table & floor cushions in center of 2F
  addBox(FloorGroup_2, 1.10, 0.32, 0.78, -0.55, 2.74, -0.20, MAT.woodDark, { floorTag: 2 });
  addBox(FloorGroup_2, 0.38, 0.08, 0.38, -0.55, 2.60,  0.45, MAT.redCrate, { floorTag: 2 });
  addBox(FloorGroup_2, 0.38, 0.08, 0.38, -1.25, 2.60, -0.20, MAT.blueTarp, { floorTag: 2 });
  // Teapot & cup on 2F table
  addBox(FloorGroup_2, 0.18, 0.18, 0.18, -0.45, 2.98, -0.18, MAT.terracotta, { floorTag: 2 });
  // Bookshelf / storage cabinet against 2F back wall
  addBox(FloorGroup_2, 1.35, 1.25, 0.38, -0.85, 3.18, -1.52, MAT.woodBeam, {
    floorTag: 2,
    cutawayFloor: 2,
    cutScaleY: 0.45
  });
  // Safety railing around 2F stairwell opening
  addBox(FloorGroup_2, 0.08, 0.58, 1.22, 0.92, 2.84, -0.75, MAT.woodBeam, { floorTag: 2 });

  // ----------------------------------------------------------------------------
  // ROOF (`RoofGroup`): y = 4.56 to 6.3
  // Pitched corrugated tin roof + water tank + TV antenna + chimney
  // ----------------------------------------------------------------------------
  const RoofGroup = new THREE.Group();
  RoofGroup.name = 'RoofGroup';
  shackRoot.add(RoofGroup);

  // Roof ceiling base trim
  addBox(RoofGroup, 4.86, 0.14, 4.10, 0.05, 4.62, 0.02, MAT.woodBeam, { floorTag: 2 });

  // Pitched corrugated tin roof halves (sloping along Z)
  addBox(RoofGroup, 5.10, 0.12, 2.45, 0.05, 5.08, -1.04, MAT.tinRoof, {
    rotX: 0.34,
    floorTag: 2
  });
  addBox(RoofGroup, 5.10, 0.12, 2.45, 0.05, 5.08,  1.08, MAT.tinRoof, {
    rotX: -0.34,
    floorTag: 2
  });
  // Ridge cap beam
  addBox(RoofGroup, 5.16, 0.16, 0.28, 0.05, 5.46, 0.02, MAT.rustMetal, { floorTag: 2 });

  // Blue tarpaulin patch weighted down with old tires/bricks on roof
  addBox(RoofGroup, 1.65, 0.06, 1.35, -0.95, 5.16, 0.95, MAT.blueTarp, {
    rotX: -0.34,
    floorTag: 2
  });

  // Rooftop Metal Water Tank on stilted frame
  addBox(RoofGroup, 0.95, 0.55, 0.95, 1.35, 5.25, -0.75, MAT.darkMetal, { floorTag: 2 });
  addBox(RoofGroup, 0.88, 0.88, 0.88, 1.35, 5.92, -0.75, MAT.pipeMetal, { floorTag: 2 });

  // Classic Kowloon Rooftop Fishbone TV Antenna Mast
  addBox(RoofGroup, 0.06, 1.75, 0.06, -1.55, 6.05, -0.65, MAT.pipeMetal, { floorTag: 2 });
  addBox(RoofGroup, 0.85, 0.04, 0.04, -1.55, 6.65, -0.65, MAT.pipeMetal, { floorTag: 2 });
  addBox(RoofGroup, 0.62, 0.04, 0.04, -1.55, 6.38, -0.65, MAT.pipeMetal, { floorTag: 2 });
  addBox(RoofGroup, 0.04, 0.04, 0.72, -1.55, 6.52, -0.65, MAT.pipeMetal, { floorTag: 2 });

  // Exhaust chimney pipe rising from 1F stove through roof
  addBox(RoofGroup, 0.22, 1.15, 0.22, -1.42, 5.65, -1.32, MAT.rustMetal, { floorTag: 2 });
  addBox(RoofGroup, 0.34, 0.08, 0.34, -1.42, 6.26, -1.32, MAT.darkMetal, { floorTag: 2 });

  return {
    shackRoot,
    FloorGroup_1,
    FloorGroup_2,
    RoofGroup,
    pickableMeshes,
    cutawayWallMeshes1F,
    cutawayWallMeshes2F,
    neonSignMesh,
    laundryShirt1,
    laundryShirt2,
    updateCutawayAndSway(sliceMode: SliceMode, dt: number, elapsed: number) {
      // Smoothly drop 1F front/side walls when Slice = '1'
      const cut1F = sliceMode === '1';
      cutawayWallMeshes1F.forEach((mesh) => {
        const ud = mesh.userData as CutawayWallUserData;
        const targetScaleY = cut1F ? ud.cutScaleY : ud.fullScaleY;
        mesh.scale.y += (targetScaleY - mesh.scale.y) * Math.min(1.0, dt * 12.0);
      });

      // Smoothly drop 2F front/side walls when Slice = '2'
      const cut2F = sliceMode === '2';
      cutawayWallMeshes2F.forEach((mesh) => {
        const ud = mesh.userData as CutawayWallUserData;
        const targetScaleY = cut2F ? ud.cutScaleY : ud.fullScaleY;
        mesh.scale.y += (targetScaleY - mesh.scale.y) * Math.min(1.0, dt * 12.0);
      });

      // Gentle wind sway on 2F hanging laundry shirts
      laundryShirt1.rotation.x = Math.sin(elapsed * 2.1) * 0.12;
      laundryShirt2.rotation.x = Math.sin(elapsed * 2.1 + 1.1) * 0.14;
    },
    dispose() {
      geometries.forEach((g) => g.dispose());
    }
  };
}
