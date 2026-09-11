// ============================================================
// field.js — the ambient computational substrate (WebGL).
//
// A three-dimensional node lattice rendered with Three.js. Nodes
// drift slowly, link to their neighbours, and are pulled toward the
// pointer's focus point. As the shared compression rate rises the
// lattice contracts — structure, not spectacle.
// ============================================================

import { machine } from "../core/machine.js";
import { watch, clamp } from "../core/util.js";
import { makeGL, THREE, C, discTexture } from "../core/gl.js";

export function initField() {
  const canvas = document.getElementById("field");
  if (!canvas) return;
  const gl = makeGL(canvas, { antialias: true, dpr: 1.5, alpha: true });
  if (!gl) return;
  const { renderer, scene, camera } = gl;
  const inView = watch(canvas);

  const COUNT = window.innerWidth < 760 ? 70 : 150;
  const SPREAD_X = 40;
  const SPREAD_Y = 24;
  const SPREAD_Z = 12;

  const base = new Float32Array(COUNT * 3);
  const phase = new Float32Array(COUNT);
  const speed = new Float32Array(COUNT);
  const tint = new Float32Array(COUNT);
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);

  for (let i = 0; i < COUNT; i++) {
    base[i * 3] = (Math.random() - 0.5) * SPREAD_X;
    base[i * 3 + 1] = (Math.random() - 0.5) * SPREAD_Y;
    base[i * 3 + 2] = (Math.random() - 0.5) * SPREAD_Z;
    phase[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.08 + Math.random() * 0.16;
    tint[i] = Math.random();
  }

  const pointsGeo = new THREE.BufferGeometry();
  pointsGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  pointsGeo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const pointsMat = new THREE.PointsMaterial({
    size: 0.7,
    map: discTexture(64),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  const points = new THREE.Points(pointsGeo, pointsMat);
  scene.add(points);

  // ---- neighbour graph -----------------------------------------
  const links = [];
  for (let i = 0; i < COUNT; i++) {
    let made = 0;
    for (let j = i + 1; j < COUNT && made < 3; j++) {
      const dx = base[i * 3] - base[j * 3];
      const dy = base[i * 3 + 1] - base[j * 3 + 1];
      const dz = base[i * 3 + 2] - base[j * 3 + 2];
      if (dx * dx + dy * dy + dz * dz < 52) {
        links.push([i, j]);
        made++;
      }
    }
  }
  const linePos = new Float32Array(links.length * 6);
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(linePos, 3));
  const lineMat = new THREE.LineBasicMaterial({
    color: C.cyan,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    blending: THREE.AdditiveBlending
  });
  scene.add(new THREE.LineSegments(lineGeo, lineMat));

  camera.position.set(0, 0, 34);

  const cyan = new THREE.Color(C.cyan);
  const violet = new THREE.Color(C.violet);
  const tmp = new THREE.Color();

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const time = s.time;
    const focus = s.focus;
    const fx = (s.fx - 0.5) * SPREAD_X;
    const fy = -(s.fy - 0.5) * SPREAD_Y;
    const contraction = 0.6 + 0.4 * (1 - d.rate);
    const R = 12 * contraction;

    for (let i = 0; i < COUNT; i++) {
      const b = i * 3;
      const ph = phase[i];
      const drift = s.reduced ? 0 : time * speed[i];
      let x = base[b] * contraction + Math.sin(drift + ph) * 1.1;
      let y = base[b + 1] * contraction + Math.cos(drift * 0.8 + ph) * 0.9;
      let z = base[b + 2] * contraction + Math.sin(drift * 0.5 + ph) * 0.7;

      const dx = fx - x;
      const dy = fy - y;
      const dist = Math.sqrt(dx * dx + dy * dy + z * z) || 1;
      const near = clamp(1 - dist / (R * 2.2));
      if (focus > 0.02) {
        const pull = near * focus * 0.4;
        x += dx * pull;
        y += dy * pull;
      }

      pos[b] = x;
      pos[b + 1] = y;
      pos[b + 2] = z;

      const bright = 0.16 + near * near * (0.5 + focus * 0.5);
      tmp.copy(cyan).lerp(violet, tint[i]);
      col[b] = tmp.r * bright;
      col[b + 1] = tmp.g * bright;
      col[b + 2] = tmp.b * bright;
    }
    pointsGeo.attributes.position.needsUpdate = true;
    pointsGeo.attributes.color.needsUpdate = true;

    for (let k = 0; k < links.length; k++) {
      const a = links[k][0] * 3;
      const b = links[k][1] * 3;
      linePos[k * 6] = pos[a];
      linePos[k * 6 + 1] = pos[a + 1];
      linePos[k * 6 + 2] = pos[a + 2];
      linePos[k * 6 + 3] = pos[b];
      linePos[k * 6 + 4] = pos[b + 1];
      linePos[k * 6 + 5] = pos[b + 2];
    }
    lineGeo.attributes.position.needsUpdate = true;
    lineMat.opacity = 0.07 + 0.1 * focus;

    points.rotation.y += (s.fx - 0.5) * 0.0009;
    points.rotation.x += (-(s.fy - 0.5) * 0.0006 - points.rotation.x) * 0.02;
    scene.rotation.y = (s.fx - 0.5) * 0.18;
    scene.rotation.x = -(s.fy - 0.5) * 0.12;

    renderer.render(scene, camera);
  });
}
