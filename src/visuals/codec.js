// ============================================================
// codec.js — the full encoder → latent → quantize → bitstream →
// decoder → reconstruction pipeline, rendered in WebGL.
//
// The source frame is a synthetic scene. The encoder lifts it into
// a three-dimensional latent cloud, quantization snaps the
// coefficients to a coarser grid, the entropy stage packs a
// shrinking bit cluster, and the decoder rebuilds a progressively
// lossier frame. Drag across the canvas to steer the rate; hover a
// half to emphasize its direction of information flow.
// ============================================================

import { machine } from "../core/machine.js";
import { clamp } from "../core/util.js";
import { makeGL, THREE, C, discTexture, drawSurface } from "../core/gl.js";

function scene(u, v) {
  const base = 0.42 + 0.22 * Math.sin(u * 5.5 + 0.7) + 0.16 * Math.cos(v * 4.3);
  const blob = Math.exp(-(((u - 0.36) ** 2 + (v - 0.42) ** 2) * 26)) * 0.62;
  const blob2 = Math.exp(-(((u - 0.72) ** 2 + (v - 0.68) ** 2) * 40)) * 0.4;
  const stripes = 0.1 * Math.sin((u + v) * 34);
  return clamp(base * 0.5 + blob + blob2 + stripes + 0.16);
}

function paint(ctx, size, mode, rate) {
  const n = 10;
  const cell = size / n;
  const levels = Math.max(2, Math.round(28 - rate * 25));
  const block = rate > 0.66 ? 2 : 1;
  for (let gy = 0; gy < n; gy++) {
    for (let gx = 0; gx < n; gx++) {
      let t;
      if (mode === "recon") {
        let sum = 0;
        let cnt = 0;
        for (let by = 0; by < block; by++) {
          for (let bx = 0; bx < block; bx++) {
            sum += scene(clamp((gx + bx) / (n - 1)), clamp((gy + by) / (n - 1)));
            cnt++;
          }
        }
        t = sum / cnt;
        t = Math.round(t * levels) / levels;
      } else {
        t = scene(gx / (n - 1), gy / (n - 1));
      }
      const r = t < 0.5 ? 91 + (103 - 91) * t * 2 : 103 + (155 - 103) * (t - 0.5) * 2;
      const g = t < 0.5 ? 140 + (212 - 140) * t * 2 : 212 - (212 - 123) * (t - 0.5) * 2;
      const b = 255;
      ctx.fillStyle = `rgb(${r | 0},${g | 0},${b | 0})`;
      ctx.fillRect(gx * cell, gy * cell, cell - 0.5, cell - 0.5);
    }
  }
}

function makeLabel(text) {
  const c = document.createElement("canvas");
  c.width = 256;
  c.height = 48;
  const ctx = c.getContext("2d");
  ctx.fillStyle = "rgba(233,238,246,0.85)";
  ctx.font = '20px "JetBrains Mono", monospace';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(text, 128, 26);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(3.4, 0.64, 1);
  return sp;
}

function makeCloud(count) {
  const pos = new Float32Array(count * 3);
  const col = new Float32Array(count * 3);
  const base = new Float32Array(count * 3);
  const cyan = new THREE.Color(C.cyan);
  const violet = new THREE.Color(C.violet);
  const tmp = new THREE.Color();
  for (let i = 0; i < count; i++) {
    base[i * 3] = (Math.random() - 0.5) * 7;
    base[i * 3 + 1] = (Math.random() - 0.5) * 5.4;
    base[i * 3 + 2] = (Math.random() - 0.5) * 4;
    tmp.copy(cyan).lerp(violet, i / count);
    col[i * 3] = tmp.r;
    col[i * 3 + 1] = tmp.g;
    col[i * 3 + 2] = tmp.b;
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
  const mat = new THREE.PointsMaterial({
    size: 0.34,
    map: discTexture(64),
    vertexColors: true,
    transparent: true,
    opacity: 0.9,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    sizeAttenuation: true
  });
  return { points: new THREE.Points(geo, mat), geo, pos, base, count };
}

export function initCodec() {
  const canvas = document.getElementById("codec");
  if (!canvas) return;
  const gl = makeGL(canvas, { antialias: true, dpr: 1.75 });
  if (!gl) return;
  const { renderer, scene: scn, camera } = gl;
  const wrap = canvas.closest(".codec__canvas-wrap");
  const inView = (() => {
    let inview = true;
    const io = new IntersectionObserver((es) => (inview = es[0].isIntersecting), { rootMargin: "160px" });
    io.observe(canvas);
    return () => inview;
  })();

  camera.position.set(0, 3.6, 27);
  camera.lookAt(0, -0.4, 0);

  // ---- source + reconstruction ---------------------------------
  const src = drawSurface(240, 240);
  const rec = drawSurface(240, 240);
  paint(src.ctx, 240, "source", 0);
  paint(rec.ctx, 240, "recon", 0.5);
  src.flip();
  rec.flip();

  const planeGeo = new THREE.PlaneGeometry(8.4, 8.4);
  const srcMesh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: src.tex, transparent: true }));
  srcMesh.position.set(-12, 0, 0);
  scn.add(srcMesh);
  const recMesh = new THREE.Mesh(planeGeo, new THREE.MeshBasicMaterial({ map: rec.tex, transparent: true }));
  recMesh.position.set(12, 0, 0);
  scn.add(recMesh);

  const borderMat = new THREE.LineBasicMaterial({ color: C.muted, transparent: true, opacity: 0.4 });
  const border = new THREE.EdgesGeometry(planeGeo);
  const b1 = new THREE.LineSegments(border, borderMat);
  b1.position.copy(srcMesh.position);
  const b2 = new THREE.LineSegments(border, borderMat);
  b2.position.copy(recMesh.position);
  scn.add(b1, b2);

  // ---- latent + decoded clouds ---------------------------------
  const enc = makeCloud(520);
  enc.points.position.x = -1.5;
  scn.add(enc.points);
  const dec = makeCloud(360);
  dec.points.position.x = 8.2;
  scn.add(dec.points);

  // ---- bitstream cluster ---------------------------------------
  const bitCount = 150;
  const bitMesh = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.16, 0.16, 0.16),
    new THREE.MeshBasicMaterial({ color: C.cyan, transparent: true, opacity: 0.85 }),
    bitCount
  );
  bitMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const bitPos = [];
  for (let i = 0; i < bitCount; i++) {
    bitPos.push(
      new THREE.Vector3(
        4.7 + Math.random() * 1.4,
        (Math.random() - 0.5) * 5,
        (Math.random() - 0.5) * 3.4
      )
    );
  }
  scn.add(bitMesh);
  const dummy = new THREE.Object3D();

  // ---- flow particles ------------------------------------------
  const FLOW = 90;
  const flowGeo = new THREE.BufferGeometry();
  const flowPos = new Float32Array(FLOW * 3);
  const flowCol = new Float32Array(FLOW * 3);
  const flowSeed = new Float32Array(FLOW);
  for (let i = 0; i < FLOW; i++) {
    flowSeed[i] = Math.random();
    flowCol[i * 3] = 0.4;
    flowCol[i * 3 + 1] = 0.83;
    flowCol[i * 3 + 2] = 1;
  }
  flowGeo.setAttribute("position", new THREE.BufferAttribute(flowPos, 3));
  flowGeo.setAttribute("color", new THREE.BufferAttribute(flowCol, 3));
  const flow = new THREE.Points(
    flowGeo,
    new THREE.PointsMaterial({
      size: 0.3,
      map: discTexture(64),
      vertexColors: true,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
      blending: THREE.AdditiveBlending
    })
  );
  scn.add(flow);

  // ---- channel lines -------------------------------------------
  const lineMat = new THREE.LineBasicMaterial({ color: C.muted, transparent: true, opacity: 0.25 });
  const linePts = [
    new THREE.Vector3(-7.8, 0, 0), new THREE.Vector3(-5.2, 0, 0),
    new THREE.Vector3(2.2, 0, 0), new THREE.Vector3(4.2, 0, 0),
    new THREE.Vector3(6.6, 0, 0), new THREE.Vector3(7.8, 0, 0)
  ];
  for (let i = 0; i < linePts.length; i += 2) {
    const g = new THREE.BufferGeometry().setFromPoints([linePts[i], linePts[i + 1]]);
    scn.add(new THREE.Line(g, lineMat));
  }

  // ---- labels --------------------------------------------------
  const labels = [
    ["SOURCE", -12], ["LATENT ẑ", -1.5], ["QUANTIZE", 1.6],
    ["BITSTREAM", 5.2], ["DECODE", 8.2], ["x̂", 12]
  ];
  for (const [text, x] of labels) {
    const sp = makeLabel(text);
    sp.position.set(x, -5.2, 0);
    scn.add(sp);
  }

  // ---- interaction ---------------------------------------------
  let dragging = false;
  const localX = (e) => {
    const r = canvas.getBoundingClientRect();
    return clamp((e.clientX - r.left) / r.width);
  };
  const setDir = (dir) => {
    if (wrap && wrap.dataset.dir !== dir) wrap.dataset.dir = dir;
  };
  canvas.addEventListener("pointermove", (e) => {
    const x = localX(e);
    setDir(x < 0.5 ? "fwd" : "rev");
    if (dragging) machine.s.rateUser = x;
  });
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    canvas.setPointerCapture?.(e.pointerId);
    machine.s.rateUser = localX(e);
  });
  const end = (e) => {
    dragging = false;
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener("pointerup", end);
  canvas.addEventListener("pointercancel", end);

  let lastPaintRate = -1;

  machine.register((dt, d, s) => {
    if (!inView()) return;
    const rate = d.rate;

    if (Math.abs(rate - lastPaintRate) > 0.012) {
      lastPaintRate = rate;
      paint(rec.ctx, 240, "recon", rate);
      rec.flip();
    }

    // latent cloud: count, contraction and quantization grid
    const activeCount = clamp(Math.round(d.latentDim * 8), 60, enc.count);
    const grid = 0.16 + rate * 1.5;
    const contract = 1 - rate * 0.45;
    updateCloud(enc, activeCount, grid, contract, s, 0);
    const decCount = clamp(Math.round(activeCount * 0.82), 40, dec.count);
    updateCloud(dec, decCount, grid * 1.7, contract * 0.92, s, 1.7);

    // bitstream density
    const activeBits = Math.round((1 - rate) * bitCount * 0.94) + 6;
    for (let i = 0; i < bitCount; i++) {
      if (i < activeBits) {
        const p = bitPos[i];
        dummy.position.set(p.x, p.y, p.z);
        dummy.scale.setScalar(0.7 + (1 - rate) * 0.6);
      } else {
        dummy.position.set(0, -999, 0);
        dummy.scale.setScalar(0);
      }
      dummy.updateMatrix();
      bitMesh.setMatrixAt(i, dummy.matrix);
    }
    bitMesh.instanceMatrix.needsUpdate = true;

    // flow
    const fwd = wrap?.dataset.dir !== "rev";
    const speed = (s.reduced || s.paused ? 0 : 0.16) * (fwd ? 1 : -1);
    for (let i = 0; i < FLOW; i++) {
      let t = (flowSeed[i] + s.time * speed) % 1;
      if (t < 0) t += 1;
      const x = -13 + t * 26;
      const activeHalf = fwd ? x < 0 : x > 0;
      flowPos[i * 3] = x;
      flowPos[i * 3 + 1] = 4 + Math.sin(t * 9 + i) * 0.6;
      flowPos[i * 3 + 2] = Math.sin(i * 1.7) * 0.8;
      const bright = activeHalf ? 1 : 0.32;
      flowCol[i * 3] = 0.4 * bright;
      flowCol[i * 3 + 1] = 0.83 * bright;
      flowCol[i * 3 + 2] = bright;
    }
    flowGeo.attributes.position.needsUpdate = true;
    flowGeo.attributes.color.needsUpdate = true;

    scn.rotation.y = (s.fx - 0.5) * 0.12;
    scn.rotation.x = -(s.fy - 0.5) * 0.07;

    renderer.render(scn, camera);
  });

  function updateCloud(cloud, activeCount, grid, contract, s, phase) {
    const { pos, base, geo } = cloud;
    for (let i = 0; i < cloud.count; i++) {
      const b = i * 3;
      if (i < activeCount) {
        const wob = s.reduced ? 0 : Math.sin(s.time * 0.8 + i + phase) * 0.06;
        pos[b] = Math.round((base[b] + wob) / grid) * grid * contract;
        pos[b + 1] = Math.round((base[b + 1] + wob) / grid) * grid * contract;
        pos[b + 2] = Math.round((base[b + 2] + wob) / grid) * grid * contract;
      } else {
        pos[b] = 0;
        pos[b + 1] = -999;
        pos[b + 2] = 0;
      }
    }
    geo.attributes.position.needsUpdate = true;
  }
}
