// ============================================================
// collapse.js — the contact section's closing state (WebGL).
//
// Raw information (a scattered 3D cloud) resolves toward a minimal,
// low-entropy core as the system reaches the end of its cycle. The
// core follows the pointer.
// ============================================================

import { machine } from "../core/machine.js";
import { clamp } from "../core/util.js";
import { makeGL, THREE, C, discTexture } from "../core/gl.js";

export function initCollapse() {
  const canvas = document.getElementById("collapse");
  if (!canvas) return;
  const gl = makeGL(canvas, { antialias: true, dpr: 1.75 });
  if (!gl) return;
  const { renderer, scene, camera } = gl;
  let inView = true;
  const io = new IntersectionObserver((es) => (inView = es[0].isIntersecting), { rootMargin: "160px" });
  io.observe(canvas);

  camera.position.set(0, 0, 22);

  const COUNT = 420;
  const pos = new Float32Array(COUNT * 3);
  const col = new Float32Array(COUNT * 3);
  const base = new Float32Array(COUNT * 3);
  const cyan = new THREE.Color(C.cyan);
  const violet = new THREE.Color(C.violet);
  const tmp = new THREE.Color();
  for (let i = 0; i < COUNT; i++) {
    const u = Math.random() * 2 - 1;
    const th = Math.random() * Math.PI * 2;
    const r = Math.pow(Math.random(), 0.5) * 10;
    const s = Math.sqrt(1 - u * u);
    base[i * 3] = Math.cos(th) * s * r;
    base[i * 3 + 1] = u * r * 0.7;
    base[i * 3 + 2] = Math.sin(th) * s * r * 0.6;
    tmp.copy(cyan).lerp(violet, Math.random());
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const points = new THREE.Points(
    geo,
    new THREE.PointsMaterial({
      size: 0.26,
      map: discTexture(64),
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scene.add(points);

  const shell = new THREE.Mesh(
    new THREE.IcosahedronGeometry(10, 1),
    new THREE.MeshBasicMaterial({ color: C.muted, wireframe: true, transparent: true, opacity: 0.12 })
  );
  scene.add(shell);

  const core = new THREE.Mesh(
    new THREE.SphereGeometry(1, 20, 20),
    new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.9 })
  );
  scene.add(core);

  machine.register((dt, d, s) => {
    if (!inView) return;
    const resolve = clamp(1 - s.phase * 3.2) * clamp(s.sectionProgress * 2.2);
    const scale = 1 - resolve * 0.94;

    for (let i = 0; i < COUNT; i++) {
      const b = i * 3;
      const wob = s.reduced ? 0 : Math.sin(s.time * 0.5 + i) * 0.25;
      pos[b] = base[b] * scale + wob * (1 - resolve);
      pos[b + 1] = base[b + 1] * scale + wob * (1 - resolve);
      pos[b + 2] = base[b + 2] * scale + wob * (1 - resolve);
    }
    geo.attributes.position.needsUpdate = true;

    shell.scale.setScalar(Math.max(0.001, scale));
    core.position.set((s.fx - 0.5) * 4, -(s.fy - 0.5) * 3, 0);
    core.scale.setScalar(0.35 + (1 - resolve) * 1.2 + Math.sin(s.time * 2) * 0.05 * (s.paused ? 0 : 1));

    points.rotation.y = (s.fx - 0.5) * 0.3 + (s.reduced || s.paused ? 0 : s.time * 0.06);
    points.rotation.x = -(s.fy - 0.5) * 0.2;
    scene.rotation.y = (s.fx - 0.5) * 0.2;
    scene.rotation.x = -(s.fy - 0.5) * 0.12;

    renderer.render(scene, camera);
  });
}
