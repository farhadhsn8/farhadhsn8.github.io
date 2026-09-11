// ============================================================
// quality.js — rate–distortion–perception tradeoff (WebGL).
//
// Four schematic quality metrics are lifted into a 3D surface:
// rate runs along x, the metric across z, and normalized quality
// is height. The marker follows the live rate so the plot and the
// codec always agree about how hard the system is compressing.
// ============================================================

import { machine } from "../core/machine.js";
import { clamp } from "../core/util.js";
import { makeGL, THREE, C } from "../core/gl.js";

const METRICS = [
  { key: "psnr", label: "PSNR", color: C.cyan, raw: (r) => 44 - 22 * r, min: 20, max: 44, fmt: (v) => v.toFixed(1) },
  { key: "ssim", label: "SSIM", color: C.blue, raw: (r) => 0.99 - 0.5 * r, min: 0.4, max: 1, fmt: (v) => v.toFixed(3) },
  { key: "msssim", label: "MS-SSIM", color: C.violet, raw: (r) => 0.995 - 0.45 * r, min: 0.5, max: 1, fmt: (v) => v.toFixed(3) },
  { key: "vmaf", label: "VMAF", color: C.good, raw: (r) => 98 - 68 * (0.4 * r + 0.6 * r * r), min: 20, max: 100, fmt: (v) => v.toFixed(1) }
];

const norm = (m, r) => clamp((m.raw(r) - m.min) / (m.max - m.min));
const X = (r) => -11 + r * 22;
const Z = (m) => -6 + (m / (METRICS.length - 1)) * 12;
const HEIGHT = 8;

function makeLabel(text, color) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 48;
  const ctx = c.getContext("2d");
  ctx.fillStyle = color;
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3, 0.56, 1);
  return sp;
}

export function initQuality() {
  const canvas = document.getElementById("quality-canvas");
  if (!canvas) return;
  const gl = makeGL(canvas, { antialias: true, dpr: 1.75, fov: 42 });
  if (!gl) return;
  const { renderer, scene, camera } = gl;
  const inView = (() => {
    let v = true;
    const io = new IntersectionObserver((es) => (v = es[0].isIntersecting), { rootMargin: "160px" });
    io.observe(canvas);
    return () => v;
  })();

  camera.position.set(0, 14, 25);
  camera.lookAt(0, 1.5, 0);

  const RS = 48;
  const MC = METRICS.length;
  const verts = [];
  const cols = [];
  const idx = [];
  const blue = new THREE.Color(C.blue);
  const cyan = new THREE.Color(C.cyan);
  const violet = new THREE.Color(C.violet);
  const tmp = new THREE.Color();

  for (let r = 0; r <= RS; r++) {
    for (let m = 0; m < MC; m++) {
      const rate = r / RS;
      const q = norm(METRICS[m], rate);
      verts.push(X(rate), q * HEIGHT, Z(m));
      const t = q;
      tmp.copy(t < 0.5 ? blue : cyan);
      if (t < 0.5) tmp.lerp(cyan, t * 2);
      else tmp.lerp(violet, (t - 0.5) * 2);
      cols.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (let r = 0; r < RS; r++) {
    for (let m = 0; m < MC - 1; m++) {
      const a = r * MC + m;
      const b = a + 1;
      const c = (r + 1) * MC + m;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(cols, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const surface = new THREE.Mesh(
    geo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.92,
      side: THREE.DoubleSide,
      depthWrite: false
    })
  );
  scene.add(surface);

  // wireframe overlay
  const wire = new THREE.LineSegments(
    new THREE.WireframeGeometry(geo),
    new THREE.LineBasicMaterial({ color: C.muted, transparent: true, opacity: 0.08, depthWrite: false })
  );
  scene.add(wire);

  // per-metric accent curves
  const curveMat = {};
  METRICS.forEach((m, mi) => {
    const pts = [];
    for (let r = 0; r <= RS; r++) {
      const rate = r / RS;
      pts.push(new THREE.Vector3(X(rate), norm(m, rate) * HEIGHT + 0.06, Z(mi)));
    }
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: m.color, transparent: true, opacity: 0.9 }));
    scene.add(line);
    curveMat[m.key] = line;
  });

  // markers
  const markers = METRICS.map((m, mi) => {
    const mesh = new THREE.Mesh(
      new THREE.SphereGeometry(0.18, 12, 12),
      new THREE.MeshBasicMaterial({ color: m.color })
    );
    mesh.position.set(X(0), 0, Z(mi));
    scene.add(mesh);
    return mesh;
  });

  // rate curtain
  const curtainGeo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(X(0), 0, Z(0)),
    new THREE.Vector3(X(0), 0, Z(MC - 1)),
    new THREE.Vector3(X(0), HEIGHT + 0.5, Z(MC - 1)),
    new THREE.Vector3(X(0), HEIGHT + 0.5, Z(0))
  ]);
  const curtain = new THREE.LineLoop(
    curtainGeo,
    new THREE.LineBasicMaterial({ color: C.ink, transparent: true, opacity: 0.3 })
  );
  scene.add(curtain);

  // ground grid + labels
  const grid = new THREE.GridHelper(30, 30, C.dim, 0x14181f);
  grid.position.y = -0.02;
  grid.material.transparent = true;
  grid.material.opacity = 0.16;
  scene.add(grid);

  METRICS.forEach((m, mi) => {
    const sp = makeLabel(m.label, "#828d9f");
    sp.position.set(-13.4, 0.2, Z(mi));
    scene.add(sp);
  });
  const rateLbl = makeLabel("rate →", "#5a6375");
  rateLbl.position.set(0, 0.2, 8);
  scene.add(rateLbl);

  const readouts = {};
  for (const m of METRICS) {
    const node = document.querySelector(`[data-metric="${m.key}"]`);
    if (node) readouts[m.key] = node;
  }

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const x = X(d.rate);
    curtain.position.x = x - X(0);
    METRICS.forEach((m, mi) => {
      const y = norm(m, d.rate) * HEIGHT + 0.06;
      markers[mi].position.set(x, y, Z(mi));
      if (readouts[m.key]) readouts[m.key].textContent = m.fmt(m.raw(d.rate));
    });

    scene.rotation.y = (s.fx - 0.5) * 0.18;
    scene.rotation.x = -(s.fy - 0.5) * 0.08;
    if (!s.reduced && !s.paused) scene.rotation.y += Math.sin(s.time * 0.08) * 0.02;

    renderer.render(scene, camera);
  });
}
