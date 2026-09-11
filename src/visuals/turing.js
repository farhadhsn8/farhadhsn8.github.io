// ============================================================
// turing.js — conceptual Turing machine as a 3D tape (WebGL).
//
// The read/write head follows the pointer across an apparently
// infinite tape of cells. Each committed step reads a symbol,
// writes the next and moves; the head's discrete state is the
// pipeline's current stage.
// ============================================================

import { machine, bit } from "../core/machine.js";
import { watch, clamp } from "../core/util.js";
import { makeGL, THREE, C } from "../core/gl.js";

function bitAtlas() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const ctx = c.getContext("2d");
  ctx.clearRect(0, 0, 128, 64);
  ctx.fillStyle = "#e9eef6";
  ctx.font = 'bold 46px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("0", 32, 34);
  ctx.fillText("1", 96, 34);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.repeat.set(0.5, 1);
  tex.needsUpdate = true;
  return tex;
}

export function initTuring() {
  const canvas = document.getElementById("turing");
  if (!canvas) return;
  const gl = makeGL(canvas, { antialias: true, dpr: 1.75 });
  if (!gl) return;
  const { renderer, scene, camera } = gl;
  const inView = watch(canvas);

  const N = 34;
  const SPACING = 1.15;
  const cells = new Map();
  const get = (i) => {
    if (!cells.has(i)) cells.set(i, bit(i, 7));
    return cells.get(i);
  };

  camera.position.set(0, 4.6, 12.5);
  camera.lookAt(0, -0.2, 0);

  // rail
  const rail = new THREE.Mesh(
    new THREE.BoxGeometry(N * SPACING + 4, 0.08, 1.35),
    new THREE.MeshBasicMaterial({ color: C.dim, transparent: true, opacity: 0.35 })
  );
  rail.position.y = -0.5;
  scene.add(rail);

  // cells
  const cellGeo = new THREE.BoxGeometry(0.98, 0.62, 0.16);
  const cellMat = new THREE.MeshBasicMaterial();
  const cellMesh = new THREE.InstancedMesh(cellGeo, cellMat, N);
  cellMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  scene.add(cellMesh);

  const dummy = new THREE.Object3D();
  const dark = new THREE.Color(0x1b2028);
  const cyan = new THREE.Color(C.cyan);
  const activeCol = new THREE.Color(0x0e2a38);
  const tmp = new THREE.Color();

  // bit sprites
  const atlas = bitAtlas();
  const sprites = [];
  for (let i = 0; i < N; i++) {
    const tex = atlas.clone();
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      depthWrite: false,
      opacity: 0.9
    });
    const sp = new THREE.Sprite(mat);
    sp.scale.set(0.55, 0.55, 1);
    scene.add(sp);
    sprites.push({ sp, tex });
  }

  // head
  const headGroup = new THREE.Group();
  const cone = new THREE.Mesh(
    new THREE.ConeGeometry(0.24, 0.6, 4),
    new THREE.MeshBasicMaterial({ color: C.cyan })
  );
  cone.rotation.x = Math.PI;
  cone.position.y = 0.85;
  headGroup.add(cone);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.03, 8, 40),
    new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.8 })
  );
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.55;
  headGroup.add(ring);
  scene.add(headGroup);

  // depth grid
  const grid = new THREE.GridHelper(46, 46, C.dim, 0x14181f);
  grid.position.y = -1.6;
  grid.material.transparent = true;
  grid.material.opacity = 0.22;
  scene.add(grid);

  const status = document.getElementById("tape-status");
  let head = 0;
  let origin = 0;
  let commit = 0;
  let lastBit = 0;
  let writeBit = bit(0, 3);
  let lastStatus = "";

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const focused = s.focus;
    if (!s.paused && !s.reduced) {
      origin += dt * (1.1 + d.stage * 0.12) * (1 - focused * 0.85);
      commit += dt;
    }
    const target = origin + s.fx * 22 + (focused ? (s.px - 0.5) * 6 : 0);
    head += (target - head) * (1 - Math.exp(-(s.reduced ? 8 : 3.2) * dt));

    const interval = 0.5 + (1 - d.rate) * 0.5;
    if (!s.paused && commit >= interval) {
      commit = 0;
      const activeIdx = Math.round(head);
      lastBit = get(activeIdx);
      writeBit = bit(activeIdx + d.stage, (d.stage * 13 + Math.floor(s.time)) | 0);
      cells.set(activeIdx, writeBit);
    }

    const headWorldX = (s.fx - 0.5) * 8;
    const active = Math.round(head);
    const baseIndex = active - Math.floor(N / 2);

    for (let j = 0; j < N; j++) {
      const index = baseIndex + j;
      const x = (index - head) * SPACING + headWorldX;
      const isActive = index === active;
      const near = clamp(1 - Math.abs(x - headWorldX) / 6);

      dummy.position.set(x, 0, 0);
      dummy.rotation.y = -headWorldX * 0.05;
      dummy.updateMatrix();
      cellMesh.setMatrixAt(j, dummy.matrix);

      if (isActive) tmp.copy(activeCol);
      else tmp.copy(dark).lerp(cyan, near * 0.18 + 0.02);
      cellMesh.setColorAt(j, tmp);

      const spr = sprites[j];
      spr.sp.position.set(x, 0.08, 0.14);
      spr.sp.material.opacity = isActive ? 1 : 0.35 + near * 0.5;
      spr.tex.offset.x = get(index) * 0.5;
    }
    cellMesh.instanceMatrix.needsUpdate = true;
    if (cellMesh.instanceColor) cellMesh.instanceColor.needsUpdate = true;

    headGroup.position.x = headWorldX;
    headGroup.rotation.y = s.time * (s.paused || s.reduced ? 0 : 0.6);
    const pulse = 1 + Math.sin(s.time * 4) * (s.paused ? 0 : 0.06);
    headGroup.scale.setScalar(pulse);

    renderer.render(scene, camera);

    if (status) {
      const dir = target > head ? "R" : "L";
      const next = bit(active + 1, (d.stage * 13 + Math.floor(s.time)) | 0);
      const txt = `q${d.stage} · scan ${lastBit} · write ${writeBit} · move ${dir} · h=${active} · ${
        s.paused ? "HALTED" : "running"
      } · next ${next}`;
      if (txt !== lastStatus) {
        lastStatus = txt;
        status.textContent = txt;
      }
    }
  });
}
